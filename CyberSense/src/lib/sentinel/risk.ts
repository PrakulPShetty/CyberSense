import { CRITICALITY_POINTS, RISK_FACTOR_MAX, riskBand, round0, round1 } from "./scoring.ts";
import { stableId } from "./ids.ts";
import type {
  Asset,
  AttackGraph,
  AttackPath,
  EvidenceGap,
  EvidenceRecord,
  RiskAssessment,
  RiskFactor,
  UncertaintyContribution,
  UncertaintyReport,
  VerificationTask,
} from "./types.ts";

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function factor(id: string, name: string, points: number, max: number, rationale: string): RiskFactor {
  return { id, name, points: round1(points), max, rationale };
}

export function scorePath(
  path: AttackPath,
  graph: AttackGraph,
  assets: Asset[],
  evidence: EvidenceRecord[],
  pathCountTouchingDest: number,
): { score: number; factors: RiskFactor[] } {
  const dest = assets.find((a) => a.id === path.destinationAssetId);
  const crit = dest ? CRITICALITY_POINTS[dest.criticality] : 8;
  const exposure = 16;
  const impact = dest?.criticality === "CRITICAL" ? 18 : dest?.criticality === "HIGH" ? 13 : 7;
  const edges = path.edgeIds.map((id) => graph.edges.find((e) => e.id === id)!).filter(Boolean);
  const avgDiff = mean(edges.map((e) => e.difficulty));
  const barriers = RISK_FACTOR_MAX.barriers * (1 - avgDiff / 100);
  const ev = evidence.filter((e) => path.evidenceIds.includes(e.id));
  const evConf = ev.length ? mean(ev.map((e) => e.evidenceConfidence)) : path.confidence;
  const evidencePts = RISK_FACTOR_MAX.evidence * evConf;
  const depth = RISK_FACTOR_MAX.depth * Math.max(0, 1 - (path.nodeIds.length - 2) / 6);
  const convergence = Math.min(RISK_FACTOR_MAX.convergence, pathCountTouchingDest * 1.4);
  const factors = [
    factor("criticality", "Asset criticality", crit, RISK_FACTOR_MAX.criticality, `Destination criticality ${dest?.criticality ?? "UNKNOWN"}`),
    factor("exposure", "External exposure", exposure, RISK_FACTOR_MAX.exposure, "Path originates at INTERNET"),
    factor("impact", "Path impact", impact, RISK_FACTOR_MAX.impact, dest?.criticality === "CRITICAL" ? "Crown-jewel destination" : "Non-jewel destination"),
    factor("barriers", "Barrier weakness", barriers, RISK_FACTOR_MAX.barriers, `Mean modeled difficulty ${round0(avgDiff)}/100`),
    factor("evidence", "Evidence confidence", evidencePts, RISK_FACTOR_MAX.evidence, `Mean evidence confidence ${round0(evConf * 100)}%`),
    factor("depth", "Path depth", depth, RISK_FACTOR_MAX.depth, `${path.nodeIds.length} hops (shallower is easier)`),
    factor("convergence", "Path convergence", convergence, RISK_FACTOR_MAX.convergence, `${pathCountTouchingDest} modeled paths share this destination`),
  ];
  const score = Math.min(100, round0(factors.reduce((s, f) => s + f.points, 0)));
  return { score, factors };
}

/**
 * Organizational posture is not the mean of the worst paths.
 * A single crown-jewel path is serious at the path layer; landscape score
 * mixes peak severity with linear path, public-surface, and shadow counts
 * so a thin twin does not look identical to a dense one after path search saturates.
 */
export function landscapeScore(paths: AttackPath[], assets: Asset[]): number {
  const peak = paths.reduce((m, p) => Math.max(m, p.risk), 0);
  const publicN = assets.filter((a) => a.exposureState === "PUBLIC" && a.type !== "organization").length;
  const shadowN = assets.filter((a) => a.ownershipState === "POTENTIAL_SHADOW").length;
  const raw = 18 + 0.24 * peak + 0.7 * paths.length + 0.45 * publicN + 1.35 * shadowN;
  return Math.min(100, Math.max(8, round0(raw)));
}

export function buildRisk(
  assessmentId: string,
  graph: AttackGraph,
  paths: AttackPath[],
  assets: Asset[],
  evidence: EvidenceRecord[],
  now: string,
): RiskAssessment {
  const destCounts = new Map<string, number>();
  for (const p of paths) destCounts.set(p.destinationAssetId, (destCounts.get(p.destinationAssetId) ?? 0) + 1);

  const breakdowns = paths.map((p) => {
    const { score, factors } = scorePath(p, graph, assets, evidence, destCounts.get(p.destinationAssetId) ?? 1);
    p.risk = score;
    return { pathId: p.id, score, band: riskBand(score), factors };
  });

  const criticalPaths = paths.filter((p) => p.crownJewel && p.risk >= 80);
  const highPaths = paths.filter((p) => p.risk >= 60);
  const overallScore = landscapeScore(paths, assets);
  const confidence = paths.length ? round0(mean(paths.map((p) => p.confidence)) * 100) / 100 : 0.4;
  const uncertainty = round1(1 - confidence);
  const evidenceQuality = evidence.length
    ? round1(mean(evidence.map((e) => e.evidenceConfidence)))
    : 0.3;
  const jewels = assets.filter((a) => a.criticality === "CRITICAL");
  const reachable = jewels.filter((j) => paths.some((p) => p.destinationAssetId === j.id)).length;
  const crownJewelReachability = jewels.length ? round1(reachable / jewels.length) : 0;

  const rollup = new Map<string, { points: number; max: number; name: string }>();
  for (const b of breakdowns) {
    for (const f of b.factors) {
      const cur = rollup.get(f.id) ?? { points: 0, max: f.max, name: f.name };
      cur.points += f.points;
      rollup.set(f.id, cur);
    }
  }
  const n = Math.max(1, breakdowns.length);
  const factors: RiskFactor[] = [...rollup.entries()].map(([id, v]) =>
    factor(id, v.name, v.points / n, v.max, "Mean contribution across modeled paths"),
  );

  return {
    id: stableId("risk", assessmentId),
    assessmentId,
    overallScore,
    band: riskBand(overallScore),
    confidence,
    uncertainty,
    evidenceQuality,
    // No modeled path means nothing was scored. Reporting the landscape floor
    // (18 / LOW) for an empty twin reads as "this target is fine", which the
    // evidence does not support.
    insufficientEvidence: paths.length === 0,
    factors,
    pathBreakdowns: breakdowns,
    criticalPathCount: criticalPaths.length,
    highPathCount: highPaths.length,
    crownJewelReachability,
    generatedAt: now,
  };
}

export function buildUncertainty(
  assessmentId: string,
  paths: AttackPath[],
  graph: AttackGraph,
  evidence: EvidenceRecord[],
): UncertaintyReport {
  const pathContributions: Record<string, UncertaintyContribution[]> = {};
  const missing: string[] = [];
  const stale = evidence.filter((e) => e.stale).map((e) => e.id);
  const conflicting: string[] = [];

  for (const p of paths) {
    const edges = p.edgeIds.map((id) => graph.edges.find((e) => e.id === id)!).filter(Boolean);
    const contrib: UncertaintyContribution[] = edges.map((e) => ({
      subjectId: e.id,
      subjectType: "EDGE" as const,
      share: round1((1 - e.confidence) / Math.max(0.01, edges.reduce((s, x) => s + (1 - x.confidence), 0))),
      reason: `${e.type} ${e.kind.toLowerCase()} confidence ${round0(e.confidence * 100)}%`,
    }));
    contrib.sort((a, b) => b.share - a.share);
    pathContributions[p.id] = contrib;
    for (const e of edges) {
      if (e.kind !== "OBSERVED" || e.confidence < 0.6) {
        missing.push(`Additional corroboration for ${e.type} ${e.id}`);
      }
    }
  }

  const overall = paths.length ? round1(mean(paths.map((p) => p.uncertainty))) : 0.5;
  return {
    assessmentId,
    overall,
    pathContributions,
    missingEvidence: [...new Set(missing)].slice(0, 12),
    staleEvidenceIds: stale,
    conflicting,
  };
}

export function buildEvidenceGaps(
  assessmentId: string,
  paths: AttackPath[],
  graph: AttackGraph,
  uncertainty: UncertaintyReport,
): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  for (const p of paths) {
    const top = (uncertainty.pathContributions[p.id] ?? []).slice(0, 2);
    for (const c of top) {
      if (c.share < 0.18) continue;
      const edge = graph.edges.find((e) => e.id === c.subjectId);
      if (!edge) continue;
      gaps.push({
        id: stableId("eg", assessmentId, p.id, c.subjectId),
        assessmentId,
        pathIds: [p.id],
        relationshipId: edge.relationshipId,
        currentConfidence: edge.confidence,
        potentialImprovement: round1(Math.min(0.4, (1 - edge.confidence) * 0.7)),
        affectedRisk: p.risk,
        priority: p.crownJewel ? "HIGH" : "MEDIUM",
        recommendedVerification: `Verify the ${edge.kind.toLowerCase()} ${edge.type} relationship used by ${p.displayId}.`,
        candidateSources: edge.kind === "INFERRED" ? ["repository_metadata", "deployment_inventory"] : ["authenticated_inventory", "dns"],
      });
    }
  }
  const merged = new Map<string, EvidenceGap>();
  for (const g of gaps) {
    const key = g.relationshipId ?? g.id;
    const ex = merged.get(key);
    if (!ex) merged.set(key, g);
    else ex.pathIds = [...new Set([...ex.pathIds, ...g.pathIds])];
  }
  return [...merged.values()].sort((a, b) => b.potentialImprovement * b.affectedRisk - a.potentialImprovement * a.affectedRisk);
}

export function buildVerificationTasks(
  assessmentId: string,
  paths: AttackPath[],
  shadow: { assetId: string }[],
  gaps: EvidenceGap[],
): VerificationTask[] {
  const tasks: VerificationTask[] = [];
  for (const p of paths) {
    if (p.recommendationClass === "MONITOR") continue;
    tasks.push({
      id: stableId("vt", assessmentId, p.id),
      assessmentId,
      title:
        p.recommendationClass === "REMEDIATE"
          ? `Remediate modeled path ${p.displayId}`
          : `Verify uncertain path ${p.displayId}`,
      recommendationClass: p.recommendationClass,
      status: "UNVERIFIED",
      evidenceIds: p.evidenceIds,
      pathIds: [p.id],
      notes: p.assumptions[0] ?? null,
    });
  }
  if (shadow.length) {
    tasks.push({
      id: stableId("vt", assessmentId, "shadow"),
      assessmentId,
      title: "Verify potential shadow assets against known inventory",
      recommendationClass: "VERIFY",
      status: "NEEDS_REVIEW",
      evidenceIds: [],
      pathIds: [],
      notes: "POTENTIAL SHADOW ASSET — REQUIRES VERIFICATION",
    });
  }
  for (const g of gaps.slice(0, 4)) {
    tasks.push({
      id: stableId("vt", assessmentId, g.id),
      assessmentId,
      title: g.recommendedVerification,
      recommendationClass: "VERIFY",
      status: "UNVERIFIED",
      evidenceIds: [],
      pathIds: g.pathIds,
      notes: `Potential confidence +${round0(g.potentialImprovement * 100)}%`,
    });
  }
  return tasks;
}
