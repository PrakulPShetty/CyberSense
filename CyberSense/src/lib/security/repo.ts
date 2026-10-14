import { getSql } from "@/lib/db";
import { newId } from "../sentinel/ids.ts";
import type { SecurityCheckResult, SecurityCheckRun } from "./checks.ts";

/**
 * Persistence for genuine low-impact website security checks.
 *
 * Deliberately separate from `accessibility_scans`: an accessibility violation is a
 * fact about a rendered page, while a security check is an observation about a
 * website's HTTP/TLS configuration. The two categories must never be merged into
 * one risk number.
 */

export interface SecurityCheckListItem {
  id: string;
  targetUrl: string;
  hostname: string;
  startedAt: string;
  completedAt: string;
  statusCounts: { pass: number; fail: number; not_verified: number; skipped: number; error: number };
}

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

export async function saveSecurityRun(run: SecurityCheckRun): Promise<string> {
  const id = newId("sec");
  const sql = await getSql();
  const hostname = new URL(run.targetUrl).hostname.toLowerCase();
  await sql.query(
    `insert into security_checks
       (id, target_url, hostname, started_at, completed_at, results, limitations, result)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)`,
    [
      id,
      run.targetUrl,
      hostname,
      run.startedAt,
      run.completedAt,
      JSON.stringify(run.results),
      JSON.stringify(run.limitations),
      JSON.stringify({ ...run, id }),
    ],
  );
  return id;
}

export async function listSecurityChecks(limit = 50): Promise<SecurityCheckListItem[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    target_url: string;
    hostname: string;
    started_at: unknown;
    completed_at: unknown;
    results: unknown;
  }>(
    `select id, target_url, hostname, started_at, completed_at, results
       from security_checks
      order by completed_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => {
    const results = parseJson<SecurityCheckResult[]>(r.results, []);
    return {
      id: r.id,
      targetUrl: r.target_url,
      hostname: r.hostname,
      startedAt: String(r.started_at ?? ""),
      completedAt: String(r.completed_at ?? ""),
      statusCounts: {
        pass: results.filter((x) => x.status === "pass").length,
        fail: results.filter((x) => x.status === "fail").length,
        not_verified: results.filter((x) => x.status === "not-verified").length,
        skipped: results.filter((x) => x.status === "skipped").length,
        error: results.filter((x) => x.status === "error").length,
      },
    };
  });
}

export async function getSecurityCheck(id: string): Promise<SecurityCheckRun | null> {
  const sql = await getSql();
  const rows = await sql.query<{ result: unknown }>(`select result from security_checks where id = $1`, [id]);
  return parseJson<SecurityCheckRun | null>(rows[0]?.result ?? null, null);
}
