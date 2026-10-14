import { createServerFn } from "@tanstack/react-start";
import { getA11yScan, listA11yScans, saveA11yFailure, saveA11yScan } from "./repo.ts";
import { explainFinding } from "./assistant.ts";
import { buildA11yReportPdf } from "./report.ts";
import { compareScans } from "./compare.ts";
import { buildRecommendations } from "./recommendations.ts";
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

export const explainA11yFindingFn = createServerFn({ method: "POST" })
  .validator((input: { scanId: string; findingId?: string }) => input)
  .handler(async ({ data }) => {
    const scan = await getA11yScan(data.scanId);
    if (!scan) return null;
    return explainFinding(scan, data.findingId);
  });

export const generateA11yReportFn = createServerFn({ method: "POST" })
  .validator((input: { scanId: string }) => input)
  .handler(async ({ data }) => {
    const scan = await getA11yScan(data.scanId);
    if (!scan) return null;
    const base64 = buildA11yReportPdf(scan);
    return { scanId: scan.id, base64, filename: `CyberSense-accessibility-${scan.id}.pdf` };
  });

export const compareA11yScansFn = createServerFn({ method: "POST" })
  .validator((input: { baseId: string; laterId: string }) => input)
  .handler(async ({ data }) => {
    const [base, later] = await Promise.all([getA11yScan(data.baseId), getA11yScan(data.laterId)]);
    if (!base || !later) return null;
    return compareScans(base, later);
  });

export const a11yRecommendationsFn = createServerFn({ method: "POST" })
  .validator((input: { scanId: string }) => input)
  .handler(async ({ data }) => {
    const scan = await getA11yScan(data.scanId);
    if (!scan) return null;
    return buildRecommendations(scan);
  });
