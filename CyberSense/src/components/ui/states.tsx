import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Honest empty state — used wherever the backend returned no records. */
export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/20">
        {icon ?? <Inbox className="size-5" aria-hidden="true" />}
      </span>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

/** Error state for a failed server function or an unavailable resource. */
export function ErrorState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5", className)}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-200">
        <AlertTriangle className="size-4" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-1.5 text-sm leading-relaxed text-rose-100/90">{body}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Loading placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton h-4 w-full", className)} />;
}

/** Loading placeholder shaped like a metrics row. */
export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel rounded-2xl p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-2.5 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder shaped like a list of records. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="panel-flat flex items-center gap-4 rounded-xl px-4 py-3.5">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="ml-auto h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
