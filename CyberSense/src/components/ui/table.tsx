import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Horizontal-scroll wrapper so mobile never overflows the viewport. */
export function TableWrap({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("table-wrap scroll-thin", className)} {...props}>
      <table className="table-basic min-w-[640px]">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn(className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(className)} {...props} />;
}

/** Simple definition row used in metadata panels. */
export function MetaList({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn("flex flex-col gap-2.5 text-sm", className)}>{children}</dl>;
}

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-sky-400/10 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-right font-mono text-xs text-slate-200">{value}</dd>
    </div>
  );
}
