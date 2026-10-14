import { classifyFreshness, evidenceConfidence, freshnessFamily } from "./scoring.ts";
import { stableId } from "./ids.ts";
import type { EvidenceRecord, Observation } from "./types.ts";

export function buildEvidence(
  assessmentId: string,
  observations: Observation[],
  now: string,
): EvidenceRecord[] {
  const byValue = new Map<string, Observation[]>();
  for (const o of observations) {
    const key = `${o.observationType}:${o.normalizedValue.toLowerCase()}`;
    const list = byValue.get(key) ?? [];
    list.push(o);
    byValue.set(key, list);
  }

  return observations.map((o) => {
    const family = freshnessFamily(o.observationType);
    const freshness = classifyFreshness(o.timestamp, now, family);
    const peers = byValue.get(`${o.observationType}:${o.normalizedValue.toLowerCase()}`) ?? [o];
    const independent = new Set(peers.map((p) => p.sourceId));
    const corroborationCount = Math.max(0, independent.size - 1);
    const confidence = evidenceConfidence({
      sourceReliability: o.sourceReliability,
      observationConfidence: o.confidence,
      freshness,
      corroborationCount,
      verification: o.verificationStatus,
    });
    o.freshness = freshness;
    return {
      id: stableId("ev", assessmentId, o.id),
      assessmentId,
      observationId: o.id,
      assetIds: o.assetId ? [o.assetId] : [],
      relationshipIds: [],
      pathIds: [],
      source: o.sourceId,
      sourceType: family,
      observationTimestamp: o.timestamp,
      ingestionTimestamp: now,
      sourceReliability: o.sourceReliability,
      evidenceConfidence: confidence,
      freshness,
      corroborationCount,
      verificationState: o.verificationStatus,
      provenance: `${o.sourceId} · ${o.rawReference}`,
      rawObservationReference: o.rawReference,
      normalized: {
        type: o.observationType,
        value: o.normalizedValue,
      },
      kind: o.sourceId === "org_inventory" ? "OBSERVED" : "OBSERVED",
      stale: freshness === "STALE" || freshness === "EXPIRED",
    };
  });
}

export function linkEvidence(
  evidence: EvidenceRecord[],
  assetId: string | null,
  relationshipId?: string,
): string[] {
  if (!assetId) return [];
  const ids: string[] = [];
  for (const e of evidence) {
    if (e.assetIds.includes(assetId)) {
      if (relationshipId && !e.relationshipIds.includes(relationshipId)) e.relationshipIds.push(relationshipId);
      ids.push(e.id);
    }
  }
  return ids;
}
