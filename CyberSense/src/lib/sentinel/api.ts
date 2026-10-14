import { createServerFn } from "@tanstack/react-start";
import {
  createAndRun,
  getSnapshot,
  listAssessments,
  listAudit,
  listHistory,
  listOptimizations,
  listReports,
  listSimulations,
  saveAiQuery,
  saveOptimization,
  saveReport,
  saveSimulation,
} from "./repo.ts";
import { simulateDefense, optimizeDefense, CONTROL_CATALOG } from "./defense.ts";
import { grokExplain } from "./ai.ts";
import { buildReport } from "./report.ts";
import { evaluateAuthorization } from "./authorization.ts";
import type { ControlId, OptimizationConstraints, TwinSnapshot } from "./types.ts";

export const healthFn = createServerFn({ method: "GET" }).handler(async () => ({
  status: "ok",
  service: "sentinel-x",
  time: new Date().toISOString(),
}));

export const readyFn = createServerFn({ method: "GET" }).handler(async () => {
  // Observed, not asserted: a hard-coded `database: true` reports readiness for
  // a database that was never contacted.
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("select 1 as ok");
    return { status: "ready" as const, database: true, checkedAt: new Date().toISOString() };
  } catch (err) {
    return {
      status: "unavailable" as const,
      database: false,
      error: err instanceof Error ? err.message : "database check failed",
      checkedAt: new Date().toISOString(),
    };
  }
});

export const listAssessmentsFn = createServerFn({ method: "GET" }).handler(async () => listAssessments());

export const getAssessmentFn = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const snap = await getSnapshot(data.id);
    if (!snap) throw new Error("ASSESSMENT_NOT_FOUND");
    return snap;
  });

export const previewAuthorizationFn = createServerFn({ method: "POST" })
  .validator((input: { target: string; authorizedBy: string; confirmationText: string }) => input)
  .handler(async ({ data }) => evaluateAuthorization({ ...data, authorizationType: "OWNER" }));

export const createAssessmentFn = createServerFn({ method: "POST" })
  .validator((input: { target: string; authorizedBy: string; confirmationText: string; mode: "DEMO" | "LIVE" }) => input)
  .handler(async ({ data }) => createAndRun(data));

export const listControlsFn = createServerFn({ method: "GET" }).handler(async () => CONTROL_CATALOG);

export const runSimulationFn = createServerFn({ method: "POST" })
  .validator((input: { assessmentId: string; controlIds: ControlId[]; name?: string }) => input)
  .handler(async ({ data }) => {
    const snap = await getSnapshot(data.assessmentId);
    if (!snap) throw new Error("ASSESSMENT_NOT_FOUND");
    const sim = simulateDefense({
      assessmentId: data.assessmentId,
      name: data.name ?? data.controlIds.join(" + "),
      controls: data.controlIds,
      graph: snap.graph,
      paths: snap.paths,
      assets: snap.assets,
      evidence: snap.evidence,
      now: new Date().toISOString(),
    });
    await saveSimulation(sim);
    return sim;
  });

export const listSimulationsFn = createServerFn({ method: "GET" })
  .validator((input: { assessmentId: string }) => input)
  .handler(async ({ data }) => listSimulations(data.assessmentId));

export const optimizeFn = createServerFn({ method: "POST" })
  .validator((input: { assessmentId: string; constraints: OptimizationConstraints }) => input)
  .handler(async ({ data }) => {
    const snap = await getSnapshot(data.assessmentId);
    if (!snap) throw new Error("ASSESSMENT_NOT_FOUND");
    const opt = optimizeDefense({
      assessmentId: data.assessmentId,
      graph: snap.graph,
      paths: snap.paths,
      assets: snap.assets,
      evidence: snap.evidence,
      constraints: data.constraints,
      now: new Date().toISOString(),
    });
    await saveOptimization(opt);
    return opt;
  });

export const listOptimizationsFn = createServerFn({ method: "GET" })
  .validator((input: { assessmentId: string }) => input)
  .handler(async ({ data }) => listOptimizations(data.assessmentId));

export const explainFn = createServerFn({ method: "POST" })
  .validator((input: { assessmentId: string; question: string; audience: "executive" | "engineer" }) => input)
  .handler(async ({ data }) => {
    const snap = await getSnapshot(data.assessmentId);
    if (!snap) throw new Error("ASSESSMENT_NOT_FOUND");
    const sims = await listSimulations(data.assessmentId);
    const result = await grokExplain(snap, data.question, data.audience, sims);
    await saveAiQuery({
      id: result.id,
      assessmentId: data.assessmentId,
      question: data.question,
      audience: data.audience,
      provider: result.provider,
      response: result.explanation,
      rejected: result.rejected,
    });
    return result;
  });

export const generateReportFn = createServerFn({ method: "POST" })
  .validator((input: { assessmentId: string }) => input)
  .handler(async ({ data }) => {
    const snap = await getSnapshot(data.assessmentId);
    if (!snap) throw new Error("ASSESSMENT_NOT_FOUND");
    const sims = await listSimulations(data.assessmentId);
    const content = buildReport(snap, sims);
    const id = await saveReport(data.assessmentId, content);
    return { id, content };
  });

export const listReportsFn = createServerFn({ method: "GET" })
  .validator((input: { assessmentId: string }) => input)
  .handler(async ({ data }) => listReports(data.assessmentId));

export const listAuditFn = createServerFn({ method: "GET" })
  .validator((input: { assessmentId: string }) => input)
  .handler(async ({ data }) => listAudit(data.assessmentId));

export const historyFn = createServerFn({ method: "GET" }).handler(async () => {
  const snaps = await listHistory();
  return snaps.map((s) => ({
    id: s.assessmentId,
    timestamp: s.timestamp,
    score: s.risk.overallScore,
    band: s.risk.band,
    criticalPaths: s.risk.criticalPathCount,
    publicAssets: s.assets.filter((a) => a.exposureState === "PUBLIC").length,
    momentum: s.momentum,
  }));
});

export type { TwinSnapshot };
