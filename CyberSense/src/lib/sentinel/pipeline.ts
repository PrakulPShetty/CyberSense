import { evaluateAuthorization, type AuthorizationInput } from "./authorization.ts";
import { resolveAssets } from "./assets.ts";
import { buildEvidence } from "./evidence.ts";
import { buildRelationships } from "./relationships.ts";
import { applyPathEvidenceLinks, buildAttackGraph, generateAttackPaths } from "./graph.ts";
import { buildEvidenceGaps, buildRisk, buildUncertainty, buildVerificationTasks } from "./risk.ts";
import { computeDrift, computeMomentum, detectShadow } from "./drift.ts";
import { mockAdapter, runAdapters, dohAdapter } from "./osint.ts";
import { DEMO_DOMAIN } from "./normalize.ts";
import { KNOWN_INVENTORY, NORTHSHORE, type DemoSlice } from "./demo/university.ts";
import { newId } from "./ids.ts";
import type {
  AssessmentStatus,
  AuthorizationRecord,
  PipelineStage,
  SourceRun,
  StageLogEntry,
  TwinSnapshot,
} from "./types.ts";
import { PIPELINE_STAGES } from "./types.ts";

export interface PipelineInput {
  assessmentId: string;
  target: string;
  mode: "DEMO" | "LIVE";
  authorization: AuthorizationInput;
  demoSlice?: DemoSlice;
  previous?: TwinSnapshot | null;
  now?: string;
}

export interface PipelineOutput {
  snapshot: TwinSnapshot;
  authorization: AuthorizationRecord;
  status: AssessmentStatus;
}

function stageLog(now: string): StageLogEntry[] {
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    status: "PENDING" as const,
    startedAt: null,
    completedAt: null,
    detail: null,
  }));
}

function complete(log: StageLogEntry[], stage: PipelineStage, now: string, detail: string): void {
  const row = log.find((s) => s.stage === stage);
  if (!row) return;
  row.status = "COMPLETED";
  row.startedAt = row.startedAt ?? now;
  row.completedAt = now;
  row.detail = detail;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const now = input.now ?? new Date().toISOString();
  const log = stageLog(now);
  const decision = evaluateAuthorization(input.authorization);
  if (!decision.ok) {
    const emptyAuth: AuthorizationRecord = {
      id: newId("auth"),
      assessmentId: input.assessmentId,
      target: input.target,
      authorizedBy: input.authorization.authorizedBy,
      authorizationType: input.authorization.authorizationType,
      scope: { domains: [], modules: [], passiveOnly: true },
      startTime: now,
      endTime: null,
      allowedModules: [],
      restrictions: [],
      confirmationText: input.authorization.confirmationText,
      status: "DENIED",
    };
    throw Object.assign(new Error(decision.message), { error_code: decision.error_code, authorization: emptyAuth });
  }
  const authorization: AuthorizationRecord = { ...decision.record, assessmentId: input.assessmentId };
  complete(log, "authorization", now, "Authorization granted (passive/synthetic only)");
  complete(log, "source_planning", now, input.mode === "DEMO" ? "mock_osint" : "mock_osint + cloudflare_doh");

  const adapters = input.mode === "DEMO" || input.target.endsWith(DEMO_DOMAIN) || input.target === DEMO_DOMAIN
    ? [mockAdapter]
    : [mockAdapter, dohAdapter];

  const results = await runAdapters(
    {
      assessmentId: input.assessmentId,
      target: input.target,
      now,
      demoSlice: input.demoSlice ?? "now",
      abortMs: 4000,
    },
    adapters,
  );
  const sourceRuns: SourceRun[] = results.map((r) => r.run);
  const raw = results.flatMap((r) => r.observations);
  const anyFailed = sourceRuns.some((s) => s.status === "FAILED" || s.status === "UNAVAILABLE");
  complete(
    log,
    "collection",
    now,
    `${raw.length} raw observations from ${sourceRuns.length} source(s)${anyFailed ? " (partial)" : ""}`,
  );

  const { assets, observations } = resolveAssets(input.assessmentId, input.target, raw, now);
  complete(log, "normalization", now, `${assets.length} canonical assets`);
  complete(log, "asset_resolution", now, `${assets.filter((a) => a.ownershipState === "POTENTIAL_SHADOW").length} potential shadow assets`);

  const evidence = buildEvidence(input.assessmentId, observations, now);
  complete(log, "evidence", now, `${evidence.length} evidence records`);

  const relationships = buildRelationships(input.assessmentId, assets, observations, evidence);
  complete(log, "relationships", now, `${relationships.length} typed relationships`);

  const graph = buildAttackGraph(input.assessmentId, assets, relationships, now);
  complete(log, "attack_graph", now, `${graph.nodes.length} nodes / ${graph.edges.length} edges`);

  const paths = generateAttackPaths(input.assessmentId, graph, assets);
  applyPathEvidenceLinks(paths, evidence);
  complete(log, "attack_paths", now, `${paths.length} modeled paths`);

  const risk = buildRisk(input.assessmentId, graph, paths, assets, evidence, now);
  complete(log, "risk", now, `score ${risk.overallScore} ${risk.band}`);

  const uncertainty = buildUncertainty(input.assessmentId, paths, graph, evidence);
  const evidenceGaps = buildEvidenceGaps(input.assessmentId, paths, graph, uncertainty);
  complete(log, "uncertainty", now, `uncertainty ${uncertainty.overall}`);

  const snapshot: TwinSnapshot = {
    id: newId("twin"),
    assessmentId: input.assessmentId,
    timestamp: now,
    organization: input.target.includes(DEMO_DOMAIN) ? NORTHSHORE : {
      id: newId("org"),
      name: input.target,
      canonicalDomain: input.target,
      sector: "Unknown",
    },
    target: input.target,
    mode: input.mode,
    status: anyFailed && paths.length === 0 ? "PARTIAL" : "COMPLETED",
    authorization,
    sourceRuns,
    assets,
    observations,
    evidence,
    relationships,
    graph,
    paths,
    risk,
    uncertainty,
    evidenceGaps,
    verificationTasks: [],
    shadowAssets: [],
    knownInventory: input.target.includes(DEMO_DOMAIN) ? KNOWN_INVENTORY : [],
    momentum: null,
    drift: null,
    stageLog: log,
  };

  snapshot.shadowAssets = detectShadow(snapshot);
  snapshot.verificationTasks = buildVerificationTasks(
    input.assessmentId,
    paths,
    snapshot.shadowAssets,
    evidenceGaps,
  );
  snapshot.momentum = computeMomentum(input.previous ?? null, snapshot);
  snapshot.drift = input.previous ? computeDrift(input.previous, snapshot) : null;
  complete(log, "exposure_twin", now, "Immutable snapshot captured");
  complete(log, "momentum", now, snapshot.momentum.direction);
  complete(log, "ready", now, "Dashboard ready");

  if (raw.length === 0) snapshot.status = "PARTIAL";
  return { snapshot, authorization, status: snapshot.status };
}
