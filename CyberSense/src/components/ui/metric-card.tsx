import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Metric panels for the dashboard and scan summaries.
 *
 * `value` is always supplied by the caller from real backend data — this
 * component never invents a number, and renders an em dash when no record
 * exists yet.
 */
const TONES = {
  blue: { ring: "ring-sky-400/25", bg: "bg-sky-500/10", text: "text-sky-300" },
  cyan: { ring: "ring-cyan-400/25", bg: "bg-cyan-500/10", text: "text-cyan-300" },
  violet: { ring: "ring-violet-400/25", bg: "bg-violet-500/10", text: "text-violet-300" },
  green: { ring: "ring-emerald-400/25", bg: "bg-emerald-500/10", text: "text-emerald-300" },
  amber: { ring: "ring-amber-400/25", bg: "bg-amber-500/10", text: "text-amber-300" },
  red: { ring: "ring-rose-400/25", bg: "bg-rose-500/10", text: "text-rose-300" },
} as const;

export type MetricTone = keyof typeof TONES;

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: MetricTone;
  className?: string;
}) {
  const palette = TONES[tone];
  return (
    <div className={cn("panel panel-interactive rounded-2xl p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        {icon ? (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl ring-1", palette.bg, palette.ring, palette.text)}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 font-mono text-3xl tabular text-slate-50">{value}</div>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
