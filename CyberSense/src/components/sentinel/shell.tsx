import { Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAssessment } from "@/lib/sentinel/use-assessment";
import { cn } from "@/lib/utils";
import { Wordmark } from "./brand";
import { Severity, Score } from "./severity";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; absolute?: boolean }[] = [
  { to: "", label: "Scan Website", icon: LayoutDashboard },
  { to: "/results", label: "Scan Results", icon: Activity },
  { to: "/recommendations", label: "Fix Recommendations", icon: SlidersHorizontal },
  { to: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { to: "/history", label: "Scan History / Progress", icon: History },
  { to: "/reports", label: "Reports", icon: ClipboardList },
];

export function AssessmentShell() {
  const { id } = useParams({ from: "/assessments/$id" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: snap, isLoading, error } = useAssessment(id);
  const [open, setOpen] = useState(false);

  const items = NAV.map((n) => {
    const href = n.absolute ? n.to : n.to ? `/assessments/${id}${n.to}` : `/assessments/${id}`;
    const active = n.absolute ? pathname.startsWith(n.to) : n.to === "" ? pathname === href : pathname.startsWith(href);
    return { ...n, href, active };
  });

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => {
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            to={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-md px-2.5 text-[13px]",
              n.active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border p-4 md:flex">
        <Link to="/" className="mb-6">
          <Wordmark compact />
        </Link>
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{snap?.organization.name ?? "Assessment"}</div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono">{snap?.target ?? id}</span>
              {snap && <Severity value={snap.mode} />}
              {snap && <Severity value={snap.status} />}
            </div>
          </div>
          {snap && (
            <div className="hidden items-baseline gap-1 sm:flex">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Posture</span>
              {snap.risk.insufficientEvidence ? (
                <span className="text-xs text-unknown">no score</span>
              ) : (
                <Score value={snap.risk.overallScore} className="text-xl" />
              )}
            </div>
          )}
        </header>
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button type="button" className="absolute inset-0 bg-background/70" onClick={() => setOpen(false)} aria-label="Close" />
            <div className="relative h-full w-64 bg-card p-4 shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <Wordmark compact />
                <button type="button" className="size-11" onClick={() => setOpen(false)} aria-label="Close navigation">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 p-4 md:p-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading twin…</p>}
          {error && <p className="text-sm text-critical">Assessment not found or failed to load.</p>}
          {snap && <Outlet />}
        </main>
      </div>
    </div>
  );
}
