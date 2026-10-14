import { getSql } from "@/lib/db";
import { newId } from "./ids.ts";
import { runPipeline } from "./pipeline.ts";
import { DEMO_AUTHORIZER, DEMO_DOMAIN } from "./demo/university.ts";
import type {
  AssessmentStatus,
  AssessmentSummary,
  OptimizationResult,
  ReportContent,
  SimulationResult,
  TwinSnapshot,
} from "./types.ts";

interface AssessmentRow {
  id: string;
  organization_id: string;
  target: string;
  mode: "DEMO" | "LIVE";
  status: AssessmentStatus;
  current_stage: string;
  authorized: boolean;
  authorization_id: string | null;
  stage_log: unknown;
  snapshot: unknown;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  org_name?: string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function snapshotOf(row: AssessmentRow): TwinSnapshot | null {
  return parseJson<TwinSnapshot | null>(row.snapshot, null);
}

export async function audit(action: string, assessmentId: string | null, details: Record<string, string>): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into audit_logs (id, assessment_id, action, request_id, details) values ($1,$2,$3,$4,$5::jsonb)`,
    [newId("aud"), assessmentId, action, newId("req"), JSON.stringify(details)],
  );
}

const SEED_REVISION = "3";
const SEED_IDS = ["asm_northshore_w1", "asm_northshore_w2", "asm_northshore_now"];

export async function ensureSeeded(): Promise<void> {
  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(`select id from organizations where id = $1`, ["org_northshore"]);
  if (!existing.length) {
    await sql.query(
      `insert into organizations (id, name, canonical_domain, sector) values ($1,$2,$3,$4)`,
      ["org_northshore", "Northshore State University", DEMO_DOMAIN, "Higher education (synthetic)"],
    );
  }
  const mark = await sql.query<{ details: unknown }>(
    `select details from audit_logs where action = 'seed_demo' order by created_at desc limit 1`,
  );
  const details = parseJson<Record<string, string>>(mark[0]?.details ?? {}, {});
  const have = await sql.query<{ id: string }>(`select id from assessments where id = $1`, ["asm_northshore_now"]);
  if (have.length && details.revision === SEED_REVISION) return;
  if (have.length) {
    for (const id of SEED_IDS) {
      await sql.query(`delete from assessments where id = $1`, [id]);
    }
  }

  const slices = [
    { id: "asm_northshore_w1", slice: "w1" as const, daysAgo: 21 },
    { id: "asm_northshore_w2", slice: "w2" as const, daysAgo: 14 },
    { id: "asm_northshore_now", slice: "now" as const, daysAgo: 0 },
  ];
  let previous: TwinSnapshot | null = null;
  for (const s of slices) {
    const now = new Date(Date.now() - s.daysAgo * 86400000).toISOString();
    const out = await runPipeline({
      assessmentId: s.id,
      target: DEMO_DOMAIN,
      mode: "DEMO",
      demoSlice: s.slice,
      previous,
      now,
      authorization: {
        target: DEMO_DOMAIN,
        authorizedBy: DEMO_AUTHORIZER,
        authorizationType: "SYNTHETIC_DEMO",
        confirmationText: "I confirm this target is authorized",
        now,
      },
    });
    await persistNewAssessment({
      id: s.id,
      organizationId: "org_northshore",
      target: DEMO_DOMAIN,
      mode: "DEMO",
      snapshot: out.snapshot,
      authorizationId: out.authorization.id,
      createdAt: now,
    });
    await sql.query(
      `insert into authorization_records
        (id, assessment_id, target, authorized_by, authorization_type, scope, start_time, end_time, allowed_modules, restrictions, confirmation_text, status)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12)`,
      [
        out.authorization.id,
        s.id,
        out.authorization.target,
        out.authorization.authorizedBy,
        out.authorization.authorizationType,
        JSON.stringify(out.authorization.scope),
        out.authorization.startTime,
        out.authorization.endTime,
        JSON.stringify(out.authorization.allowedModules),
        JSON.stringify(out.authorization.restrictions),
        out.authorization.confirmationText,
        out.authorization.status,
      ],
    );
    await sql.query(
      `insert into twin_snapshots (id, assessment_id, label, captured_at, immutable, snapshot)
       values ($1,$2,$3,$4,true,$5::jsonb)`,
      [out.snapshot.id, s.id, s.slice, now, JSON.stringify(out.snapshot)],
    );
    previous = out.snapshot;
  }
  await audit("seed_demo", "asm_northshore_now", { org: "northshore", revision: SEED_REVISION });
}

async function persistNewAssessment(args: {
  id: string;
  organizationId: string;
  target: string;
  mode: "DEMO" | "LIVE";
  snapshot: TwinSnapshot;
  authorizationId: string;
  createdAt: string;
}): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into assessments
      (id, organization_id, target, mode, status, current_stage, authorized, authorization_id, stage_log, snapshot, created_at, updated_at, completed_at)
     values ($1,$2,$3,$4,$5,$6,true,$7,$8::jsonb,$9::jsonb,$10,$10,$10)`,
    [
      args.id,
      args.organizationId,
      args.target,
      args.mode,
      args.snapshot.status,
      "ready",
      args.authorizationId,
      JSON.stringify(args.snapshot.stageLog),
      JSON.stringify(args.snapshot),
      args.createdAt,
    ],
  );
}

export async function listAssessments(): Promise<AssessmentSummary[]> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql.query<AssessmentRow & { org_name: string }>(
    `select a.*, o.name as org_name
     from assessments a join organizations o on o.id = a.organization_id
     order by a.created_at desc`,
  );
  return rows.map((r) => {
    const snap = snapshotOf(r);
    return {
      id: r.id,
      organizationName: r.org_name,
      target: r.target,
      mode: r.mode,
      status: r.status,
      currentStage: r.current_stage,
      overallScore: snap?.risk.overallScore ?? null,
      band: snap?.risk.band ?? null,
      confidence: snap?.risk.confidence ?? null,
      criticalPaths: snap?.risk.criticalPathCount ?? null,
      assetCount: snap?.assets.length ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    };
  });
}

export async function getAssessmentRow(id: string): Promise<AssessmentRow | null> {
  const sql = await getSql();
  const rows = await sql.query<AssessmentRow>(`select * from assessments where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getSnapshot(id: string): Promise<TwinSnapshot | null> {
  await ensureSeeded();
  const row = await getAssessmentRow(id);
  if (!row) return null;
  return snapshotOf(row);
}

export async function createAndRun(input: {
  target: string;
  authorizedBy: string;
  confirmationText: string;
  mode: "DEMO" | "LIVE";
}): Promise<{ id: string; snapshot: TwinSnapshot }> {
  await ensureSeeded();
  const sql = await getSql();
  const target = input.target.trim().toLowerCase();
  const isDemo = target === DEMO_DOMAIN || target.endsWith(`.${DEMO_DOMAIN}`);
  const orgId = isDemo ? "org_northshore" : newId("org");
  if (!isDemo) {
    await sql.query(
      `insert into organizations (id, name, canonical_domain, sector) values ($1,$2,$3,$4)
       on conflict (canonical_domain) do nothing`,
      [orgId, target, target, "Unknown"],
    );
  }
  const orgRows = await sql.query<{ id: string }>(`select id from organizations where canonical_domain = $1`, [
    isDemo ? DEMO_DOMAIN : target,
  ]);
  const organizationId = orgRows[0]?.id ?? orgId;
  const id = newId("asm");
  const previous = isDemo ? await getSnapshot("asm_northshore_now") : null;
  const out = await runPipeline({
    assessmentId: id,
    target: isDemo ? DEMO_DOMAIN : target,
    mode: isDemo ? "DEMO" : input.mode,
    demoSlice: "now",
    previous,
    authorization: {
      target: isDemo ? DEMO_DOMAIN : target,
      authorizedBy: input.authorizedBy,
      authorizationType: isDemo ? "SYNTHETIC_DEMO" : "OWNER",
      confirmationText: input.confirmationText,
    },
  });
  await persistNewAssessment({
    id,
    organizationId,
    target: isDemo ? DEMO_DOMAIN : target,
    mode: isDemo ? "DEMO" : input.mode,
    snapshot: out.snapshot,
    authorizationId: out.authorization.id,
    createdAt: new Date().toISOString(),
  });
  await sql.query(
    `insert into authorization_records
      (id, assessment_id, target, authorized_by, authorization_type, scope, start_time, end_time, allowed_modules, restrictions, confirmation_text, status)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12)`,
    [
      out.authorization.id,
      id,
      out.authorization.target,
      out.authorization.authorizedBy,
      out.authorization.authorizationType,
      JSON.stringify(out.authorization.scope),
      out.authorization.startTime,
      out.authorization.endTime,
      JSON.stringify(out.authorization.allowedModules),
      JSON.stringify(out.authorization.restrictions),
      out.authorization.confirmationText,
      out.authorization.status,
    ],
  );
  await sql.query(
    `insert into twin_snapshots (id, assessment_id, label, captured_at, immutable, snapshot)
     values ($1,$2,$3,$4,true,$5::jsonb)`,
    [out.snapshot.id, id, "current", out.snapshot.timestamp, JSON.stringify(out.snapshot)],
  );
  await audit("assessment_started", id, { target, mode: isDemo ? "DEMO" : input.mode });
  return { id, snapshot: out.snapshot };
}

export async function saveSimulation(sim: SimulationResult): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into simulations
      (id, assessment_id, name, control_ids, survivability, residual_risk, residual_band, before_risk, after_risk, removed_path_ids, surviving_path_ids, result)
     values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb)`,
    [
      sim.id,
      sim.assessmentId,
      sim.name,
      JSON.stringify(sim.controlIds),
      JSON.stringify(sim.survivability),
      sim.afterRisk,
      sim.afterBand,
      sim.beforeRisk,
      sim.afterRisk,
      JSON.stringify(sim.survivability.removedPathIds),
      JSON.stringify(sim.survivability.survivingPathIds),
      JSON.stringify(sim),
    ],
  );
  await audit("simulation_created", sim.assessmentId, { simulation_id: sim.id, controls: sim.controlIds.join(",") });
}

export async function listSimulations(assessmentId: string): Promise<SimulationResult[]> {
  const sql = await getSql();
  const rows = await sql.query<{ result: unknown }>(
    `select result from simulations where assessment_id = $1 order by created_at desc`,
    [assessmentId],
  );
  return rows.map((r) => parseJson<SimulationResult>(r.result, null as unknown as SimulationResult)).filter(Boolean);
}

export async function saveOptimization(opt: OptimizationResult): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into defense_optimizations (id, assessment_id, constraints, strategies, selected_strategy_id)
     values ($1,$2,$3::jsonb,$4::jsonb,$5)`,
    [opt.id, opt.assessmentId, JSON.stringify(opt.constraints), JSON.stringify(opt.strategies), opt.selectedStrategyId],
  );
  await audit("defense_strategy_generated", opt.assessmentId, { optimization_id: opt.id });
}

export async function listOptimizations(assessmentId: string): Promise<OptimizationResult[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    assessment_id: string;
    constraints: unknown;
    strategies: unknown;
    selected_strategy_id: string | null;
    created_at: string;
  }>(`select * from defense_optimizations where assessment_id = $1 order by created_at desc`, [assessmentId]);
  return rows.map((r) => ({
    id: r.id,
    assessmentId: r.assessment_id,
    constraints: parseJson(r.constraints, {
      budget: null,
      maxControls: 3,
      required: [],
      excluded: [],
      minimumRiskReduction: null,
    }),
    strategies: parseJson(r.strategies, []),
    selectedStrategyId: r.selected_strategy_id,
    createdAt: r.created_at,
  }));
}

export async function saveReport(assessmentId: string, content: ReportContent): Promise<string> {
  const sql = await getSql();
  const id = newId("rpt");
  await sql.query(
    `insert into reports (id, assessment_id, title, content) values ($1,$2,$3,$4::jsonb)`,
    [id, assessmentId, content.title, JSON.stringify(content)],
  );
  await audit("report_generated", assessmentId, { report_id: id });
  return id;
}

export async function listReports(assessmentId: string): Promise<{ id: string; title: string; createdAt: string; content: ReportContent }[]> {
  const sql = await getSql();
  const rows = await sql.query<{ id: string; title: string; created_at: string; content: unknown }>(
    `select id, title, created_at, content from reports where assessment_id = $1 order by created_at desc`,
    [assessmentId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    content: parseJson<ReportContent>(r.content, null as unknown as ReportContent),
  }));
}

export async function saveAiQuery(args: {
  id: string;
  assessmentId: string;
  question: string;
  audience: string;
  provider: string;
  response: unknown;
  rejected: boolean;
}): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into ai_queries (id, assessment_id, question, audience, provider, response, rejected)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [args.id, args.assessmentId, args.question, args.audience, args.provider, JSON.stringify(args.response), args.rejected],
  );
  await audit("ai_query_submitted", args.assessmentId, { ai_id: args.id, provider: args.provider });
}

export async function listAudit(assessmentId: string): Promise<{ id: string; action: string; details: Record<string, string>; createdAt: string }[]> {
  const sql = await getSql();
  const rows = await sql.query<{ id: string; action: string; details: Record<string, string> | string; created_at: string }>(
    `select id, action, details, created_at from audit_logs where assessment_id = $1 or $1 = 'all' order by created_at desc limit 200`,
    [assessmentId],
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    details: typeof r.details === "string" ? (JSON.parse(r.details) as Record<string, string>) : (r.details ?? {}),
    createdAt: r.created_at,
  }));
}

export async function listHistory(): Promise<TwinSnapshot[]> {
  await ensureSeeded();
  const ids = ["asm_northshore_w1", "asm_northshore_w2", "asm_northshore_now"];
  const out: TwinSnapshot[] = [];
  for (const id of ids) {
    const s = await getSnapshot(id);
    if (s) out.push(s);
  }
  return out;
}
