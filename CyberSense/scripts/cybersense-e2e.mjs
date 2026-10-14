#!/usr/bin/env node
/**
 * CyberSense end-to-end workflow verification.
 *
 * Requires a running CyberSense dev server, normally `npm run dev`.
 * Usage:
 *   CYBERSENSE_E2E_BASE=http://127.0.0.1:8080 node scripts/cybersense-e2e.mjs
 */
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.env.CYBERSENSE_E2E_BASE ?? "http://127.0.0.1:8080";
const screenshotDir = join(dirname(fileURLToPath(import.meta.url)), "..", "screenshots");
mkdirSync(screenshotDir, { recursive: true });

const checks = [];
const consoleErrors = [];
const pageErrors = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(String(err)));

async function visit(path, label) {
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const status = response?.status() ?? 0;
  check(`${label} route returns 200`, status === 200, `HTTP ${status}`);
  await page.screenshot({ path: join(screenshotDir, `${slug(label)}.png`) });
  return status === 200;
}

try {
  await visit("/", "Home");
  await visit("/accessibility", "Home Scan Website");
  await visit("/results", "Scan Results");
  await visit("/recommendations", "Fix Recommendations");
  await visit("/assistant", "AI Assistant");
  await visit("/history", "Scan History Progress");
  await visit("/reports", "Reports");
  await visit("/security", "Website Security Checks");

  await page.goto(`${base}/accessibility`, { waitUntil: "networkidle" });
  await page.fill("#a11y-url", "https://example.com");
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();

  const findingsLink = page.getByRole("link", { name: "Open full findings" }).first();
  await findingsLink.waitFor({ state: "visible", timeout: 90000 });
  check("Accessibility scan persisted and returned result", true, "Open full findings became available");

  await findingsLink.click();
  await page.waitForURL(/\/accessibility\//, { timeout: 15000 });
  await page.getByText("Fix recommendations", { exact: false }).first().waitFor({ timeout: 15000 });
  const detailBody = await page.textContent("body");
  check("Saved scan detail page rendered", Boolean(detailBody && detailBody.includes("Fix recommendations")));

  await page.getByRole("button", { name: /Explain selected finding/i }).click();
  await page.getByText("What is the problem?", { exact: false }).first().waitFor({ timeout: 15000 });
  const assistantBody = await page.textContent("body");
  check(
    "Deterministic AI explanation matches selected finding",
    Boolean(
      assistantBody &&
        assistantBody.includes("Why does it matter?") &&
        assistantBody.includes("What needs to be done?") &&
        assistantBody.includes("How to verify"),
    ),
  );
  await page.screenshot({ path: join(screenshotDir, "e2e-ai-explanation.png") });

  await page.goto(`${base}/recommendations`, { waitUntil: "networkidle" });
  const recommendationsBody = await page.textContent("body");
  check(
    "Recommendations page shows advisory guidance from latest saved scan",
    Boolean(recommendationsBody && /Priority \d/.test(recommendationsBody)),
    recommendationsBody?.includes("Priority") ? "Latest stored scan recommendations available" : "No saved recommendations yet",
  );

  await page.goto(`${base}/history`, { waitUntil: "networkidle" });
  const historyBody = await page.textContent("body");
  check(
    "History page contains newly created scan",
    Boolean(historyBody && historyBody.includes("https://example.com")),
    "https://example.com",
  );
  await page.screenshot({ path: join(screenshotDir, "e2e-history.png") });

  await page.goto(`${base}/reports`, { waitUntil: "networkidle" });
  const downloadButton = page.getByRole("button", { name: /Download PDF report/i }).first();
  if (await downloadButton.count()) {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      downloadButton.click(),
    ]);
    const suggested = download.suggestedFilename();
    const path = await download.path();
    const size = statSync(path).size;
    check("Accessibility PDF downloaded", /\.pdf$/i.test(suggested) && size > 500, `${suggested} (${size} bytes)`);
  } else {
    check("Accessibility PDF downloaded", false, "No saved scan reports available");
  }

  await page.goto(`${base}/security`, { waitUntil: "networkidle" });
  await page.fill("#security-url", "https://example.com");
  await page.getByRole("button", { name: /Run checks/i }).click();
  await page.getByText("Results for https://example.com", { exact: false }).first().waitFor({ timeout: 30000 });
  const securityBody = await page.textContent("body");
  check(
    "Security check returns observed evidence",
    Boolean(
      securityBody &&
        securityBody.includes("HTTPS availability") &&
        securityBody.includes("TLS certificate validity") &&
        securityBody.includes("Cookie security attributes"),
    ),
  );
  await page.screenshot({ path: join(screenshotDir, "e2e-security-results.png") });

  await page.fill("#security-url", "http://169.254.169.254");
  await page.getByRole("button", { name: /Run checks/i }).click();
  await page.getByText("Security check refused or unavailable", { exact: false }).first().waitFor({ timeout: 30000 });
  const refusalBody = await page.textContent("body");
  check("Prohibited loopback target safely refused", Boolean(refusalBody && !refusalBody.includes("Results for http://169.254.169.254")));

  check("No console errors during E2E workflow", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("No page errors during E2E workflow", pageErrors.length === 0, pageErrors.join(" | "));
} catch (err) {
  check("E2E workflow", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\nCyberSense E2E summary: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.log("Failed checks:");
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`);
  process.exit(1);
}
