import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page heading: eyebrow, title, description and an action slot.
 * Used by every application route so heading hierarchy stays identical.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  visual,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small decorative mark rendered next to the title (never informational). */
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-5", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="mt-2 flex items-center gap-3">
          {visual}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h1>
        </div>
        {description ? (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

/** Section heading used inside a page (below the PageHeader). */
export function SectionHeading({
  title,
  description,
  actions,
  className,
  id,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-slate-100">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
