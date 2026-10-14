import { createServerFn } from "@tanstack/react-start";
import { getA11yScan, listA11yScans, saveA11yFailure, saveA11yScan } from "./repo.ts";
import type { A11yScanListItem, A11yScanOutcome, A11yScanRecord } from "./types.ts";

/**
 * Accessibility server functions.
 *
 * A refused target or an unavailable browser is returned as a structured
 * `{ ok: false, error_code }` rather than thrown, so the page can show the
 * operator the exact reason instead of a generic crash — and so a failed scan is
 * never rendered as a scan that found nothing.
 */

function errorCodeOf(err: unknown, fallback: string): string {
  const code = (err as { error_code?: unknown } | null)?.error_code;
  return typeof code === "string" && code ? code : fallback;
}

export const runA11yScanFn = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<A11yScanOutcome> => {
    // Dynamic import keeps playwright / node:fs out of every client bundle.
    const { scanUrl } = await import("./scan.server.ts");
    try {
      const scan = await scanUrl(data.url);
      await saveA11yScan(scan);
      return { ok: true, scan };
    } catch (err) {
      const error_code = errorCodeOf(err, "SCAN_FAILED");
      const message = err instanceof Error ? err.message : "The accessibility scan failed.";
      await saveA11yFailure(data.url, error_code, message);
      return { ok: false, error_code, message };
    }
  });

export const listA11yScansFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<A11yScanListItem[]> => listA11yScans(),
);

export const getA11yScanFn = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<A11yScanRecord | null> => getA11yScan(data.id));
