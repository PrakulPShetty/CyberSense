import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Glass panel primitives.
 *
 * Every application page builds its layout from these so panels, spacing,
 * borders and radii stay consistent instead of drifting per route.
 */

export function Panel({
  className,
  interactive = false,
  glow = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; glow?: boolean }) {
  return (
    <div
      className={cn(
        "panel relative rounded-2xl",
        interactive && "panel-interactive",
        glow && "panel-glow",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelTitle({
  className,
  icon,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { icon?: ReactNode }) {
  return (
    <h2 className={cn("flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-100", className)} {...props}>
      {icon}
      {children}
    </h2>
  );
}

export function PanelDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)} {...props} />;
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function PanelFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-sky-400/10 px-5 py-4", className)} {...props} />;
}

/** Compact labelled statistic used inside panels and headers. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "critical" | "high" | "medium" | "low" | "violet";
  className?: string;
}) {
  const toneClass = {
    default: "text-slate-100",
    critical: "text-critical",
    high: "text-high",
    medium: "text-medium",
    low: "text-low",
    violet: "text-violet-300",
  }[tone];

  return (
    <div className={cn("panel-flat rounded-xl px-4 py-3", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 font-mono text-2xl tabular", toneClass)}>{value}</div>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
