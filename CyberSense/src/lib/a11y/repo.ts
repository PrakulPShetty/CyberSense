import { getSql } from "@/lib/db";
import { audit } from "../sentinel/repo.ts";
import type { A11yScanListItem, A11yScanRecord, A11yScanSummary } from "./types.ts";

/**
 * Storage for accessibility scans.
 *
 * Deliberately its own table rather than a row on `assessments`: accessibility
 * findings describe a rendered page, not a modeled attack path, and the two must
 * not be blended into one risk number.
 */

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function emptySummary(): A11yScanSummary {
  return {
    ruleCount: 0,
    elementCount: 0,
    byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 },
    byWcagTag: {},
    incompleteCount: 0,
    passCount: 0,
    inapplicableCount: 0,
    truncated: false,
  };
}

export async function saveA11yScan(scan: A11yScanRecord): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into accessibility_scans
       (id, url, hostname, status, engine, scanned_at, summary, violations, incomplete, passes, result)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)`,
    [
      scan.id,
      scan.url,
      scan.hostname,
      scan.status,
      scan.engine,
      scan.scannedAt,
      JSON.stringify(scan.summary),
      JSON.stringify(scan.violations),
      JSON.stringify(scan.incomplete),
      JSON.stringify(scan.passes),
      JSON.stringify(scan),
    ],
  );
  await audit("a11y_scan_completed", null, {
    scan_id: scan.id,
    url: scan.url,
    rules: String(scan.summary.ruleCount),
    elements: String(scan.summary.elementCount),
  });
}

/** A refused or failed scan is recorded as a failure, never as an empty result. */
export async function saveA11yFailure(url: string, errorCode: string, message: string): Promise<void> {
  try {
    await audit("a11y_scan_failed", null, {
      url: url.slice(0, 500),
      error_code: errorCode,
      message: message.slice(0, 500),
    });
  } catch {
    // Losing the audit line must not hide the original, user-facing error.
  }
}

export async function listA11yScans(limit = 50): Promise<A11yScanListItem[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    url: string;
    hostname: string;
    status: A11yScanRecord["status"];
    scanned_at: unknown;
    engine: string;
    summary: unknown;
    result: unknown;
  }>(
    `select id, url, hostname, status, scanned_at, engine, summary, result
       from accessibility_scans
      order by scanned_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => {
    const result = parseJson<A11yScanRecord | null>(r.result, null);
    return {
      id: r.id,
      url: r.url,
      hostname: r.hostname,
      status: r.status,
      scannedAt: String(result?.scannedAt ?? r.scanned_at ?? ""),
      engine: r.engine,
      summary: parseJson<A11yScanSummary>(r.summary, emptySummary()),
      errorCode: result?.errorCode ?? null,
    };
  });
}

export async function getA11yScan(id: string): Promise<A11yScanRecord | null> {
  const sql = await getSql();
  const rows = await sql.query<{ result: unknown }>(
    `select result from accessibility_scans where id = $1`,
    [id],
  );
  return parseJson<A11yScanRecord | null>(rows[0]?.result ?? null, null);
}
