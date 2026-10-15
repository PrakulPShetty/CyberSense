import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { APP_NAV, AppShell } from "./app-shell";

/**
 * Backwards-compatible wrappers.
 *
 * The shell lives in `app-shell.tsx`; these exports are kept so any route that
 * still imports the older names renders the same, single application shell
 * instead of a divergent layout.
 */
export function PrimaryShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export function PrimaryNav() {
  return (
    <nav aria-label="Application" className="flex flex-col gap-1">
      {APP_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-sky-400/10 hover:text-sky-200"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
