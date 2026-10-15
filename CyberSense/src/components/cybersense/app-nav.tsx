import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ScanSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/cybersense/app-shell";

/**
 * Public site header.
 *
 * Section links scroll to the landing-page anchors; Dashboard and Start
 * Scanning open real routes. Translucent, with a clear active state.
 */
const SECTION_LINKS = [
  { label: "Home", hash: undefined },
  { label: "About", hash: "about" },
  { label: "Features", hash: "features" },
  { label: "How It Works", hash: "how-it-works" },
] as const;

export function AppNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onLanding = pathname === "/";

  return (
    <header className="sticky top-0 z-50 border-b border-sky-400/10 bg-navy-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-xl" aria-label="CyberSense home">
          <BrandMark />
          <span className="text-base font-semibold tracking-wide text-slate-100">
            Cyber<span className="text-gradient">Sense</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.map((link) => (
            <Link
              key={link.label}
              to="/"
              hash={link.hash}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200",
                onLanding && !link.hash && "text-sky-200",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/dashboard"
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm transition-colors hover:bg-sky-400/10 hover:text-sky-200",
              pathname.startsWith("/dashboard") ? "text-sky-200" : "text-slate-300",
            )}
          >
            Dashboard
          </Link>
          <Link
            to="/security"
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm transition-colors hover:bg-sky-400/10 hover:text-sky-200",
              pathname.startsWith("/security") ? "text-sky-200" : "text-slate-300",
            )}
          >
            Security
          </Link>
          <Link
            to="/accessibility"
            className="btn-primary-neon ml-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
          >
            <ScanSearch className="size-4" aria-hidden="true" />
            Start Scanning
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 lg:hidden"
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <nav id="landing-mobile-nav" aria-label="Primary" className="border-t border-sky-400/10 bg-navy-950/95 px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {SECTION_LINKS.map((link) => (
              <Link
                key={link.label}
                to="/"
                hash={link.hash}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200"
            >
              Dashboard
            </Link>
            <Link
              to="/security"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200"
            >
              Security
            </Link>
            <Link
              to="/accessibility"
              onClick={() => setOpen(false)}
              className="btn-primary-neon mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
            >
              <ScanSearch className="size-4" aria-hidden="true" />
              Start Scanning
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
