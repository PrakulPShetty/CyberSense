/**
 * Why two identical-input DEMO runs are not byte-identical: report the exact
 * differing JSON paths (after removing volatile id fields).
 * Run: node --experimental-strip-types reports/.evidence/harness/determinism-diff.mjs
 */
import { runPipeline } from "../../../src/lib/sentinel/pipeline.ts";

const auth = { target: "demo-university.edu", authorizedBy: "determinism-diff", authorizationType: "SYNTHETIC_DEMO", confirmationText: "I confirm this target is authorized" };
const FIXED_NOW = "2026-10-14T00:00:00.000Z";
const volatile = new Set(["id", "displayId", "assessmentId", "timestamp", "startedAt", "completedAt", "generatedAt"]);

const strip = (obj) => {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (volatile.has(k) || k.endsWith("Id") || k.endsWith("Ids")) continue;
    const v = obj[k];
    out[k] = v && typeof v === "object" ? JSON.parse(JSON.stringify(v, (key, val) => (volatile.has(key) || key.endsWith("Id") || key.endsWith("Ids") ? undefined : val))) : v;
  }
  return out;
};

const runOne = (id) =>
  runPipeline({ assessmentId: id, target: "demo-university.edu", mode: "DEMO", demoSlice: "now", now: FIXED_NOW, authorization: { ...auth, now: FIXED_NOW } });

const a = (await runOne("asm_d1")).snapshot;
const b = (await runOne("asm_d2")).snapshot;
const A = strip(a);
const B = strip(b);

const diffs = [];
const walk = (x, y, path) => {
  const tx = x === null ? "null" : typeof x;
  const ty = y === null ? "null" : typeof y;
  if (tx !== ty) return diffs.push({ path, a: x, b: y });
  if (tx === "object") {
    const keys = new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})]);
    for (const k of keys) walk(x?.[k], y?.[k], path ? `${path}.${k}` : k);
    return;
  }
  if (x !== y) diffs.push({ path, a: x, b: y });
};

walk(A, B, "");
console.log(JSON.stringify({ differingPaths: diffs.slice(0, 25), total: diffs.length }, null, 2));
console.log(JSON.stringify({ authorizationStartTimeVsSnapshot: { authStartTime: a.authorization.startTime, snapshotTimestamp: a.timestamp }, pipelineNow: FIXED_NOW }));
