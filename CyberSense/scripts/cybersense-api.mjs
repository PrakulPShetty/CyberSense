#!/usr/bin/env node
/**
 * CyberSense server-function API harness (dev-server client).
 *
 * The UI talks to the app through TanStack Start server functions. This script
 * speaks the same wire protocol from Node so the persistence and security
 * verification runs can assert on real API data (not only rendered text):
 *
 *   - discovers each function's dev-mode id from the transformed module the
 *     client browser loads (`/src/lib/**\/*.ts` contains `createClientRpc("<id>")`),
 *   - serializes requests with seroval (`toJSONAsync`) exactly like the client,
 *   - deserializes responses with `fromCrossJSON` when `x-tss-serialized` is set,
 *   - replays the same-origin CSRF expectations (`Origin` header).
 *
 * Usage:
 *   node scripts/cybersense-api.mjs list-scans | get-scan <id> | ...
 */
import { toJSONAsync, fromCrossJSON } from "seroval";
import { defaultSerovalPlugins } from "@tanstack/router-core";

const base = (process.env.CYBERSENSE_E2E_BASE ?? "http://127.0.0.1:8080").replace(/\/+$/, "");

/** module file (relative, dev) -> { exportName: functionId } discovered from the dev bundle. */
async function discoverIds(modulePath) {
  const res = await fetch(`${base}${modulePath}`);
  if (!res.ok) throw new Error(`cannot load ${modulePath}: HTTP ${res.status}`);
  const text = await res.text();
  const ids = {};
  const re = /createClientRpc\("([^"]+)"\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const decoded = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    ids[decoded.export] = m[1];
  }
  return ids;
}

let idCache = null;
async function ids() {
  if (!idCache) {
    const [a11y, security] = await Promise.all([
      discoverIds("/src/lib/a11y/api.ts"),
      discoverIds("/src/lib/security/api.ts"),
    ]);
    idCache = { a11y, security };
  }
  return idCache;
}

async function call(group, exportName, payload, method) {
  const all = await ids();
  const fnId = all[group][exportName];
  if (!fnId) throw new Error(`server function ${group}.${exportName} not found`);
  const headers = { "x-tsr-serverFn": "true", Origin: base };
  const body = payload === undefined ? undefined : JSON.stringify(await toJSONAsync(payload));
  if (method === "POST") headers["content-type"] = "application/json";
  const url = method === "GET" && body !== undefined
    ? `${base}/_serverFn/${fnId}?payload=${encodeURIComponent(body)}`
    : `${base}/_serverFn/${fnId}`;
  const res = await fetch(url, { method, headers, body: method === "POST" ? body : undefined, signal: AbortSignal.timeout(240_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`server function ${exportName} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  if (res.headers.get("x-tss-serialized")) {
    const parsed = fromCrossJSON(JSON.parse(text), { plugins: defaultSerovalPlugins });
    // The wire format is the { result, error, context } envelope; callers want result.
    if (parsed && typeof parsed === "object" && "error" in parsed && "context" in parsed && "result" in parsed) {
      if (parsed.error) throw parsed.error;
      return parsed.result;
    }
    return parsed;
  }
  return text ? JSON.parse(text) : null;
}

export const a11y = {
  runScan: (url) => call("a11y", "runA11yScanFn_createServerFn_handler", { data: { url } }, "POST"),
  listScans: () => call("a11y", "listA11yScansFn_createServerFn_handler", undefined, "GET"),
  getScan: (id) => call("a11y", "getA11yScanFn_createServerFn_handler", { data: { id } }, "GET"),
  explain: (scanId, findingId) => call("a11y", "explainA11yFindingFn_createServerFn_handler", { data: { scanId, findingId } }, "POST"),
  report: (scanId) => call("a11y", "generateA11yReportFn_createServerFn_handler", { data: { scanId } }, "POST"),
  compare: (baseId, laterId) => call("a11y", "compareA11yScansFn_createServerFn_handler", { data: { baseId, laterId } }, "POST"),
  recommendations: (scanId) => call("a11y", "a11yRecommendationsFn_createServerFn_handler", { data: { scanId } }, "POST"),
};

export const security = {
  runChecks: (url) => call("security", "runSecurityChecksFn_createServerFn_handler", { data: { url } }, "POST"),
  listChecks: () => call("security", "listSecurityChecksFn_createServerFn_handler", undefined, "GET"),
  getCheck: (id) => call("security", "getSecurityCheckFn_createServerFn_handler", { data: { id } }, "GET"),
  explain: (id, checkId) => call("security", "explainSecurityCheckFn_createServerFn_handler", { data: { id, checkId } }, "POST"),
  recommendations: (id) => call("security", "securityRecommendationsFn_createServerFn_handler", { data: { id } }, "POST"),
  report: (id) => call("security", "generateSecurityReportFn_createServerFn_handler", { data: { id } }, "POST"),
};

/** Minimal CLI so a human can poke the API while verifying. */
if (process.argv[1] && process.argv[1].endsWith("cybersense-api.mjs")) {
  const [cmd, ...args] = process.argv.slice(2);
  const table = { ...a11y, ...security };
  const fn = table[cmd];
  if (!fn) {
    console.error(`usage: node scripts/cybersense-api.mjs <${Object.keys(table).join("|")}> [args]`);
    process.exit(2);
  }
  const out = await fn(...args);
  console.log(JSON.stringify(out, null, 2));
}
