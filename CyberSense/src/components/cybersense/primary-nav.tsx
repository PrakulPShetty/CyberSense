import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileText, History, MessageSquare, SlidersHorizontal, Activity, ScanSearch, LayoutDashboard } from "lucide-react";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accessibility", label: "New Scan", icon: ScanSearch },
  { to: "/results", label: "Scan Results", icon: Activity },
  { to: "/recommendations", label: "Fix Recommendations", icon: SlidersHorizontal },
  { to: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { to: "/history", label: "Scan History", icon: History },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

export function PrimaryNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      <div className="mb-3 px-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">CyberSense</div>
      {LINKS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-gradient-to-r from-sky-500/20 to-indigo-500/10 text-sky-200 ring-1 ring-sky-400/30"
                : "text-slate-400 hover:bg-sky-400/10 hover:text-sky-200"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PrimaryShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-navy-950 text-slate-100">
      <aside className="hidden w-64 shrink-0 border-r border-sky-400/10 bg-navy-900/60 p-4 md:block">
        <div className="mb-4 px-2">
          <Link to="/" className="flex items-center gap-2 text-slate-100">
            <span className="text-sm font-semibold tracking-wide">
              Cyber<span className="text-gradient">Sense</span>
            </span>
          </Link>
        </div>
        <PrimaryNav />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="border-b border-sky-400/10 bg-navy-950/80 backdrop-blur md:hidden">
          <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-3 py-3">
            {LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-sky-400/15 px-3 py-1.5 text-xs text-slate-400 hover:text-sky-200"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
