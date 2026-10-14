import type { ReportContent, SimulationResult, TwinSnapshot } from "./types.ts";

export function buildReport(snap: TwinSnapshot, simulations: SimulationResult[]): ReportContent {
  const top = [...snap.paths].sort((a, b) => b.risk - a.risk).slice(0, 5);
  const sections: ReportContent["sections"] = [
    {
      heading: "Authorization scope",
      body: snap.authorization
        ? `Target ${snap.authorization.target} authorized by ${snap.authorization.authorizedBy} (${snap.authorization.authorizationType}). Passive only. Restrictions: ${snap.authorization.restrictions.join("; ")}.`
        : "No authorization record.",
      references: snap.authorization ? [snap.authorization.id] : [],
    },
    {
      heading: "Security posture",
      body: snap.risk.insufficientEvidence
        ? `No posture score is reported: no modeled path exists for this twin. Confidence ${Math.round(snap.risk.confidence * 100)}%. Absence of observed exposure is not evidence of low risk.`
        : `Modeled posture ${snap.risk.overallScore} (${snap.risk.band}). Confidence ${Math.round(snap.risk.confidence * 100)}%. Uncertainty ${Math.round(snap.risk.uncertainty * 100)}%. ${snap.risk.criticalPathCount} critical modeled paths. Risk is not confidence.`,
      references: [snap.risk.id],
    },
    {
      heading: "Exposure summary",
      body: `${snap.assets.length} assets, ${snap.assets.filter((a) => a.exposureState === "PUBLIC").length} public, ${snap.shadowAssets.length} potential shadow assets requiring verification, ${snap.relationships.length} relationships, ${snap.evidence.length} evidence records.`,
      references: snap.shadowAssets.map((s) => s.assetId).slice(0, 6),
    },
    {
      heading: "Critical modeled paths",
      body: top.map((p) => `${p.displayId} risk ${p.risk} confidence ${Math.round(p.confidence * 100)}% (${p.kind}): ${p.summary}`).join("\n"),
      references: top.map((p) => p.id),
    },
    {
      heading: "Uncertainty and verification",
      body: snap.evidenceGaps.slice(0, 5).map((g) => g.recommendedVerification).join(" ") || "No ranked evidence gaps.",
      references: snap.evidenceGaps.map((g) => g.id).slice(0, 5),
    },
    {
      heading: "Defense simulations",
      body:
        simulations
          .map(
            (s) =>
              `${s.name}: ${s.controlIds.join("+")} · risk ${s.beforeRisk} → ${s.afterRisk} · critical paths remaining ${s.survivability.criticalAfter}. Residual risk is never assumed to be zero.`,
          )
          .join("\n") || "No simulations run in this assessment yet.",
      references: simulations.map((s) => s.id),
    },
    {
      heading: "Security drift",
      body: snap.drift?.causalExplanation ?? "No prior twin available for drift comparison.",
      references: snap.drift ? [snap.drift.previousAssessmentId] : [],
    },
    {
      heading: "SENTINEL-X Exposure Momentum",
      body: snap.momentum
        ? `${snap.momentum.label}: ${snap.momentum.score} (${snap.momentum.direction}). This is a SENTINEL-X project metric, not an industry standard.`
        : "Momentum not computed.",
      references: [],
    },
  ];

  return {
    title: `SENTINEL-X assessment report — ${snap.organization.name}`,
    generatedAt: new Date().toISOString(),
    assessmentId: snap.assessmentId,
    mode: snap.mode,
    executiveSummary: snap.risk.insufficientEvidence
      ? `Modeled exposure for ${snap.target}. No posture score is reported because no modeled path was found; confidence ${Math.round(snap.risk.confidence * 100)}%. Potential shadow assets: ${snap.shadowAssets.length}. Language: observed / modeled / potential only.`
      : `Northshore-style modeled exposure for ${snap.target}. Posture ${snap.risk.overallScore} ${snap.risk.band} with confidence ${Math.round(snap.risk.confidence * 100)}%. ${snap.risk.criticalPathCount} critical modeled paths. Potential shadow assets: ${snap.shadowAssets.length}. Language: observed / modeled / potential only.`,
    posture: { score: snap.risk.overallScore, band: snap.risk.band, confidence: snap.risk.confidence },
    postureIsScored: !snap.risk.insufficientEvidence,
    sections,
    languageDisclaimer:
      "This report describes modeled potential paths supported by evidence. It does not claim compromise, breach, or guaranteed exploitability.",
  };
}
