/**
 * Real accessibility scanning: Playwright opens the rendered page, axe-core runs
 * its rule set inside that page, and the violations axe returns are stored
 * verbatim.
 *
 * Nothing here is synthesized. Every rule id, impact, selector and HTML snippet
 * in a stored result came back from axe-core on a page the browser actually
 * loaded.
 *
 * Server-only, and deliberately loosely coupled to `playwright` / `axe-core`:
 * both are resolved through `createRequire` at call time instead of being
 * imported, so the client bundle never sees them, a deployment without the
 * browser binaries fails with a clear message instead of a module error, and the
 * heavy axe-core source is read from disk once rather than inlined in the bundle.
 */
import type { Browser, BrowserContext, Page } from "playwright";
import { lookup } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { newId } from "../sentinel/ids.ts";
import { isBlockedAddress, isLoopbackHostname, guardScanUrl } from "./guard.ts";
import type {
  A11yImpact,
  A11yRuleResult,
  A11yScanRecord,
  A11yScanSummary,
  A11yViolationNode,
} from "./types.ts";

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/a11y/scan.server is server-only. Call it from a createServerFn handler " +
      "(dynamic import), never from a React component or browser code.",
  );
}

const require_ = createRequire(import.meta.url);

/** axe tags that make up the WCAG 2.0/2.1/2.2 A + AA scope, plus best practice. */
const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
  "best-practice",
] as const;

const MAX_NODES_PER_RULE = 20;
const MAX_STORED_VIOLATIONS = 100;
const NAV_TIMEOUT_MS = 20_000;
const SCAN_BUDGET_MS = 45_000;
const BROWSER_IDLE_CLOSE_MS = 120_000;
const VIEWPORT = { width: 1280, height: 900 };
const USER_AGENT = "CyberSense-AccessibilityCheck/1.0 (+authorized automated accessibility scan)";

export const SCAN_LIMITATIONS = [
  "Automated rules detect only a subset of WCAG success criteria. Passing this scan is not a claim of WCAG compliance — manual testing with keyboard, screen reader and zoom is still required.",
  `The page was loaded once at ${VIEWPORT.width}×${VIEWPORT.height} and at its initial state only: menus, modals, form validation and other interactive states were not exercised.`,
  "Content that requires signing in, that is rendered only after user input, or that is served to a different viewport was not reached.",
  "Dynamic content that appears after the scan, and pages reached only by following links from this one, were not scanned.",
];

/** Run a single, safe website security check against an authorized target. */
export function securityCheck(observation: {
  targetUrl: string;
  checkId: string;
  expected: string;
}): {
  status: "pass" | "fail" | "not-verified" | "skipped" | "error";
  observed: string;
  limitation?: string;
} {
  // Use fetchWithTimeout from osint for consistent timeout handling
  // Only perform checks on approved loopback/fixture addresses or approved hosts
  return { status: "not-verified", observed: "Security checks are advisory only; run against authorized targets only." };
}

type AxeNode = {
  html?: string;
  target?: unknown;
  failureSummary?: string;
  impact?: string | null;
};

type AxeRule = {
  id?: string;
  impact?: string | null;
  tags?: string[];
  description?: string;
  help?: string;
  helpUrl?: string;
  nodes?: AxeNode[];
};

type AxeResults = {
  violations?: AxeRule[];
  incomplete?: AxeRule[];
  passes?: AxeRule[];
  inapplicable?: AxeRule[];
  testEngine?: { name?: string; version?: string };
};

// --- browser lifecycle ------------------------------------------------------

type BrowserSession = { browser: Browser; source: string; timer: NodeJS.Timeout | null };

let session: BrowserSession | null = null;
let pendingLaunch: Promise<{ browser: Browser; source: string }> | null = null;

const LAUNCH_ATTEMPTS: { label: string; options: Record<string, unknown> }[] = [
  { label: "playwright-chromium", options: {} },
  { label: "installed-chrome", options: { channel: "chrome" } },
  { label: "installed-msedge", options: { channel: "msedge" } },
];

function firstLine(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.split("\n")[0] ?? text;
}

async function launchBrowser(): Promise<{ browser: Browser; source: string }> {
  let playwright: { chromium?: { launch: (options: Record<string, unknown>) => Promise<Browser> } };
  try {
    playwright = require_("playwright") as typeof playwright;
  } catch (err) {
    throw Object.assign(
      new Error(
        "The Playwright package is not installed, so no page can be rendered. " +
          "Install dependencies (`npm install`) and, if needed, the browser (`npx playwright install chromium`).",
      ),
      { error_code: "PLAYWRIGHT_MISSING", detail: firstLine(err) },
    );
  }
  const chromium = playwright.chromium;
  if (!chromium) {
    throw Object.assign(new Error("The installed playwright package exposes no chromium browser type."), {
      error_code: "PLAYWRIGHT_MISSING",
    });
  }

  const failures: string[] = [];
  for (const attempt of LAUNCH_ATTEMPTS) {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
        ...attempt.options,
      });
      return { browser, source: attempt.label };
    } catch (err) {
      failures.push(`${attempt.label}: ${firstLine(err)}`);
    }
  }
  throw Object.assign(
    new Error(
      "No Chromium-based browser could be started for scanning. Install one with " +
        "`npx playwright install chromium`, or use a machine that already has Chrome or Edge.",
    ),
    { error_code: "BROWSER_UNAVAILABLE", detail: failures.join(" | ") },
  );
}

function scheduleIdleClose(): void {
  if (!session) return;
  if (session.timer) clearTimeout(session.timer);
  const timer = setTimeout(() => {
    const closing = session;
    session = null;
    pendingLaunch = null;
    void closing?.browser.close().catch(() => undefined);
  }, BROWSER_IDLE_CLOSE_MS);
  timer.unref?.();
  session.timer = timer;
}

async function acquireBrowser(): Promise<BrowserSession> {
  if (session) {
    scheduleIdleClose();
    return session;
  }
  pendingLaunch ??= launchBrowser().catch((err) => {
    pendingLaunch = null;
    throw err;
  });
  const launched = await pendingLaunch;
  session = { browser: launched.browser, source: launched.source, timer: null };
  scheduleIdleClose();
  return session;
}

let axeSourceCache: string | null = null;

function axeSource(): string {
  if (axeSourceCache === null) {
    try {
      axeSourceCache = readFileSync(require_.resolve("axe-core/axe.min.js"), "utf8");
    } catch (err) {
      throw Object.assign(
        new Error(
          "The axe-core rule engine is not installed, so no accessibility rules can run. " +
            "Install it with `npm install axe-core`.",
        ),
        { error_code: "AXE_MISSING", detail: firstLine(err) },
      );
    }
  }
  return axeSourceCache;
}

// --- target safety ----------------------------------------------------------

async function assertResolvesPublic(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch (err) {
    throw Object.assign(new Error(`The hostname ${hostname} did not resolve (DNS lookup failed).`), {
      error_code: "DNS_FAILED",
      detail: firstLine(err),
    });
  }
  if (!addresses.length) {
    throw Object.assign(new Error(`The hostname ${hostname} resolved to no address.`), {
      error_code: "DNS_FAILED",
    });
  }
  const blocked = addresses.filter((a) => isBlockedAddress(a.address));
  if (blocked.length) {
    throw Object.assign(
      new Error(
        `${hostname} resolves to a private, loopback or link-local address (${blocked
          .map((b) => b.address)
          .join(", ")}), so the scan is refused.`,
      ),
      { error_code: "PRIVATE_ADDRESS" },
    );
  }
}

// --- result mapping ---------------------------------------------------------

function toNodes(nodes: AxeNode[] | undefined): { nodes: A11yViolationNode[]; nodeCount: number } {
  const list = Array.isArray(nodes) ? nodes : [];
  return {
    nodeCount: list.length,
    nodes: list.slice(0, MAX_NODES_PER_RULE).map((n) => ({
      target: Array.isArray(n.target) ? n.target.map(String) : [String(n.target ?? "")],
      html: String(n.html ?? ""),
      failureSummary: String(n.failureSummary ?? ""),
    })),
  };
}

function toRule(rule: AxeRule): A11yRuleResult | null {
  const id = String(rule.id ?? "");
  if (!id) return null;
  const tags = Array.isArray(rule.tags) ? rule.tags.map(String) : [];
  const { nodes, nodeCount } = toNodes(rule.nodes);
  const impact = rule.impact ?? null;
  return {
    id,
    impact: (["critical", "serious", "moderate", "minor"] as const).includes(impact as A11yImpact)
      ? (impact as A11yImpact)
      : null,
    description: String(rule.description ?? ""),
    help: String(rule.help ?? ""),
    helpUrl: String(rule.helpUrl ?? ""),
    tags,
    nodeCount,
    nodes,
    wcagCriteria: Array.from(
      new Set(
        (rule.tags ?? [])
          .filter((t) => /^wcag\d/i.test(String(t)))
          .map((t) => String(t).toUpperCase()),
      ),
    ),
  };
}

function summarize(
  violations: A11yRuleResult[],
  elementCounts: number[],
  incomplete: A11yRuleResult[],
  passCount: number,
  inapplicableCount: number,
  truncated: boolean,
): A11yScanSummary {
  const byImpact: Record<A11yImpact | "unknown", number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };
  const byWcagTag: Record<string, number> = {};
  for (const v of violations) {
    byImpact[v.impact ?? "unknown"] += 1;
    for (const tag of v.tags) {
      if (/^wcag\d/i.test(tag)) byWcagTag[tag] = (byWcagTag[tag] ?? 0) + 1;
    }
  }
  return {
    ruleCount: violations.length,
    elementCount: elementCounts.reduce((s, n) => s + n, 0),
    byImpact,
    byWcagTag,
    incompleteCount: incomplete.length,
    passCount,
    inapplicableCount,
    truncated,
  };
}

// --- the scan ---------------------------------------------------------------

export interface ScanOptions {
  /** Loopback opt-in and any other environment overrides (tests pass their own). */
  env?: Record<string, string | undefined>;
  /** Injectable clock, so a test can assert a deterministic `scannedAt`. */
  now?: string;
}

/** Compact result of a single website security check. */
export interface SecurityCheckResult {
  /** Identifier for the check (e.g. "https-redirect", "hsts", "xss-protection"). */
  id: string;
  /** Human-readable description of what was checked. */
  description: string;
  /** Expected condition for a passing result. */
  expected: string;
  /** Actual observation from the scan. */
  observed: string;
  /** Result status. */
  status: "pass" | "fail" | "not-verified" | "skipped" | "error";
  /** Severity rationale when the result is a failure. */
  severityRationale?: string;
}

export async function scanUrl(rawUrl: string, options: ScanOptions = {}): Promise<A11yScanRecord> {
  const guard = guardScanUrl(rawUrl, options.env ?? process.env);
  if (!guard.ok) {
    throw Object.assign(new Error(guard.message), { error_code: guard.error_code });
  }
  const target = guard.url;
  const loopback = guard.loopback;

  if (!loopback) await assertResolvesPublic(target.hostname);

  axeSource();
  const { browser, source } = await acquireBrowser();

  const startedAt = Date.now();
  const scannedAt = options.now ?? new Date().toISOString();
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: USER_AGENT,
      // A scan is a read-only visit: no cookies carried over from a session.
      ignoreHTTPSErrors: false,
    });
    await context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    await context.setDefaultTimeout(NAV_TIMEOUT_MS);

    // Resource + reach limits. Requests to loopback/private ranges are refused
    // unless the operator explicitly opted into scanning the local fixture, in
    // which case only the fixture's own host stays reachable.
    await context.route("**/*", async (route) => {
      let requestUrl: URL;
      try {
        requestUrl = new URL(route.request().url());
      } catch {
        await route.abort("blockedbyclient");
        return;
      }
      if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
        // Inline data: URLs and blob: sub-resources are harmless and commonly
        // legitimate; everything else non-web is dropped.
        if (requestUrl.protocol === "data:" || requestUrl.protocol === "blob:") {
          await route.continue();
          return;
        }
        await route.abort("blockedbyclient");
        return;
      }
      const host = requestUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
      if (isLoopbackHostname(host)) {
        await (loopback ? route.continue() : route.abort("blockedbyclient"));
        return;
      }
      await (isBlockedAddress(host) ? route.abort("blockedbyclient") : route.continue());
    });

    page = await context.newPage();
    page.on("dialog", (dialog) => {
      void dialog.dismiss().catch(() => undefined);
    });

    const response = await page.goto(target.toString(), { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw Object.assign(new Error(`The page returned HTTP ${status}, so there was nothing to scan.`), {
        error_code: "TARGET_HTTP_ERROR",
      });
    }

    // Redirect restriction: a scan must not silently follow the target onto a
    // different host, which would mean auditing a site the operator never named.
    const finalUrl = new URL(page.url());
    if (finalUrl.host !== target.host) {
      throw Object.assign(
        new Error(
          `The page redirected off-origin (${target.host} → ${finalUrl.host}). ` +
            "Re-run the scan against the final address if it is in scope.",
        ),
        { error_code: "REDIRECT_OFF_ORIGIN" },
      );
    }

    // Bound the rule run by what is left of the overall budget, so a pathological
    // page cannot hold the request open indefinitely.
    const remainingBudget = Math.max(5_000, SCAN_BUDGET_MS - (Date.now() - startedAt));
    page.setDefaultTimeout(remainingBudget);

    await page.addScriptTag({ content: axeSource(), type: "text/javascript" });

    const result = await page.evaluate(async () => {
      const runner = (window as unknown as { axe?: { run: (ctx: unknown, opts: unknown) => Promise<unknown> } }).axe;
      if (!runner) return { missing: true };
      const out = (await runner.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa", "best-practice"],
        },
        resultTypes: ["violations", "incomplete", "passes", "inapplicable"],
      })) as unknown;
      const title = document.title;
      const lang = document.documentElement.getAttribute("lang");
      return {
        missing: false,
        results: out,
        page: { title, lang, elementCount: document.querySelectorAll("*").length },
      };
    });

    const evaluated = result as {
      missing: boolean;
      results?: AxeResults;
      page?: { title: string; lang: string | null; elementCount: number };
    };
    if (evaluated.missing || !evaluated.results) {
      throw Object.assign(new Error("The axe-core engine did not attach to the page."), {
        error_code: "ENGINE_NOT_READY",
      });
    }

    const axe = evaluated.results;
    const violationRules = (axe.violations ?? []).map(toRule).filter((r): r is A11yRuleResult => r !== null);
    const truncated = violationRules.length > MAX_STORED_VIOLATIONS;
    const violations = violationRules.slice(0, MAX_STORED_VIOLATIONS);
    const incomplete = (axe.incomplete ?? [])
      .map(toRule)
      .filter((r): r is A11yRuleResult => r !== null)
      // Incomplete rules carry no failure narrative; only the rule identity matters.
      .map((r) => ({ ...r, nodes: [] }));

    const engine = axe.testEngine;
    const engineVersion = `${engine?.name ?? "axe-core"} ${engine?.version ?? "unknown"}`;
    const pageInfo = evaluated.page ?? { title: "", lang: null, elementCount: 0 };

    const summary = summarize(
      violations,
      violations.map((v) => v.nodeCount),
      incomplete,
      (axe.passes ?? []).length,
      (axe.inapplicable ?? []).length,
      truncated,
    );

    return {
      id: newId("a11y"),
      url: target.toString(),
      hostname: target.hostname.toLowerCase(),
      // axe-core ran to completion on a page that loaded successfully. Finding
      // zero violations is still a completed scan; `incompleteCount` records the
      // rules axe could not decide, and the limitation text says so out loud.
      status: "COMPLETED" as const,
      engine: `${source} · ${engineVersion} · ${AXE_TAGS.length} tag groups`,
      engineVersion,
      scannedAt,
      page: {
        title: pageInfo.title,
        finalUrl: page.url(),
        lang: pageInfo.lang,
        elementCount: pageInfo.elementCount,
        loadMs: Date.now() - startedAt,
        viewport: `${VIEWPORT.width}×${VIEWPORT.height}`,
      },
      summary,
      violations,
      incomplete,
      passes: (axe.passes ?? []).map((p) => String(p.id ?? "")).filter(Boolean),
      errorCode: null,
      errorMessage: null,
      limitations: SCAN_LIMITATIONS,
    } satisfies A11yScanRecord;
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
  }
}

/** Exposed for callers that need the guard's message without starting a browser. */
export { guardScanUrl } from "./guard.ts";
export type { A11yScanRecord } from "./types.ts";
