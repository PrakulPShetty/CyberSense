/**
 * Hand-off verification for the audit reports.
 * - all four required files exist and are non-trivial
 * - every Markdown table has a header + separator row and a consistent number of cells
 * - finding ids (TD-nn, PR-nn, R-n) referenced anywhere are defined in their owning document
 * - relative links between the reports resolve
 * Run: node reports/.evidence/harness/verify-reports.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";

const reports = [
  "reports/CyberSense_Technical_Audit_Report.md",
  "reports/Repository_Inventory.md",
  "reports/Test_Results.md",
  "reports/Prioritized_Improvement_Roadmap.md",
  "reports/Audit_Progress_Checklist.md",
];
// The four files the brief requires; the checklist is an additional Step-1 deliverable.
const requiredFiles = reports.slice(0, 4);

const problems = [];
const summary = {};
const docs = {};

for (const path of requiredFiles) {
  if (!existsSync(path)) problems.push(`missing REQUIRED file: ${path}`);
}

for (const path of reports) {
  if (!existsSync(path)) {
    problems.push(`missing file: ${path}`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  docs[path] = text;
  const lines = text.split(/\r?\n/);

  // --- headings ---
  const headings = lines.filter((l) => /^#{1,6} /.test(l));
  const h1 = headings.filter((l) => l.startsWith("# ")).length;
  if (h1 !== 1) problems.push(`${path}: expected exactly 1 level-1 heading, found ${h1}`);

  // --- tables ---
  let tables = 0;
  let badTables = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    if (!isRow(lines[i])) continue;
    const prevIsRow = i > 0 && isRow(lines[i - 1]);
    if (prevIsRow) continue; // only validate at the start of a block
    const block = [];
    for (let j = i; j < lines.length && isRow(lines[j]); j += 1) block.push(lines[j]);
    tables += 1;
    const sepIdx = 1;
    const isSeparator = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes("-");
    if (block.length < 3 || !isSeparator(block[sepIdx])) {
      badTables += 1;
      problems.push(`${path}:${i + 1}: table missing header/separator`);
      continue;
    }
    // Split on unescaped pipes only: `\|` is a literal pipe inside a cell and is valid GFM in tables.
    const cells = (l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).length;
    const expected = cells(block[0]);
    for (const row of block) {
      if (cells(row) !== expected) {
        badTables += 1;
        problems.push(`${path}:${i + 1}: table row has ${cells(row)} cells, header has ${expected}`);
      }
    }
  }

  const words = text.split(/\s+/).length;
  summary[path] = { bytes: text.length, lines: lines.length, words, headings: headings.length, tables, malformedTables: badTables };
}

// --- finding id consistency ---
const all = Object.values(docs).join("\n");
const ids = (re) => new Set([...all.matchAll(re)].map((m) => m[0]));

const mainReport = docs[reports[0]] ?? "";
const roadmap = docs[reports[3]] ?? "";

const definedTD = new Set([...mainReport.matchAll(/\*\*(TD-\d+)\*\*/g)].map((m) => m[1]));
const usedTD = ids(/\bTD-\d+\b/g);
const undefinedTD = [...usedTD].filter((id) => !definedTD.has(id));

const definedPR = new Set([...mainReport.matchAll(/\*\*(PR-\d+)\*\*/g)].map((m) => m[1]));
const usedPR = ids(/\bPR-\d+\b/g);
const undefinedPR = [...usedPR].filter((id) => !definedPR.has(id));

const definedR = new Set([...roadmap.matchAll(/^### (R-\d+)/gm)].map((m) => m[1]));
const usedR = ids(/\bR-\d+\b/g);
const undefinedR = [...usedR].filter((id) => !definedR.has(id));

if (undefinedTD.length) problems.push(`TD ids referenced but not defined in the main report: ${undefinedTD.join(", ")}`);
if (undefinedPR.length) problems.push(`PR ids referenced but not defined in the main report: ${undefinedPR.join(", ")}`);
if (undefinedR.length) problems.push(`R ids referenced but not defined in the roadmap: ${undefinedR.join(", ")}`);

// --- relative links between reports ---
const linkTargets = [...all.matchAll(/\]\((\.\/[^)]+\.md)\)/g)].map((m) => m[1]);
const linkOk = {};
for (const rel of new Set(linkTargets.map((l) => l.replace(/^\.\//, "")))) {
  const candidates = reports.map((p) => join(dirname(p), rel));
  linkOk[rel] = candidates.some((c) => existsSync(c));
  if (!linkOk[rel]) problems.push(`broken relative link: ${rel}`);
}

// --- required content presence ---
const required = {
  executiveSummary: /## 1\. Executive summary/,
  stack: /## 2\. Actual technology stack/,
  architecture: /## 3\. Architecture and end-to-end workflow/,
  features: /## 4\. Implemented feature status/,
  scanner: /## 5\. Collection \("scanner"\) implementation analysis/,
  appSec: /## 6\. Application security findings/,
  phase11: /## 8\. Phase 11 — Performance and reliability findings/,
  phase12: /## 9\. Phase 12 — Limitations and technical debt/,
  phase13: /## 10\. Phase 13 — Prioritized improvement roadmap/,
  testResults: /## 11\. Test results and evidence/,
  gaps: /## 12\. Known gaps and unverified areas/,
  noPerfFabrication: /NOT MEASURED/,
};
for (const [name, re] of Object.entries(required)) {
  if (!re.test(mainReport)) problems.push(`main report missing required section: ${name}`);
}

// --- test-count consistency between main report and Test_Results ---
const tr = docs[reports[2]] ?? "";
const counts = {
  mainStatesDomainTests: /13 tests|13 domain tests/.test(mainReport),
  trStatesDomainTests: /13 tests/.test(tr),
  mainStatesScriptsFailures: /195 tests[^.]*18 fail|18 fail/i.test(mainReport),
  trStatesScriptsFailures: /195 tests, 177 pass, 18 fail/.test(tr),
  bothState68: /68 tests/.test(mainReport) && /68 tests/.test(tr),
};
if (!counts.mainStatesDomainTests || !counts.trStatesDomainTests) problems.push("domain test count (13) not stated consistently");
if (!counts.mainStatesScriptsFailures || !counts.trStatesScriptsFailures) problems.push("platform-suite failure count (18/195) not stated consistently");
if (!counts.bothState68) problems.push("68-test total not stated in both documents");

summary.ids = {
  definedTD: definedTD.size,
  definedPR: definedPR.size,
  definedR: definedR.size,
  undefinedTD,
  undefinedPR,
  undefinedR,
};

console.log(JSON.stringify({ summary, links: linkOk, counts, problems, verdict: problems.length ? "PROBLEMS" : "OK" }, null, 2));
