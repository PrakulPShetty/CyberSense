import { cn } from "@/lib/utils";
import type { ClaimKind, RecommendationClass, RiskBand } from "@/lib/sentinel/types";

/**
 * Severity / status language for the whole product.
 *
 * Colour is meaningful here — red, amber, blue and green each carry a specific
 * meaning — so the dot and the label are always shown together, and the label
 * text alone is enough to understand the chip (never colour alone).
 */
const BAND: Record<string, { chip: string; dot: string }> = {
  CRITICAL: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
  HIGH: { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  MEDIUM: { chip: "text-medium ring-medium/30 bg-medium/10", dot: "bg-medium" },
  LOW: { chip: "text-low ring-low/30 bg-low/10", dot: "bg-low" },
  FRESH: { chip: "text-low ring-low/30 bg-low/10", dot: "bg-low" },
  AGING: { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  STALE: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
  EXPIRED: { chip: "text-unknown ring-slate-400/25 bg-slate-400/10", dot: "bg-unknown" },
  DEMO: { chip: "text-violet-200 ring-violet-400/30 bg-violet-500/10", dot: "bg-violet-300" },
  LIVE: { chip: "text-medium ring-medium/30 bg-medium/10", dot: "bg-medium" },
  REMEDIATE: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
  VERIFY: { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  MONITOR: { chip: "text-medium ring-medium/30 bg-medium/10", dot: "bg-medium" },
  OBSERVED: { chip: "text-low ring-low/30 bg-low/10", dot: "bg-low" },
  MODELED: { chip: "text-medium ring-medium/30 bg-medium/10", dot: "bg-medium" },
  INFERRED: { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  UNKNOWN: { chip: "text-unknown ring-slate-400/25 bg-slate-400/10", dot: "bg-unknown" },
  // axe-core impact values (lowercase), used by the accessibility views.
  critical: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
  serious: { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  moderate: { chip: "text-medium ring-medium/30 bg-medium/10", dot: "bg-medium" },
  minor: { chip: "text-low ring-low/30 bg-low/10", dot: "bg-low" },
  COMPLETED: { chip: "text-low ring-low/30 bg-low/10", dot: "bg-low" },
  PARTIAL: { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  FAILED: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
  RUNNING: { chip: "text-medium ring-medium/30 bg-medium/10", dot: "bg-medium" },
  // Security check statuses.
  pass: { chip: "text-low ring-low/30 bg-low/10", dot: "bg-low" },
  fail: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
  "not-verified": { chip: "text-high ring-high/30 bg-high/10", dot: "bg-high" },
  skipped: { chip: "text-unknown ring-slate-400/25 bg-slate-400/10", dot: "bg-unknown" },
  error: { chip: "text-critical ring-critical/30 bg-critical/10", dot: "bg-critical" },
};

export function Severity({
  value,
  className,
  withDot = true,
}: {
  value: RiskBand | RecommendationClass | ClaimKind | string;
  className?: string;
  withDot?: boolean;
}) {
  const style = BAND[value] ?? { chip: "text-unknown ring-slate-400/25 bg-slate-400/10", dot: "bg-unknown" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1",
        style.chip,
        className,
      )}
    >
      {withDot ? <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" /> : null}
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function Score({ value, className }: { value: number; className?: string }) {
  const band = value >= 80 ? "text-critical" : value >= 60 ? "text-high" : value >= 35 ? "text-medium" : "text-low";
  return <span className={cn("tabular font-mono", band, className)}>{value}</span>;
}
