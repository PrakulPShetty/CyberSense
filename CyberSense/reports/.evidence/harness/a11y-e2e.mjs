#!/usr/bin/env node
/**
 * End-to-end check of the Track D accessibility scanner, driven through the real
 * UI (`/accessibility`) rather than by calling server functions directly.
 *
 * Usage:
 *   node reports/.evidence/harness/a11y-e2e.mjs                    # secure default: loopback refused
 *   node reports/.evidence/harness/a11y-e2e.mjs --expect findings  # server started with dev:a11y-demo
 *
 * The form is only driven once the page is actually interactive. On a cold Vite
 * dev server the client bundle can arrive seconds after the HTML, and filling a
 * controlled input before React hydrates lets the first render overwrite it —
 * which looks exactly like a broken button. `waitForInteractive` removes that
 * false negative instead of hiding it behind a longer fixed sleep.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "qa");

const argv = process.argv.slice(2);
const expectIndex = argv.indexOf("--expect");
const EXPECT = expectIndex >= 0 ? argv[expectIndex + 1] : "refusal";
const targetIndex = argv.indexOf("--target");
const BASE = "http://127.0.0.1:8080";
const FIXTURE_URL = `${BASE}/a11y-demo`;
const TARGET_URL = targetIndex >= 0 ? argv[targetIndex + 1] : FIXTURE_URL;
// The rule contract only applies when we scanned the controlled fixture.
const CHECK_RULES = TARGET_URL === FIXTURE_URL;
/** Distinct evidence file per target, so a later run cannot overwrite an earlier one. */
const SLUG = `${EXPECT}-${new URL(TARGET_URL).hostname.replace(/[^a-z0-9]+/gi, "-")}`;
const URL_FIELD = "#a11y-url";
const SCAN_BUTTON = /run accessibility scan/i;

/**
 * The defects baked into `src/routes/a11y-demo.tsx`, with the axe rule each is
 * expected to raise. This list is the fixture's own contract, not a copy of a
 * previous result, so the check fails if the scanner stops reproducing it.
 */
const EXPECTED_RULES = [
  "image-alt",
  "color-contrast",
  "label",
  "select-name",
  "button-name",
  "link-name",
  "aria-roles",
  "heading-order",
  "list",
  "tabindex",
  "frame-title",
];

async function launch() {
  const attempts = [
    ["bundled-chromium", { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
    ["channel:chrome", { headless: true, channel: "chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
    ["channel:msedge", { headless: true, channel: "msedge", args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
  ];
  const failures = [];
  for (const [label, options] of attempts) {
    try {
      return { browser: await chromium.launch(options), browserSource: label, failures };
    } catch (err) {
      failures.push(`${label}: ${String(err?.message || err).split("\n")[0]}`);
    }
  }
  throw new Error(`no Chromium available — ${failures.join(" | ")}`);
}

/**
 * Wait for React to adopt the server HTML, then interact ONCE.
 *
 * Measured on this workstation: waiting for the router's hydration flag and then
 * filling a single time binds the input in ~1.2 s, while repeatedly filling it
 * every 400 ms never binds at all — Playwright rewriting a controlled input's
 * value while hydration is in flight stops React from taking it over. So the
 * readiness signal, not a longer sleep, is what makes this reliable.
 */
async function waitForInteractive(page, timeoutMs = 60_000) {
  const started = Date.now();
  let signal = "timeout";
  try {
    await page.waitForFunction(
      () => {
        const tsr = window.$_TSR;
        return tsr === undefined || tsr.hydrated === true;
      },
      undefined,
      { timeout: timeoutMs, polling: 250 },
    );
    signal = "router-hydrated";
  } catch {
    signal = "hydration-timeout";
  }
  await page.fill(URL_FIELD, "https://example.org", { timeout: 10_000 });
  await page.waitForTimeout(250);
  const disabled = await page.getByRole("button", { name: SCAN_BUTTON }).isDisabled();
  return { interactive: !disabled, signal, ms: Date.now() - started };
}

const { browser, browserSource, failures } = await launch();
mkdirSync(OUT_DIR, { recursive: true });

const report = {
  base: BASE,
  expected: EXPECT,
  targetUrl: TARGET_URL,
  fixtureUrl: FIXTURE_URL,
  checksFixtureRuleContract: CHECK_RULES,
  browserSource,
  launchFailures: failures,
  steps: {},
};

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
// Errors are split by phase: anything raised while the dev server is still
// compiling its client graph is a cold-start artifact, not an app defect.
const loadErrors = [];
const interactionErrors = [];
let interactive = false;
const collect = (bucket) => (msg) => {
  if (msg.type() === "error") bucket.push(msg.text().split("\n")[0].slice(0, 300));
};
page.on("console", (msg) => collect(interactive ? interactionErrors : loadErrors)(msg));
page.on("pageerror", (err) => collect(interactive ? interactionErrors : loadErrors)(err));

try {
  const resp = await page.goto(`${BASE}/accessibility`, { waitUntil: "load", timeout: 60_000 });
  const readiness = await waitForInteractive(page);
  interactive = readiness.interactive;

  report.steps.form = {
    status: resp?.status() ?? 0,
    interactive: readiness.interactive,
    interactiveSignal: readiness.signal,
    interactiveMs: readiness.ms,
    hasUrlInput: (await page.locator(URL_FIELD).count()) > 0,
    hasScanButton: (await page.getByRole("button", { name: SCAN_BUTTON }).count()) > 0,
    bodyTextLen: (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().length,
  };
  await page.screenshot({ path: join(OUT_DIR, "a11y-form.png") });

  if (!readiness.interactive) throw new Error("the scan form never became interactive");

  await page.fill(URL_FIELD, TARGET_URL);
  await page.getByRole("button", { name: SCAN_BUTTON }).click();

  const refused = page.getByText(/Scan refused \(/);
  const finished = page.getByText(/Failing rules/i);
  await Promise.race([
    refused.waitFor({ state: "visible", timeout: 180_000 }),
    finished.waitFor({ state: "visible", timeout: 180_000 }),
  ]).catch(() => undefined);

  report.steps.outcome = {
    refused: (await refused.count()) ? (await refused.first().innerText()).trim() : null,
    renderedViolationSummary: (await finished.count()) > 0,
    bodyTextLen: (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().length,
  };
  await page.screenshot({ path: join(OUT_DIR, `a11y-outcome-${SLUG}.png`) });

  let detailText = "";
  const open = page.getByRole("link", { name: /open full findings/i }).first();
  if ((await open.count()) > 0) {
    await open.click();
    await page.waitForTimeout(2500);
    detailText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    report.steps.detail = { url: page.url(), bodyTextLen: detailText.length };
    await page.screenshot({ path: join(OUT_DIR, `a11y-detail-${SLUG}.png`) });
  }

  report.steps.rules = CHECK_RULES
    ? {
        expected: EXPECTED_RULES,
        found: EXPECTED_RULES.filter((id) => detailText.includes(id)),
        missing: EXPECTED_RULES.filter((id) => !detailText.includes(id)),
      }
    : { skipped: "target is not the controlled fixture" };
  report.steps.detailSample = detailText.slice(0, 1200);

  const fixture = await context.newPage();
  const fixtureResp = await fixture.goto(FIXTURE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await fixture.waitForTimeout(800);
  report.steps.fixture = {
    status: fixtureResp?.status() ?? 0,
    hasBanner: (await fixture.getByText(/Synthetic accessibility test fixture/i).count()) > 0,
  };
  await fixture.screenshot({ path: join(OUT_DIR, "a11y-fixture.png") });
  await fixture.close();
} catch (err) {
  report.error = String(err?.message || err);
} finally {
  report.loadPhaseConsoleErrors = loadErrors;
  report.interactionConsoleErrors = interactionErrors;
  await context.close();
  await browser.close();
  writeFileSync(join(OUT_DIR, `a11y-e2e-${SLUG}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
