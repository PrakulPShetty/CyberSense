/**
 * Focused re-verification of the two console errors recorded in
 * screenshots/qa-results.json during the earlier audit phase.
 * Requires a dev server on http://127.0.0.1:8080.
 * Run: node reports/.evidence/harness/qa-reverify.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://127.0.0.1:8080";
const OUT = "reports/.evidence/reverify/";
mkdirSync(OUT, { recursive: true });

const rows = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const visit = async (label, path, file) => {
  errors = [];
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => document.body.innerText.trim());
  await page.screenshot({ path: OUT + file, fullPage: true });
  rows.push({
    label,
    path,
    renderedChars: text.length,
    errorCount: errors.length,
    errors: errors.map((e) => e.slice(0, 400)),
    hydrationMismatch: errors.some((e) => /Hydration failed/i.test(e)),
    invalidDateChild: errors.some((e) => /Objects are not valid as a React child[\s\S]*\[object Date\]/.test(e)),
  });
};

await visit("home", "/", "home.png");
await visit("twin", "/assessments/asm_northshore_now/twin", "twin.png");
await visit("audit", "/assessments/asm_northshore_now/audit", "audit.png");
await visit("executive", "/assessments/asm_northshore_now", "executive.png");

await browser.close();
writeFileSync(OUT + "reverify.json", JSON.stringify(rows, null, 2));
for (const r of rows) console.log(JSON.stringify({ label: r.label, renderedChars: r.renderedChars, errorCount: r.errorCount, hydrationMismatch: r.hydrationMismatch, invalidDateChild: r.invalidDateChild, errors: r.errors }));
console.log("REVERIFY_DONE");
