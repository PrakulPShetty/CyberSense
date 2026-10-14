/**
 * SENTINEL-X scoring model (documented, deterministic).
 *
 * Risk is NOT confidence. Scores decompose into named factors that sum to 0–100.
 * Exposure Momentum is a project metric, not an industry standard.
 */

import type { Criticality, FreshnessState, RiskBand } from "./types.ts";

export const INTERNET_NODE_ID = "node_internet";

/** Edge difficulty at or above this value is treated as a broken transition. */
export const PATH_BREAK_DIFFICULTY = 85;

export const MAX_PATH_LENGTH = 7;
export const MAX_PATHS = 16;
export const MIN_EDGE_CONFIDENCE = 0.22;

export const CRITICALITY_POINTS: Record<Criticality, number> = {
  LOW: 4,
  MEDIUM: 10,
  HIGH: 18,
  CRITICAL: 25,
};

/** Freshness windows by observation family (hours). */
export const FRESHNESS_WINDOWS_HOURS: Record<
  string,
  { aging: number; stale: number; expired: number }
> = {
  dns: { aging: 24 * 7, stale: 24 * 30, expired: 24 * 90 },
  certificate: { aging: 24 * 14, stale: 24 * 60, expired: 24 * 180 },
  repository: { aging: 24 * 14, stale: 24 * 45, expired: 24 * 120 },
  service: { aging: 24 * 3, stale: 24 * 14, expired: 24 * 45 },
  authentication: { aging: 24 * 3, stale: 24 * 14, expired: 24 * 45 },
  default: { aging: 24 * 7, stale: 24 * 30, expired: 24 * 90 },
};

export function freshnessFamily(observationType: string): string {
  const t = observationType.toLowerCase();
  if (t.includes("dns") || t.includes("subdomain") || t.includes("hostname")) return "dns";
  if (t.includes("cert")) return "certificate";
  if (t.includes("repo") || t.includes("github")) return "repository";
  if (t.includes("auth") || t.includes("login") || t.includes("mfa")) return "authentication";
  if (t.includes("service") || t.includes("port") || t.includes("banner")) return "service";
  return "default";
}

export function classifyFreshness(observedAtIso: string, nowIso: string, family: string): FreshnessState {
  const windows = FRESHNESS_WINDOWS_HOURS[family] ?? FRESHNESS_WINDOWS_HOURS.default;
  const ageHours = (Date.parse(nowIso) - Date.parse(observedAtIso)) / 36e5;
  if (!Number.isFinite(ageHours) || ageHours < 0) return "FRESH";
  if (ageHours >= windows.expired) return "EXPIRED";
  if (ageHours >= windows.stale) return "STALE";
  if (ageHours >= windows.aging) return "AGING";
  return "FRESH";
}

export function freshnessMultiplier(state: FreshnessState): number {
  switch (state) {
    case "FRESH":
      return 1;
    case "AGING":
      return 0.82;
    case "STALE":
      return 0.55;
    case "EXPIRED":
      return 0.28;
  }
}

/**
 * Evidence confidence:
 *   0.40 * sourceReliability
 * + 0.20 * observationConfidence
 * + 0.15 * recency (freshness multiplier)
 * + 0.15 * corroboration (1 - 1/(1+count))
 * + 0.10 * verification (verified=1, needs_review=0.6, unverified=0.45, rejected=0)
 *
 * Independent sources raise corroboration; conflicts are applied by the caller
 * as a penalty (conflictPenalty 0–1 subtracted after).
 */
export function evidenceConfidence(input: {
  sourceReliability: number;
  observationConfidence: number;
  freshness: FreshnessState;
  corroborationCount: number;
  verification: "UNVERIFIED" | "NEEDS_REVIEW" | "VERIFIED" | "REJECTED";
  conflictPenalty?: number;
}): number {
  const verification =
    input.verification === "VERIFIED"
      ? 1
      : input.verification === "NEEDS_REVIEW"
        ? 0.6
        : input.verification === "REJECTED"
          ? 0
          : 0.45;
  const corroboration = 1 - 1 / (1 + Math.max(0, input.corroborationCount));
  const raw =
    0.4 * clamp01(input.sourceReliability) +
    0.2 * clamp01(input.observationConfidence) +
    0.15 * freshnessMultiplier(input.freshness) +
    0.15 * corroboration +
    0.1 * verification;
  return clamp01(raw - (input.conflictPenalty ?? 0));
}

export function riskBand(score: number): RiskBand {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round0(n: number): number {
  return Math.round(n);
}

/**
 * Path risk contributors (max 100):
 *  - asset criticality        0–25
 *  - external exposure        0–18  (entry is INTERNET)
 *  - path impact              0–18  (crown-jewel destination)
 *  - barrier weakness         0–12  (inverse of mean difficulty)
 *  - evidence confidence      0–12
 *  - short path bonus         0–8   (shallower = easier)
 *  - convergence              0–7   (shared hops toward jewels)
 */
export const RISK_FACTOR_MAX = {
  criticality: 25,
  exposure: 18,
  impact: 18,
  barriers: 12,
  evidence: 12,
  depth: 8,
  convergence: 7,
} as const;
