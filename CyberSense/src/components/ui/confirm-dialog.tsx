import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Confirmation dialog used before an action that talks to a third-party target
 * (e.g. running a scan). Keyboard accessible and focus-trapped by Radix.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-400/20 bg-navy-900/95 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.75)] focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-base font-semibold tracking-tight text-slate-50">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sky-400/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-label="Close dialog"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description asChild>
              <div className="mt-3 text-sm leading-relaxed text-slate-300">{description}</div>
            </Dialog.Description>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <Dialog.Close asChild>
              <Button variant="ghostNeon" disabled={pending}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button variant="primary" onClick={onConfirm} disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
