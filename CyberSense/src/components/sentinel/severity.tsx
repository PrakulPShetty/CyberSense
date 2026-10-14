import { cn } from "@/lib/utils";
import type { ClaimKind, RecommendationClass, RiskBand } from "@/lib/sentinel/types";

const BAND: Record<string, string> = {
  CRITICAL: "text-critical bg-critical/15",
  HIGH: "text-high bg-high/15",
  MEDIUM: "text-medium bg-medium/15",
  LOW: "text-low bg-low/15",
  FRESH: "text-low bg-low/15",
  AGING: "text-high bg-high/15",
  STALE: "text-critical bg-critical/15",
  EXPIRED: "text-unknown bg-muted",
  DEMO: "text-foreground bg-muted",
  LIVE: "text-medium bg-medium/15",
  REMEDIATE: "text-critical bg-critical/15",
  VERIFY: "text-high bg-high/15",
  MONITOR: "text-medium bg-medium/15",
  OBSERVED: "text-low bg-low/15",
  MODELED: "text-medium bg-medium/15",
  INFERRED: "text-high bg-high/15",
  UNKNOWN: "text-unknown bg-muted",
  // axe-core impact values (lowercase), used by the Track D accessibility views.
  critical: "text-critical bg-critical/15",
  serious: "text-high bg-high/15",
  moderate: "text-medium bg-medium/15",
  minor: "text-low bg-low/15",
  COMPLETED: "text-low bg-low/15",
  PARTIAL: "text-high bg-high/15",
  FAILED: "text-critical bg-critical/15",
  RUNNING: "text-medium bg-medium/15",
};

export function Severity({
  value,
  className,
}: {
  value: RiskBand | RecommendationClass | ClaimKind | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        BAND[value] ?? "text-muted-foreground bg-muted",
        className,
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function Score({ value, className }: { value: number; className?: string }) {
  const band = value >= 80 ? "text-critical" : value >= 60 ? "text-high" : value >= 35 ? "text-medium" : "text-low";
  return <span className={cn("tabular font-mono", band, className)}>{value}</span>;
}
