/**
 * SENTINEL-X Phase 11 harness — performance & reliability.
 *
 * Runs ONLY against the local synthetic DEMO corpus (demo-university.edu) plus
 * INJECTED adapter failures (a stubbed global fetch). It performs no network
 * traffic to any target, so it is safe to run repeatedly.
 *
 * Run: node --expose-gc --experimental-strip-types reports/.evidence/harness/perf-reliability.mjs
 */
import { runPipeline } from "../../../src/lib/sentinel/pipeline.ts";
import { dohAdapter, runAdapters } from "../../../src/lib/sentinel/osint.ts";
import { optimizeDefense, simulateDefense } from "../../../src/lib/sentinel/defense.ts";
import { buildReport } from "../../../src/lib/sentinel/report.ts";

const log = (step, data) => console.log(JSON.stringify({ step, ...data }));
const time = async (fn) => {
  const a = process.hrtime.bigint();
  const value = await fn();
  return { ms: Number(process.hrtime.bigint() - a) / 1e6, value };
};
const r1 = (n) => Math.round(n * 10) / 10;

const auth = {
  target: "demo-university.edu",
  authorizedBy: "phase11-harness",
  authorizationType: "SYNTHETIC_DEMO",
  confirmationText: "I confirm this target is authorized",
};
const run = (id, extra = {}) =>
  runPipeline({ assessmentId: id, target: "demo-university.edu", mode: "DEMO", demoSlice: "now", authorization: auth, ...extra });

// ---------------------------------------------------------------- A. concurrency
const N = 12;
const warm = await run("asm_h_warm");
const serial = await time(async () => {
  for (let i = 0; i < N; i += 1) await run(`asm_h_serial_${i}`, { previous: warm.snapshot });
});
const concurrent = await time(() =>
  Promise.all(Array.from({ length: N }, (_, i) => run(`asm_h_par_${i}`, { previous: warm.snapshot }))),
);
log("concurrency", {
  runs: N,
  serialMs: r1(serial.ms),
  concurrentMs: r1(concurrent.ms),
  serialPerRunMs: r1(serial.ms / N),
  concurrentPerRunMs: r1(concurrent.ms / N),
  speedup: r1(serial.ms / concurrent.ms),
  allCompleted: concurrent.value.every((o) => o.snapshot.status === "COMPLETED"),
  identicalScores: new Set(concurrent.value.map((o) => o.snapshot.risk.overallScore)).size === 1,
});

// ---------------------------------------------------------------- B. memory
global.gc?.();
const heap0 = process.memoryUsage().heapUsed;
const retained = [];
for (let i = 0; i < 60; i += 1) retained.push((await run(`asm_h_mem_${i}`)).snapshot);
global.gc?.();
const heapRetained = process.memoryUsage().heapUsed;
const oneSnapshotBytes = JSON.stringify(retained[0]).length;
retained.length = 0;
global.gc?.();
const heapFreed = process.memoryUsage().heapUsed;
log("memory", {
  gcExposed: typeof global.gc === "function",
  runs: 60,
  heapBaselineMb: r1(heap0 / 1048576),
  heapWith60SnapshotsMb: r1(heapRetained / 1048576),
  heapAfterReleaseMb: r1(heapFreed / 1048576),
  deltaPerRetainedSnapshotKb: r1((heapRetained - heap0) / 60 / 1024),
  snapshotJsonBytes: oneSnapshotBytes,
});

// ---------------------------------------------------------------- C. repeat-scan determinism
const FIXED_NOW = "2026-10-14T00:00:00.000Z";
const strip = (v) =>
  JSON.parse(
    JSON.stringify(v, (k, val) =>
      k === "id" || k.endsWith("Id") || k.endsWith("Ids") || k === "displayId" || k === "assessmentId" || k === "timestamp" || k === "startedAt" || k === "completedAt" || k === "generatedAt"
        ? undefined
        : val,
    ),
  );
const a = await runPipeline({ assessmentId: "asm_det_a", target: "demo-university.edu", mode: "DEMO", demoSlice: "now", now: FIXED_NOW, authorization: { ...auth, now: FIXED_NOW } });
const b = await runPipeline({ assessmentId: "asm_det_b", target: "demo-university.edu", mode: "DEMO", demoSlice: "now", now: FIXED_NOW, authorization: { ...auth, now: FIXED_NOW } });
log("repeat_scan_determinism", {
  sameScore: a.snapshot.risk.overallScore === b.snapshot.risk.overallScore,
  sameAssets: a.snapshot.assets.length === b.snapshot.assets.length,
  samePaths: a.snapshot.paths.length === b.snapshot.paths.length,
  sameEvidence: a.snapshot.evidence.length === b.snapshot.evidence.length,
  structurallyEqualIgnoringIds: JSON.stringify(strip(a.snapshot)) === JSON.stringify(strip(b.snapshot)),
  score: a.snapshot.risk.overallScore,
});

// ---------------------------------------------------------------- D. injected source failures
const realFetch = globalThis.fetch;
const dohCtx = (abortMs) => ({ assessmentId: "asm_h_doh", target: "example.com", now: new Date().toISOString(), abortMs });

const fakeResponse = (ok, status, body) => ({ ok, status, json: async () => body });

globalThis.fetch = async () => {
  throw new TypeError("fetch failed: ECONNREFUSED (injected)");
};
const netErr = await time(() => dohAdapter.execute(dohCtx(4000)));
log("inject_network_error", { ms: r1(netErr.ms), status: netErr.value.run.status, errorClass: netErr.value.run.errorClass, observations: netErr.value.observations.length, notes: netErr.value.run.notes });

globalThis.fetch = async () => fakeResponse(false, 503, {});
const httpErr = await time(() => dohAdapter.execute(dohCtx(4000)));
log("inject_http_503", { ms: r1(httpErr.ms), status: httpErr.value.run.status, errorClass: httpErr.value.run.errorClass, message: httpErr.value.run.errorMessage });

globalThis.fetch = (url, opts) =>
  new Promise((_resolve, reject) => {
    opts?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })));
  });
const timeout = await time(() => dohAdapter.execute(dohCtx(4000)));
log("inject_hang_timeout", { ms: r1(timeout.ms), status: timeout.value.run.status, errorClass: timeout.value.run.errorClass, notes: timeout.value.run.notes });

globalThis.fetch = async () => fakeResponse(false, 500, {});
const throwingAdapter = {
  sourceName: "throwing_adapter",
  sourceType: "test",
  capabilities: [],
  requiredCredentials: [],
  async execute() {
    throw new Error("adapter blew up");
  },
  async healthCheck() {
    return { sourceName: "throwing_adapter", ok: false, detail: "n/a" };
  },
};
const mixed = await runAdapters({ assessmentId: "asm_h_mixed", target: "example.com", now: new Date().toISOString(), abortMs: 4000 }, [dohAdapter, throwingAdapter]);
log("adapter_isolation", {
  threw: false,
  runs: mixed.map((m) => ({ name: m.run.sourceName, status: m.run.status, errorClass: m.run.errorClass, observations: m.run.observationCount })),
});

// LIVE mode against an unreachable/failing source (fetch still stubbed to 500).
const liveFail = await runPipeline({
  assessmentId: "asm_h_live_fail",
  target: "example.com",
  mode: "LIVE",
  now: new Date().toISOString(),
  authorization: { target: "example.com", authorizedBy: "phase11-harness", authorizationType: "OWNER", confirmationText: "I confirm this target is authorized" },
});
log("live_source_failure_pipeline", {
  status: liveFail.snapshot.status,
  assets: liveFail.snapshot.assets.length,
  paths: liveFail.snapshot.paths.length,
  overallScore: liveFail.snapshot.risk.overallScore,
  band: liveFail.snapshot.risk.band,
  confidence: liveFail.snapshot.risk.confidence,
  sourceRuns: liveFail.snapshot.sourceRuns.map((s) => ({ name: s.sourceName, status: s.status, errorClass: s.errorClass })),
  stageStates: [...new Set(liveFail.snapshot.stageLog.map((s) => s.status))],
});

globalThis.fetch = realFetch;

// ---------------------------------------------------------------- E. optimizer scaling
const snap = (await run("asm_h_opt")).snapshot;
const optTimes = {};
for (const max of [1, 2, 3]) {
  const t = await time(() =>
    optimizeDefense({
      assessmentId: snap.assessmentId,
      graph: snap.graph,
      paths: snap.paths,
      assets: snap.assets,
      evidence: snap.evidence,
      constraints: { budget: null, maxControls: max, required: [], excluded: [], minimumRiskReduction: null },
      now: snap.timestamp,
    }),
  );
  optTimes[`maxControls_${max}`] = { ms: r1(t.ms), strategies: t.value.strategies.length };
}
const capped = optimizeDefense({
  assessmentId: snap.assessmentId,
  graph: snap.graph,
  paths: snap.paths,
  assets: snap.assets,
  evidence: snap.evidence,
  constraints: { budget: null, maxControls: 8, required: [], excluded: [], minimumRiskReduction: null },
  now: snap.timestamp,
});
log("optimizer_scaling", { catalogSize: 10, times: optTimes, requestedMax8_clampedTo: Math.max(...capped.strategies.map((s) => s.controlCount)) });

log("simulate_single", { ms: r1((await time(() => simulateDefense({ assessmentId: snap.assessmentId, name: "MFA", controls: ["MFA"], graph: snap.graph, paths: snap.paths, assets: snap.assets, evidence: snap.evidence, now: snap.timestamp }))).ms) });
log("report_build", { ms: r1((await time(() => buildReport(snap, []))).ms), chars: buildReport(snap, []).sections.length });

// ---------------------------------------------------------------- F. stage log / observability
const zeroDuration = snap.stageLog.filter((s) => s.startedAt === s.completedAt).length;
log("stage_log", {
  stages: snap.stageLog.length,
  completed: snap.stageLog.filter((s) => s.status === "COMPLETED").length,
  stagesWithZeroDuration: zeroDuration,
  distinctStartedAt: new Set(snap.stageLog.map((s) => s.startedAt)).size,
  firstStartedAt: snap.stageLog[0].startedAt,
  snapshotTimestamp: snap.timestamp,
});

// simulator "before" value vs the deterministic posture score
const sim = simulateDefense({ assessmentId: snap.assessmentId, name: "MFA", controls: ["MFA"], graph: snap.graph, paths: snap.paths, assets: snap.assets, evidence: snap.evidence, now: snap.timestamp });
log("simulator_before_value", { snapshotOverallScore: snap.risk.overallScore, simulationBeforeRisk: sim.beforeRisk, afterRisk: sim.afterRisk, delta: snap.risk.overallScore - sim.beforeRisk });

console.log("HARNESS_DONE");
