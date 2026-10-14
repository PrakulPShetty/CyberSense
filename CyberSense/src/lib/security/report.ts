import { buildTextPdf } from "../pdf.ts";
import type { SecurityCheckRun } from "./checks.ts";

export function buildSecurityReportPdf(run: SecurityCheckRun): string {
  const lines: string[] = [];
  lines.push("CyberSense Website Security Check Report");
  lines.push(`Report generated: ${new Date().toISOString()}`);
  lines.push(`Check ID: ${run.id ?? "not persisted"}`);
  lines.push(`Target URL: ${run.targetUrl}`);
  lines.push(`Observed: ${run.startedAt} to ${run.completedAt}`);
  lines.push("");
  lines.push(
    "Summary: This report records observed website security configuration checks. It does not prove that the website is secure, and it does not prove that any observed weakness has been exploited.",
  );
  lines.push("");
  for (const result of run.results) {
    lines.push(`- Check: ${result.description}`);
    lines.push(`  ID: ${result.id}`);
    lines.push(`  Expected: ${result.expected}`);
    lines.push(`  Observed: ${result.observed}`);
    lines.push(`  Status: ${result.status.toUpperCase()}`);
    if (result.severityRationale) lines.push(`  Severity rationale: ${result.severityRationale}`);
    if (result.limitation) lines.push(`  Limitation: ${result.limitation}`);
    lines.push("  Remediation: Use the security assistant guidance for this check and re-run the check to verify.");
  }
  lines.push("");
  lines.push("Overall limitations:");
  for (const limitation of run.limitations) lines.push(`- ${limitation}`);
  return buildTextPdf(lines);
}
