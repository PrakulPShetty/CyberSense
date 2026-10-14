#!/usr/bin/env node
/**
 * Cross-platform browser QA for SENTINEL-X.
 *
 * The bundled `scripts/browser-smoke.mjs` guard only permits outputs under
 * `/workspace` (a Linux sandbox path) and therefore cannot run on this Windows
 * workstation. This harness performs the same class of check — does the route
 * render visible content, and is the console clean — for a list of routes, on
 * desktop and mobile, and writes its evidence next to the other audit evidence.
 *
 * Usage:  node reports/.evidence/harness/browser-qa.mjs [--base http://127.0.0.1:8080]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "qa");

const argv = process.argv.slice(2);
const baseArg = argv.indexOf("--base");
const BASE = baseArg >= 0 ? argv[baseArg + 1] : "http://127.0.0.1:8080";

const ASSESSMENT = "asm_northshore_now";
const ROUTES = [
  ["home", "/"],
  ["executive", `/assessments/${ASSESSMENT}`],
  ["technical", `/assessments/${ASSESSMENT}/technical`],
  ["assets", `/assessments/${ASSESSMENT}/assets`],
  ["evidence", `/assessments/${ASSESSMENT}/evidence`],
  ["twin", `/assessments/${ASSESSMENT}/twin`],
  ["graph", `/assessments/${ASSESSMENT}/graph`],
  ["paths", `/assessments/${ASSESSMENT}/paths`],
  ["risk", `/assessments/${ASSESSMENT}/risk`],
  ["uncertainty", `/assessments/${ASSESSMENT}/uncertainty`],
  ["simulate", `/assessments/${ASSESSMENT}/simulate`],
  ["optimize", `/assessments/${ASSESSMENT}/optimize`],
  ["drift", `/assessments/${ASSESSMENT}/drift`],
  ["momentum", `/assessments/${ASSESSMENT}/momentum`],
  ["assistant", `/assessments/${ASSESSMENT}/assistant`],
  ["reports", `/assessments/${ASSESSMENT}/reports`],
  ["audit", `/assessments/${ASSESSMENT}/audit`],
  ["a11y-demo-fixture", "/a11y-demo"],
  ["accessibility", "/accessibility"],
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

/** Bundled Chromium first, then a locally installed Chrome/Edge. */
async function launch() {
  const attempts = [
    ["bundled-chromium", { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
    ["channel:chrome", { headless: true, channel: "chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
    ["channel:msedge", { headless: true, channel: "msedge", args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
  ];
  const failures = [];
  for (const [label, opts] of attempts) {
    try {
      const browser = await chromium.launch(opts);
      return { browser, browserSource: label, failures };
    } catch (err) {
      failures.push(`${label}: ${err?.message?.split("\n")[0]}`);
    }
  }
  throw new Error(`no Chromium available — ${failures.join(" | ")}`);
}

const { browser, browserSource, failures } = await launch();
mkdirSync(OUT_DIR, { recursive: true });

const results = {};
for (const vp of VIEWPORTS) {
  for (const [name, path] of ROUTES) {
    const consoleErrors = [];
    const pageErrors = [];
    const entry = { url: BASE + path, viewport: vp.name };
    let page;
    try {
      page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
      const resp = await page.goto(entry.url, { waitUntil: "load", timeout: 60000 });
      entry.status = resp?.status() ?? 0;
      // Wait for React to adopt the server HTML before judging the console: on a
      // cold dev server the client bundle lands seconds after the HTML, and an
      // error raised before hydration is a compile artifact, not an app defect.
      entry.hydrated = await page
        .waitForFunction(
          () => {
            const tsr = window.$_TSR;
            return tsr === undefined || tsr.hydrated === true;
          },
          undefined,
          { timeout: 30000, polling: 250 },
        )
        .then(() => true)
        .catch(() => false);
      await page.waitForTimeout(400);
      entry.title = await page.title();
      const bodyText = await page.locator("body").innerText().catch(() => "");
      entry.bodyTextLen = bodyText.replace(/\s+/g, " ").trim().length;
      entry.bodyTextSample = bodyText.replace(/\s+/g, " ").trim().slice(0, 300);
      entry.horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      entry.consoleErrors = consoleErrors;
      entry.pageErrors = pageErrors;
      entry.screenshot = join(OUT_DIR, `${vp.name}-${name}.png`);
      await page.screenshot({ path: entry.screenshot, fullPage: false });
    } catch (err) {
      entry.error = String(err?.message || err);
      entry.consoleErrors = consoleErrors;
      entry.pageErrors = pageErrors;
    } finally {
      await page?.close();
    }
    results[`${vp.name}:${name}`] = entry;
  }
}

await browser.close();

const summary = Object.entries(results).map(([key, r]) => ({
  key,
  status: r.status,
  bodyTextLen: r.bodyTextLen,
  horizontalOverflow: r.horizontalOverflow,
  consoleErrors: r.consoleErrors?.length ?? 0,
  pageErrors: r.pageErrors?.length ?? 0,
  error: r.error,
}));

writeFileSync(join(OUT_DIR, "qa-results.json"), JSON.stringify({ base: BASE, browserSource, launchFailures: failures, results }, null, 2));
console.log(JSON.stringify({ browserSource, launchFailures: failures, summary }, null, 2));
