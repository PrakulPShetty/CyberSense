#!/usr/bin/env node
/**
 * Two-case accessibility verification for the user guide, driven through the UI.
 *
 *   node a11y-verify.mjs refusal   # run against a SECURE-DEFAULT server (npm run dev)
 *                                  # expects: Scan refused (LOOPBACK_BLOCKED)
 *   node a11y-verify.mjs fixture   # run against dev:a11y-demo (loopback opted in)
 *                                  # expects: the controlled fixture's 11 planted
 *                                  #          axe-core rules all reproduced
 *
 * The mode matters: loopback is refused unless the operator started the server
 * with CYBERSENSE_A11Y_ALLOW_LOOPBACK=1, so a refusal seen on one server and a
 * fixture scan seen on another are two different configurations, not a
 * contradiction. This script refuses to run against the wrong configuration
 * rather than silently producing a misleading result.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "http://127.0.0.1:8080";
const mode = process.argv[2];
if (mode !== "refusal" && mode !== "fixture") {
  console.error("usage: node a11y-verify.mjs <refusal|fixture>");
  process.exit(2);
}

/** The 11 defects planted in src/routes/a11y-demo.tsx, by expected axe rule. */
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

const { browser, browserSource } = await launch();
mkdirSync(HERE, { recursive: true });

const report = { mode, base: BASE, browserSource, startedAt: new Date().toISOString() };
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err).split("\n")[0]));

try {
  await page.goto(`${BASE}/accessibility`, { waitUntil: "load", timeout: 60_000 });
  await page
    .waitForFunction(
      () => {
        const tsr = window.$_TSR;
        return tsr === undefined || tsr.hydrated === true;
      },
      undefined,
      { timeout: 60_000, polling: 250 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(300);

  const target = mode === "refusal" ? `${BASE}/a11y-demo` : `${BASE}/a11y-demo`;
  await page.fill("#a11y-url", target);
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();
  await Promise.race([
    page.waitForFunction(() => document.body.innerText.toUpperCase().includes("SCAN REFUSED"), undefined, { timeout: 180_000 }),
    page.waitForFunction(() => document.body.innerText.toUpperCase().includes("FAILING RULES"), undefined, { timeout: 180_000 }),
  ]).catch(() => undefined);
  await page.waitForTimeout(500);

  // Chromium's innerText applies the app's CSS uppercase, so match case-insensitively.
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  const upper = text.toUpperCase();

  if (upper.includes("SCAN REFUSED")) {
    report.outcome = "refused";
    report.errorCode = /SCAN REFUSED \(([A-Z_]+)\)/.exec(text)?.[1] ?? null;
    report.message = /Scan refused \([A-Z_]+\)\s*(.{0,180})/i.exec(text)?.[1] ?? null;
    report.misconfiguration = mode === "fixture" ? "server is NOT in a11y-demo mode" : null;
  } else {
    report.outcome = "scanned";
    report.failingRules = Number(/Failing rules\s+(\d+)/i.exec(text)?.[1] ?? NaN);
    report.failingElements = Number(/Failing elements\s+(\d+)/i.exec(text)?.[1] ?? NaN);
    report.rulesPassed = Number(/Rules passed\s+(\d+)/i.exec(text)?.[1] ?? NaN);
    report.undecidedRules = Number(/Undecided rules\s+(\d+)/i.exec(text)?.[1] ?? NaN);
    report.misconfiguration = mode === "refusal" ? "server HAS loopback enabled — not the secure default" : null;

    const open = page.getByRole("link", { name: /Open full findings/i }).first();
    if ((await open.count()) > 0) {
      await open.click();
      await page.waitForTimeout(2500);
      const detail = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
      report.detailUrl = page.url().replace(BASE, "");
      report.engine = /axe-core \d[\d.]*/.exec(detail)?.[0] ?? null;
      report.expectedRules = EXPECTED_RULES;
      report.foundExpectedRules = EXPECTED_RULES.filter((id) => detail.includes(id));
      report.missingExpectedRules = EXPECTED_RULES.filter((id) => !detail.includes(id));
      report.detailSample = detail.slice(0, 1500);
    }
  }
  await page.screenshot({ path: join(HERE, `a11y-verify-${mode}.png`) });
} catch (err) {
  report.error = String(err?.message || err);
} finally {
  report.pageErrors = pageErrors;
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(HERE, `a11y-verify-${mode}.json`), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ ...report, detailSample: report.detailSample?.slice(0, 300) }, null, 2));
}
