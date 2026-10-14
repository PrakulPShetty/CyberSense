/**
 * End-to-end UI flow timing for the SENTINEL-X assessment workflow.
 *
 * Every number is measured with an element-state wait (`waitForURL` /
 * `waitForSelector`), never a fixed `waitForTimeout`, so it reflects the app's
 * real response time rather than the script's sleep.
 *
 * Requires a dev server on http://127.0.0.1:8080.
 * Run: node reports/.evidence/harness/measure-flows.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://127.0.0.1:8080";
const OUT = "reports/.evidence/reverify/";
mkdirSync(OUT, { recursive: true });
const rows = [];
const now = () => Number(process.hrtime.bigint()) / 1e6;
const record = (row) => {
  rows.push(row);
  console.log(JSON.stringify(row));
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const step = async (name, fn) => {
  errors = [];
  const t = now();
  try {
    const extra = (await fn()) ?? {};
    record({ step: name, ok: true, ms: Math.round(now() - t), consoleErrors: errors.length, ...extra });
  } catch (e) {
    record({ step: name, ok: false, ms: Math.round(now() - t), consoleErrors: errors.length, error: String(e.message ?? e).slice(0, 300) });
  }
};

let id = "asm_northshore_now";

await step("create_assessment_e2e", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.fill("#target", "demo-university.edu");
  await page.fill("#who", "audit-verify");
  await page.fill("#conf", "I confirm this target is authorized for synthetic assessment");
  await page.getByRole("button", { name: /Authorize and run/i }).click();
  await page.waitForURL(/\/assessments\/asm_/, { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  id = (page.url().match(/asm_[a-z0-9_]+/i) || [id])[0];
  return { id };
});

await step("report_generate_e2e", async () => {
  await page.goto(`${BASE}/assessments/${id}/reports`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: /Generate report/i }).click();
  await page.waitForSelector("text=SENTINEL-X assessment report", { timeout: 60000 });
  return { includesDbWrite: true };
});

await step("assistant_ask_e2e", async () => {
  await page.goto(`${BASE}/assessments/${id}/assistant`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: /^Ask$/ }).click();
  await page.waitForSelector("text=Biggest modeled weakness", { timeout: 60000 });
  const body = await page.locator("body").innerText();
  return { provider: body.match(/(grok|deterministic)/i)?.[0] ?? "unknown" };
});

await step("optimize_e2e", async () => {
  await page.goto(`${BASE}/assessments/${id}/optimize`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: /Find strategies/i }).click();
  await page.waitForSelector("text=Strategy 1:", { timeout: 60000 });
  return { usesPageDefaults: "budget=40,maxControls=3" };
});

await step("simulate_mfa_e2e", async () => {
  await page.goto(`${BASE}/assessments/${id}/simulate`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: /Apply to cloned graph/i }).click();
  await page.waitForSelector("text=Risk before", { timeout: 60000 });
  const body = await page.locator("body").innerText();
  return { sawResidual: /Residual/.test(body) };
});

await page.screenshot({ path: OUT + "flow-final.png", fullPage: true });
await browser.close();
writeFileSync(OUT + "flow-timings.json", JSON.stringify(rows, null, 2));
console.log("MEASURE_DONE");
