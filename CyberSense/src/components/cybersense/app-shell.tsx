import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Application shell shared by every in-app route.
 *
 * A persistent sidebar on desktop, a compact top bar with a disclosure menu on
 * mobile, and consistent content padding. Navigation is real — every entry maps
 * to an existing route.
 */
export const APP_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview of stored scans" },
  { to: "/accessibility", label: "New Scan", icon: ScanSearch, hint: "Run a scan on a URL" },
  { to: "/results", label: "Scan Results", icon: Activity, hint: "Findings from saved scans" },
  { to: "/recommendations", label: "Fix Recommendations", icon: SlidersHorizontal, hint: "Advisory remediation" },
  { to: "/assistant", label: "AI Assistant", icon: MessageSquare, hint: "Explain a finding" },
  { to: "/history", label: "Scan History", icon: History, hint: "Track and compare" },
  { to: "/reports", label: "Reports", icon: FileText, hint: "Generate a PDF" },
  { to: "/security", label: "Security Checks", icon: ShieldCheck, hint: "HTTP and TLS observations" },
] as const;

const SECONDARY_NAV = [{ to: "/", label: "Landing page" }] as const;

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-11" : size === "sm" ? "size-8" : "size-9";
  const icon = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";
  return (
    <span className={cn("relative flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-violet-500/20 ring-1 ring-sky-400/30", box)}>
      <ShieldCheck className={cn("text-sky-300", icon)} aria-hidden="true" />
      <span className="absolute inset-0 rounded-xl glow-blue opacity-60 animate-pulse-glow" aria-hidden="true" />
    </span>
  );
}

export function AppShell({
  children,
  banner,
  contentClassName,
}: {
  children: ReactNode;
  /** Optional full-width strip rendered above the page content. */
  banner?: ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-dvh bg-navy-950 text-slate-100">
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-800 focus:px-4 focus:py-2 focus:text-sm focus:text-sky-200"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sky-400/10 bg-navy-900/70 px-4 py-5 backdrop-blur-xl md:flex">
          <Link to="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1" aria-label="CyberSense home">
            <BrandMark />
            <span className="text-base font-semibold tracking-wide text-slate-100">
              Cyber<span className="text-gradient">Sense</span>
            </span>
          </Link>

          <nav aria-label="Application" className="mt-6 flex flex-col gap-1">
            {APP_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-gradient-to-r from-sky-500/20 to-indigo-500/10 text-sky-100 ring-1 ring-sky-400/30"
                      : "text-slate-400 hover:bg-sky-400/10 hover:text-sky-100",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-sky-300" : "text-slate-500 group-hover:text-sky-300")} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <div className="rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4">
              <p className="text-xs font-semibold text-sky-200">Run a new scan</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                A real browser renders the page and axe-core reports the rules it actually fails.
              </p>
              <Button asChild variant="primary" size="sm" className="mt-3 w-full">
                <Link to="/accessibility">
                  <ScanSearch className="size-3.5" aria-hidden="true" />
                  New Scan
                </Link>
              </Button>
            </div>
            <Link
              to="/"
              className="px-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-sky-300"
            >
              ← Landing page
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 border-b border-sky-400/10 bg-navy-950/85 backdrop-blur-xl md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link to="/" className="flex items-center gap-2" aria-label="CyberSense home">
                <BrandMark size="sm" />
                <span className="text-sm font-semibold tracking-wide">
                  Cyber<span className="text-gradient">Sense</span>
                </span>
              </Link>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? "Close navigation menu" : "Open navigation menu"}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
              </button>
            </div>
            {open ? (
              <nav id="mobile-nav" aria-label="Application" className="border-t border-sky-400/10 px-4 pb-4 pt-3">
                <div className="flex flex-col gap-1">
                  {APP_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                          active ? "bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/25" : "text-slate-400 hover:bg-sky-400/10 hover:text-sky-100",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </nav>
            ) : null}
          </header>

          {banner}

          <main id="app-content" className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 lg:py-9", contentClassName)}>
            {children}
          </main>

          <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 sm:px-6">
            <div className="divider-neon" aria-hidden="true" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
              <p>CyberSense — evidence before interpretation.</p>
              <nav aria-label="Secondary" className="flex flex-wrap gap-4">
                {SECONDARY_NAV.map((item) => (
                  <Link key={item.to} to={item.to} className="transition-colors hover:text-sky-300">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
