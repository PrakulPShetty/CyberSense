#!/usr/bin/env node
/**
 * Verification of the assessment form's negative and LIVE paths, driven through
 * the real UI — the "what happens when input is refused, or when collection
 * finds nothing" half of the input/output reference.
 *
 * Safe inputs only: one rejected target, one missing-confirmation attempt, one
 * DEMO run, and one LIVE run against example.com (IANA's reserved example
 * domain). No other host is contacted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "qa");
const BASE = "http://127.0.0.1:8080";

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

const { browser, browserSource, failures } = await launch();
mkdirSync(OUT_DIR, { recursive: true });

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err).split("\n")[0]));

const report = { base: BASE, browserSource, launchFailures: failures, cases: {} };

/** Wait for React to take over the server HTML, then interact once. */
async function gotoHome() {
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60_000 });
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
}

async function submit({ mode, target, confirmation, authorizedBy = "Office of Information Security (synthetic)" }) {
  if (mode === "LIVE") await page.getByRole("button", { name: /LIVE mode/i }).click();
  else await page.getByRole("button", { name: /DEMO mode/i }).click();
  await page.fill("#target", target);
  await page.fill("#who", authorizedBy);
  await page.fill("#conf", confirmation);
  await page.getByRole("button", { name: /authorize and run/i }).click();
  // Either an inline error appears, or the router navigates to the assessment.
  await Promise.race([
    page.waitForURL(/\/assessments\//, { timeout: 90_000 }).catch(() => undefined),
    page.waitForSelector("p.text-critical", { timeout: 90_000 }).catch(() => undefined),
  ]);
  await page.waitForTimeout(2500);
}

async function snapshot() {
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  const num = (re) => {
    const m = re.exec(text);
    return m ? m[1].trim() : null;
  };
  return {
    url: page.url().replace(BASE, ""),
    inlineError: /Target is not a valid public domain|Authorization confirmation must include|authorized_by is required/i.test(text)
      ? (page.locator("p.text-critical").first().innerText().catch(() => "") , null)
      : null,
    errorText: await page
      .locator("p.text-critical")
      .first()
      .innerText()
      .catch(() => null),
    statusBadge: /PARTIAL|COMPLETED|FAILED/.exec(text)?.[0] ?? null,
    posture: num(/Posture\s+([^\s]+(?:\s+[^\s]+)?)/i),
    confidence: num(/Confidence\s+(\d+)%/i),
    criticalPaths: num(/Critical paths\s+(\d+)/i),
    insufficientEvidence: /Insufficient evidence/i.test(text),
    bodyTextLen: text.length,
    sample: text.slice(0, 400),
  };
}

try {
  // 1. Out-of-scope target
  await gotoHome();
  await submit({ mode: "DEMO", target: "not a domain", confirmation: "I confirm this target is authorized" });
  report.cases.outOfScopeTarget = await snapshot();
  await page.screenshot({ path: join(OUT_DIR, "case-out-of-scope.png") });

  // 2. Live target without the required confirmation phrase
  await gotoHome();
  await submit({ mode: "LIVE", target: "example.com", confirmation: "please scan it" });
  report.cases.missingConfirmation = await snapshot();
  await page.screenshot({ path: join(OUT_DIR, "case-missing-confirmation.png") });

  // 3. DEMO assessment (synthetic corpus)
  await gotoHome();
  await submit({
    mode: "DEMO",
    target: "demo-university.edu",
    confirmation: "I confirm this target is authorized for synthetic assessment",
  });
  report.cases.demoAssessment = await snapshot();
  await page.screenshot({ path: join(OUT_DIR, "case-demo-assessment.png") });

  // 4. LIVE assessment (passive DNS only)
  await gotoHome();
  await submit({
    mode: "LIVE",
    target: "example.com",
    confirmation: "I confirm this target is authorized",
  });
  report.cases.liveAssessment = await snapshot();
  await page.screenshot({ path: join(OUT_DIR, "case-live-assessment.png") });
} catch (err) {
  report.error = String(err?.message || err);
} finally {
  report.pageErrors = pageErrors;
  await page.close();
  await browser.close();
  writeFileSync(join(OUT_DIR, "sentinel-negative-cases.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
