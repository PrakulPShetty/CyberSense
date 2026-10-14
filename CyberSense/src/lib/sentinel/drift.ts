import { round0, round1 } from "./scoring.ts";
import { stableId } from "./ids.ts";
import type {
  DriftEvent,
  DriftReport,
  ExposureMomentum,
  MomentumComponent,
  ShadowAsset,
  TwinSnapshot,
} from "./types.ts";

export function detectShadow(snap: TwinSnapshot): ShadowAsset[] {
  return snap.assets
    .filter((a) => a.ownershipState === "POTENTIAL_SHADOW")
    .map((a) => {
      const connectivity = snap.relationships.filter((r) => r.sourceAssetId === a.id || r.targetAssetId === a.id).length;
      const pathImpact = snap.paths.filter((p) => p.nodeIds.some((n) => n === `node_${a.id}`)).length;
      const crit =
        a.criticality === "CRITICAL" ? 4 : a.criticality === "HIGH" ? 3 : a.criticality === "MEDIUM" ? 2 : 1;
      const rankScore = round1(crit * 8 + connectivity * 3 + pathImpact * 6 + a.confidence * 10);
      return {
        assetId: a.id,
        reason: "POTENTIAL SHADOW ASSET — REQUIRES VERIFICATION. Present in discovery, absent from known inventory.",
        rankScore,
        requiresVerification: true,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
}

export function computeDrift(previous: TwinSnapshot, current: TwinSnapshot): DriftReport {
  const events: DriftEvent[] = [];
  const prevAssets = new Map(previous.assets.map((a) => [a.canonicalId, a]));
  const curAssets = new Map(current.assets.map((a) => [a.canonicalId, a]));

  for (const [id, a] of curAssets) {
    if (!prevAssets.has(id)) {
      events.push({
        id: stableId("dr", current.assessmentId, "new", id),
        type: "NEW_ASSET",
        summary: `New asset observed: ${a.displayName}`,
        details: `${a.type} · ${a.exposureState}`,
        subjectIds: [a.id],
        previousValue: null,
        currentValue: a.displayName,
      });
      if (a.exposureState === "PUBLIC") {
        events.push({
          id: stableId("dr", current.assessmentId, "exp", id),
          type: "NEW_EXPOSURE",
          summary: `New public exposure: ${a.displayName}`,
          details: "Asset is reachable from INTERNET in the current twin.",
          subjectIds: [a.id],
          previousValue: "absent",
          currentValue: "PUBLIC",
        });
      }
    }
  }
  for (const [id, a] of prevAssets) {
    if (!curAssets.has(id)) {
      events.push({
        id: stableId("dr", current.assessmentId, "rm", id),
        type: "REMOVED_ASSET",
        summary: `Asset no longer observed: ${a.displayName}`,
        details: "Missing from current discovery. This is not confirmation of remediation.",
        subjectIds: [a.id],
        previousValue: a.displayName,
        currentValue: null,
      });
    }
  }

  const prevRels = new Set(previous.relationships.map((r) => `${r.type}:${r.sourceAssetId}:${r.targetAssetId}`));
  const curRels = new Set(current.relationships.map((r) => `${r.type}:${r.sourceAssetId}:${r.targetAssetId}`));
  for (const key of curRels) {
    if (!prevRels.has(key)) {
      events.push({
        id: stableId("dr", current.assessmentId, "nr", key),
        type: "NEW_RELATIONSHIP",
        summary: `New relationship ${key.split(":")[0]}`,
        details: key,
        subjectIds: [],
        previousValue: null,
        currentValue: key,
      });
    }
  }

  const prevPaths = previous.paths.length;
  const curPaths = current.paths.length;
  if (curPaths > prevPaths) {
    events.push({
      id: stableId("dr", current.assessmentId, "np"),
      type: "NEW_ATTACK_PATH",
      summary: `Modeled attack paths increased ${prevPaths} → ${curPaths}`,
      details: "New paths were generated from newly observed or inferred relationships.",
      subjectIds: current.paths.map((p) => p.id),
      previousValue: String(prevPaths),
      currentValue: String(curPaths),
    });
  } else if (curPaths < prevPaths) {
    events.push({
      id: stableId("dr", current.assessmentId, "rp"),
      type: "REMOVED_ATTACK_PATH",
      summary: `Modeled attack paths decreased ${prevPaths} → ${curPaths}`,
      details: "Paths missing from the current twin.",
      subjectIds: [],
      previousValue: String(prevPaths),
      currentValue: String(curPaths),
    });
  }

  const prevRisk = previous.risk.overallScore;
  const curRisk = current.risk.overallScore;
  if (curRisk > prevRisk) {
    events.push({
      id: stableId("dr", current.assessmentId, "ri"),
      type: "RISK_INCREASE",
      summary: `Risk increased ${prevRisk} → ${curRisk}`,
      details: "",
      subjectIds: [],
      previousValue: String(prevRisk),
      currentValue: String(curRisk),
    });
  } else if (curRisk < prevRisk) {
    events.push({
      id: stableId("dr", current.assessmentId, "rd"),
      type: "RISK_REDUCTION",
      summary: `Risk decreased ${prevRisk} → ${curRisk}`,
      details: "",
      subjectIds: [],
      previousValue: String(prevRisk),
      currentValue: String(curRisk),
    });
  }

  const newPublic = events.filter((e) => e.type === "NEW_EXPOSURE" || e.type === "NEW_ASSET").map((e) => e.summary);
  const causal =
    curRisk > prevRisk
      ? `Risk increased from ${prevRisk} to ${curRisk} because ${newPublic.slice(0, 3).join("; ") || "new modeled relationships"} created additional paths toward crown-jewel applications.`
      : curRisk < prevRisk
        ? `Risk decreased from ${prevRisk} to ${curRisk} as modeled paths and exposures contracted.`
        : `Risk held at ${curRisk}. Underlying assets may still have drifted.`;

  const ri = events.find((e) => e.type === "RISK_INCREASE" || e.type === "RISK_REDUCTION");
  if (ri) ri.details = causal;

  return {
    previousAssessmentId: previous.assessmentId,
    currentAssessmentId: current.assessmentId,
    events,
    causalExplanation: causal,
    previousRisk: prevRisk,
    currentRisk: curRisk,
  };
}

/**
 * SENTINEL-X Exposure Momentum — project metric, not an industry standard.
 * Positive score = exposure becoming more dangerous.
 */
export function computeMomentum(previous: TwinSnapshot | null, current: TwinSnapshot): ExposureMomentum {
  const label = "SENTINEL-X Exposure Momentum" as const;
  if (!previous) {
    return {
      score: 0,
      direction: "STABLE",
      components: [],
      asOf: current.timestamp,
      previousAssessmentId: null,
      label,
    };
  }
  const components: MomentumComponent[] = [
    {
      id: "assets",
      name: "Externally visible assets",
      delta: current.assets.filter((a) => a.exposureState === "PUBLIC").length - previous.assets.filter((a) => a.exposureState === "PUBLIC").length,
      weight: 0.2,
      contribution: 0,
    },
    {
      id: "services",
      name: "Exposed services",
      delta: current.assets.filter((a) => a.type === "service" || a.type === "authentication_endpoint").length -
        previous.assets.filter((a) => a.type === "service" || a.type === "authentication_endpoint").length,
      weight: 0.15,
      contribution: 0,
    },
    {
      id: "paths",
      name: "Critical modeled paths",
      delta: current.risk.criticalPathCount - previous.risk.criticalPathCount,
      weight: 0.25,
      contribution: 0,
    },
    {
      id: "jewels",
      name: "Crown-jewel reachability",
      delta: round1(current.risk.crownJewelReachability - previous.risk.crownJewelReachability),
      weight: 0.2,
      contribution: 0,
    },
    {
      id: "uncertainty",
      name: "Uncertainty",
      delta: round1(current.uncertainty.overall - previous.uncertainty.overall),
      weight: 0.1,
      contribution: 0,
    },
    {
      id: "high",
      name: "High-risk findings",
      delta: current.risk.highPathCount - previous.risk.highPathCount,
      weight: 0.1,
      contribution: 0,
    },
  ];
  for (const c of components) c.contribution = round1(c.delta * c.weight * 20);
  const score = round0(components.reduce((s, c) => s + c.contribution, 0));
  const direction = score >= 8 ? "DETERIORATING" : score <= -8 ? "IMPROVING" : "STABLE";
  return {
    score,
    direction,
    components,
    asOf: current.timestamp,
    previousAssessmentId: previous.assessmentId,
    label,
  };
}
