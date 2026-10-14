import type { A11yScanRecord } from "./types.ts";

export interface ScanComparison {
  baseScanId: string;
  laterScanId: string;
  comparable: boolean;
  reasons: string[];
  newRules: string[];
  resolvedRules: string[];
  persistentRules: string[];
  changedRules: string[];
  counts: { base: number; later: number; new: number; resolved: number; persistent: number };
}

export function compareScans(base: A11yScanRecord, later: A11yScanRecord): ScanComparison {
  const reasons: string[] = [];
  const sameHost = base.hostname === later.hostname;
  if (!sameHost) reasons.push("Different hostnames; scans are not comparable.");
  // url scope? simple hostname only
  const baseIds = new Set(base.violations.map((v) => v.id));
  const laterIds = new Set(later.violations.map((v) => v.id));
  const newRules = [...laterIds].filter((id) => !baseIds.has(id));
  const resolvedRules = [...baseIds].filter((id) => !laterIds.has(id));
  const persistentRules = [...baseIds].filter((id) => laterIds.has(id));
  const changedRules: string[] = [];
  const byIdBase = new Map(base.violations.map((v) => [v.id, v]));
  const byIdLater = new Map(later.violations.map((v) => [v.id, v]));
  for (const id of persistentRules) {
    const a = byIdBase.get(id)!;
    const b = byIdLater.get(id)!;
    if (a.nodeCount !== b.nodeCount || a.impact !== b.impact) changedRules.push(id);
  }
  const comparable = sameHost && base.status !== "FAILED" && later.status !== "FAILED";
  if (!comparable && reasons.length === 0) reasons.push("One or both scans failed.");
  return {
    baseScanId: base.id,
    laterScanId: later.id,
    comparable,
    reasons,
    newRules,
    resolvedRules,
    persistentRules,
    changedRules,
    counts: {
      base: base.violations.length,
      later: later.violations.length,
      new: newRules.length,
      resolved: resolvedRules.length,
      persistent: persistentRules.length,
    },
  };
}
