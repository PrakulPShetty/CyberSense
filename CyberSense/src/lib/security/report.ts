import { buildReportPdf, toneFor, type PdfBlock } from "../pdf.ts";
import type { SecurityCheckResult, SecurityCheckRun } from "./checks.ts";

/**
 * Security check report presentation.
 *
 * The report prints exactly what the run observed: the expected condition, the
 * observed value, the status and any limitation recorded with it. It never
 * upgrades an observation into a conclusion about the site's security.
 */
const STATUS_ORDER: Array<SecurityCheckResult["status"]> = ["error", "fail", "not-verified", "skipped", "pass"];

function statusLabel(status: SecurityCheckResult["status"]): string {
  return status === "not-verified" ? "not verified" : status.charAt(0).toUpperCase() + status.slice(1);
}

export function buildSecurityReportPdf(run: SecurityCheckRun): string {
  const counts = {
    pass: run.results.filter((r) => r.status === "pass").length,
    fail: run.results.filter((r) => r.status === "fail").length,
    notVerified: run.results.filter((r) => r.status === "not-verified").length,
    skipped: run.results.filter((r) => r.status === "skipped").length,
    error: run.results.filter((r) => r.status === "error").length,
  };

  const blocks: PdfBlock[] = [
    {
      type: "cover",
      brand: "CyberSense",
      title: "Website Security Configuration Report",
      subtitle: "Observed HTTP, TLS and cookie configuration from an ordinary request — no exploitation",
      target: run.targetUrl,
      meta: [
        ["Report ID", run.id ?? "not persisted"],
        ["Observation window", `${run.startedAt} to ${run.completedAt}`],
        ["Checks executed", String(run.results.length)],
        ["Report generated", new Date().toISOString()],
      ],
    },
    { type: "heading", text: "Executive summary" },
    {
      type: "paragraph",
      text:
        `CyberSense made an ordinary request to ${run.targetUrl} and recorded what the response already exposed: ` +
        `${counts.pass} check(s) passed, ${counts.fail} failed, ${counts.notVerified} could not be verified, ` +
        `${counts.skipped} were skipped and ${counts.error} returned an error. A failed check means the observed ` +
        "configuration did not meet the expected condition — it is not evidence that the site was compromised.",
    },
    {
      type: "metrics",
      items: [
        { label: "Passed", value: String(counts.pass), tone: "minor" },
        { label: "Failed", value: String(counts.fail), tone: counts.fail > 0 ? "critical" : "unknown" },
        { label: "Not verified", value: String(counts.notVerified), tone: "serious" },
        { label: "Skipped / error", value: String(counts.skipped + counts.error) },
      ],
    },
    { type: "heading", text: "Observed checks" },
  ];

  const ordered = [...run.results].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  let index = 0;
  for (const result of ordered) {
    index += 1;
    const lines: Extract<PdfBlock, { type: "finding" }>["lines"] = [
      { label: "Status:", text: statusLabel(result.status), tone: toneFor(result.status) },
      { label: "Expected:", text: result.expected },
    ];
    lines.push({ label: "Observed:", text: result.observed.slice(0, 300) });
    if (result.severityRationale) lines.push({ label: "Why it matters:", text: result.severityRationale });
    if (result.limitation) lines.push({ label: "Limitation:", text: result.limitation });
    lines.push({
      label: "Remediation:",
      text:
        "Apply the documented configuration for this check, then re-run the check to confirm the observed value " +
        "changed. This is advisory guidance only.",
    });

    blocks.push({
      type: "finding",
      index,
      id: result.id,
      title: result.description,
      severity: statusLabel(result.status),
      tone: toneFor(result.status),
      lines,
    });
  }

  if (run.results.length === 0) {
    blocks.push({
      type: "note",
      title: "No check results recorded",
      text: "The run did not produce any observable result. Re-run the checks against an authorized target.",
    });
  }

  blocks.push({ type: "heading", text: "What this report does not establish" });
  blocks.push({
    type: "bullets",
    items: [
      "A passing check means the expected condition was observed in this response at this moment — not that the site is secure.",
      "A failing check is a configuration observation. It is not evidence that a weakness was exploited.",
      "Cookies issued after sign-in, later responses, and behaviour behind authentication were not observed.",
      "No port scanning, vulnerability matching, payload delivery or account testing is performed.",
    ],
  });

  blocks.push({ type: "heading", text: "Recorded limitations" });
  blocks.push({ type: "bullets", items: run.limitations.length > 0 ? run.limitations : ["No additional limitations were recorded for this run."] });

  return buildReportPdf({ brand: "CyberSense", context: `Security report · ${run.targetUrl}`, blocks });
}
