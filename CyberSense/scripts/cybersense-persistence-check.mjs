#!/usr/bin/env node
/**
 * CyberSense restart-persistence check.
 *
 * Verifies that a saved accessibility scan (and its history entry) survives a
 * full dev-server restart when the configured database is persistent. Two
 * phases, run around a restart of the normal dev procedure:
 *
 *   # before restart (scan must already exist — run via the app or e2e first)
 *   node scripts/cybersense-persistence-check.mjs record <scanId>
 *   # ... stop the dev server, start it again with the same env ...
 *   node scripts/cybersense-persistence-check.mjs verify <scanId>
 *
 * `record` snapshots the full scan record, the history list, and the PDF
 * report's identifying fields; `verify` re-fetchs them after restart and
 * compares everything. Exit code 0 = persistence verified.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { a11y } from "./cybersense-api.mjs";

const SNAPSHOT = join(tmpdir(), "cybersense-persistence-snapshot.json");

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function fingerprint(scan) {
  return createHash("sha256").update(JSON.stringify(scan)).digest("hex");
}

/** Fields that must be byte-identical across a restart. */
function compareScans(before, after, label) {
  const problems = [];
  if (before.id !== after.id) problems.push(`id ${before.id} → ${after.id}`);
  if (before.url !== after.url) problems.push(`url ${before.url} → ${after.url}`);
  if (before.hostname !== after.hostname) problems.push("hostname changed");
  if (before.scannedAt !== after.scannedAt) problems.push(`scannedAt ${before.scannedAt} → ${after.scannedAt}`);
  if (before.status !== after.status) problems.push(`status ${before.status} → ${after.status}`);
  if (JSON.stringify(before.summary) !== JSON.stringify(after.summary)) problems.push("summary changed");
  if (JSON.stringify(before.violations) !== JSON.stringify(after.violations)) problems.push("violations/evidence changed");
  if (JSON.stringify(before.incomplete) !== JSON.stringify(after.incomplete)) problems.push("incomplete changed");
  if (JSON.stringify(before.passes) !== JSON.stringify(after.passes)) problems.push("passes changed");
  if (before.page.finalUrl !== after.page.finalUrl) problems.push("page.finalUrl changed");
  check(`${label}: scan record identical after restart`, problems.length === 0, problems.join("; ") || `sha256 ${fingerprint(after).slice(0, 16)}`);
}

async function fetchAll(scanId) {
  const scan = await a11y.getScan(scanId);
  const list = await a11y.listScans();
  const report = await a11y.report(scanId);
  return { scan, list, report };
}

const [phase, scanIdArg] = process.argv.slice(2);
if (!phase || !scanIdArg) {
  console.error("usage: node scripts/cybersense-persistence-check.mjs <record|verify> <scanId>");
  process.exit(2);
}

let data;
try {
  data = await fetchAll(scanIdArg);
} catch (err) {
  console.error(`FAIL - could not reach the running app: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (phase === "record") {
  const okScan = Boolean(data.scan) && data.scan.id === scanIdArg;
  check("pre-restart: scan is retrievable by id", okScan, okScan ? `status ${data.scan.status}` : "record missing");
  const inList = (Array.isArray(data.list) ? data.list : []).some((s) => s.id === scanIdArg);
  check("pre-restart: scan appears in history", inList);
  writeFileSync(SNAPSHOT, JSON.stringify({ scanId: scanIdArg, scan: data.scan, list: data.list, reportBase64Len: data.report?.base64?.length ?? 0, reportFilename: data.report?.filename ?? null }, null, 2));
  console.log(`snapshot written: ${SNAPSHOT}`);
} else if (phase === "verify") {
  if (!existsSync(SNAPSHOT)) {
    console.error(`FAIL - no snapshot found at ${SNAPSHOT}; run the record phase before restarting.`);
    process.exit(1);
  }
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  if (snapshot.scanId !== scanIdArg) {
    console.error(`FAIL - snapshot is for ${snapshot.scanId}, not ${scanIdArg}`);
    process.exit(1);
  }
  check("post-restart: scan is retrievable by id", Boolean(data.scan), data.scan ? `status ${data.scan.status}` : "record missing");
  if (data.scan) compareScans(snapshot.scan, data.scan, "post-restart");
  const inList = (Array.isArray(data.list) ? data.list : []).some((s) => s.id === scanIdArg);
  check("post-restart: scan appears in history", inList);
  const reportOk = Boolean(data.report?.base64) && data.report.filename === snapshot.reportFilename;
  check("post-restart: PDF report still generates for the scan", reportOk, data.report?.filename ?? "no report");
  const buf = Buffer.from(data.report?.base64 ?? "", "base64");
  const validPdf = buf.subarray(0, 5).toString("latin1") === "%PDF-";
  check("post-restart: PDF is a valid %PDF document", validPdf, `${buf.length} bytes`);
  const pdfText = buf.toString("latin1");
  check("post-restart: PDF contains the scan id and target", pdfText.includes(scanIdArg) && pdfText.includes(snapshot.scan.url), `${snapshot.scan.url}`);
} else {
  console.error(`unknown phase ${phase}`);
  process.exit(2);
}

const failed = checks.filter((c) => !c.ok);
console.log(`\nPersistence check (${phase}): ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
