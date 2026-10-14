import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ScanSearch, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/", label: "About", hash: "about" },
  { to: "/", label: "Features", hash: "features" },
  { to: "/", label: "How It Works", hash: "how-it-works" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export function AppNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-sky-400/10 bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="CyberSense home">
          <span className="relative flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/20 ring-1 ring-sky-400/30">
            <ShieldCheck className="size-5 text-sky-300" aria-hidden="true" />
            <span className="absolute inset-0 rounded-lg glow-blue animate-pulse-glow" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-wide text-slate-100">
            Cyber<span className="text-gradient">Sense</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={"hash" in link ? link.hash : undefined}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-sky-400/10 hover:text-sky-200"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/accessibility"
            className="btn-primary-neon ml-3 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold"
          >
            <ScanSearch className="size-4" aria-hidden="true" />
            Start Scanning
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md text-slate-300 hover:bg-sky-400/10 md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-sky-400/10 bg-navy-950/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                hash={"hash" in link ? link.hash : undefined}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-sky-400/10 hover:text-sky-200"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/accessibility"
              onClick={() => setOpen(false)}
              className="btn-primary-neon mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            >
              <ScanSearch className="size-4" aria-hidden="true" />
              Start Scanning
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
