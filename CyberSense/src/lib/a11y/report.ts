import { buildReportPdf, toneFor, type PdfBlock, type PdfTone } from "../pdf.ts";
import type { A11yImpact, A11yRuleResult, A11yScanRecord } from "./types.ts";

/**
 * Accessibility report presentation.
 *
 * Every value below is read from the stored scan record (`scan.summary`,
 * `scan.violations`, `scan.incomplete`, `scan.limitations`). Nothing is
 * recomputed, and no metric is added that the product did not already store.
 */
const IMPACT_ORDER: (A11yImpact | "unknown")[] = ["critical", "serious", "moderate", "minor", "unknown"];
const MAX_NODES_IN_REPORT = 3;
const MAX_HTML_CHARS = 220;

function impactLabel(impact: A11yImpact | "unknown"): string {
  return impact.charAt(0).toUpperCase() + impact.slice(1);
}

function findingBlocks(scan: A11yScanRecord): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  let index = 0;

  const grouped = new Map<A11yImpact | "unknown", A11yRuleResult[]>();
  for (const rule of scan.violations) {
    const key = rule.impact ?? "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), rule]);
  }

  for (const impact of IMPACT_ORDER) {
    const rules = grouped.get(impact);
    if (!rules || rules.length === 0) continue;
    const tone = toneFor(impact);
    blocks.push({
      type: "heading",
      text: `${impactLabel(impact)} — ${rules.length} failing rule${rules.length === 1 ? "" : "s"}`,
    });

    for (const rule of rules) {
      index += 1;
      const lines: Extract<PdfBlock, { type: "finding" }>["lines"] = [
        { label: "Impact:", text: `${rule.impact ?? "unknown"}  ·  Failing elements: ${rule.nodeCount}` },
        { label: "Description:", text: rule.description || rule.help },
      ];
      if (rule.wcagCriteria.length > 0) {
        lines.push({ label: "WCAG:", text: rule.wcagCriteria.join(", ") });
      }

      const shown = rule.nodes.slice(0, MAX_NODES_IN_REPORT);
      shown.forEach((node, nodeIndex) => {
        lines.push({
          label: `Element ${nodeIndex + 1} of ${rule.nodeCount}:`,
          text: node.target.join(" ") || "(no selector stored)",
        });
        if (node.html) {
          lines.push({ text: node.html.slice(0, MAX_HTML_CHARS), mono: true });
        }
        if (node.failureSummary) {
          lines.push({ label: "Engine note:", text: node.failureSummary.replace(/\s+/g, " ") });
        }
      });
      if (rule.nodeCount > shown.length) {
        lines.push({
          label: "Evidence:",
          text:
            `${shown.length} of ${rule.nodeCount} failing elements are printed here; ` +
            "the complete element evidence is stored with the scan and shown in the app.",
        });
      }
      if (rule.helpUrl) {
        lines.push({ label: "Remediation guidance:", text: rule.helpUrl, tone: "brand" as PdfTone });
      }

      blocks.push({
        type: "finding",
        index,
        id: rule.id,
        title: rule.help || rule.description,
        severity: rule.impact ?? "unknown",
        tone,
        lines,
      });
    }
  }

  return blocks;
}

export function buildA11yReportPdf(scan: A11yScanRecord): string {
  const blocks: PdfBlock[] = [];

  blocks.push({
    type: "cover",
    brand: "CyberSense",
    title: "Accessibility & Security Assessment Report",
    subtitle: "Generated from a stored scan record — automated findings, evidence and limitations",
    target: scan.url,
    meta: [
      ["Report ID", scan.id],
      ["Scan date", scan.scannedAt],
      ["Status", scan.status],
      ["Engine", scan.engine],
      ["Page checked", `${scan.page.finalUrl} — "${scan.page.title || "(no title)"}"`],
      ["Viewport", `${scan.page.viewport} · ${scan.page.elementCount} elements · loaded in ${scan.page.loadMs} ms`],
      ["Page language", scan.page.lang ?? "(not set)"],
      ["Report generated", new Date().toISOString()],
    ],
  });

  blocks.push({ type: "heading", text: "Executive summary" });
  blocks.push({
    type: "paragraph",
    text:
      `An automated accessibility scan of ${scan.url} recorded ${scan.summary.ruleCount} failing ` +
      `rule(s) affecting ${scan.summary.elementCount} element(s). ${scan.summary.passCount} rule(s) passed, ` +
      `${scan.summary.incompleteCount} could not be decided automatically, and ${scan.summary.inapplicableCount} did not ` +
      "apply to this page. The findings below are the rules axe-core reported against the rendered page, with the " +
      "selectors and HTML the engine captured at the time of the scan.",
  });
  blocks.push({
    type: "paragraph",
    text:
      "This report describes one page, at one viewport, in its initial state. It is not a statement of WCAG " +
      "conformance and it is not a security assessment. Both points are repeated in the limitations section.",
  });

  blocks.push({
    type: "metrics",
    items: [
      { label: "Failing rules", value: String(scan.summary.ruleCount), tone: scan.summary.ruleCount > 0 ? "critical" : "moderate" },
      { label: "Failing elements", value: String(scan.summary.elementCount) },
      { label: "Rules passed", value: String(scan.summary.passCount), tone: "minor" },
      { label: "Undecided rules", value: String(scan.summary.incompleteCount), tone: "serious" },
    ],
  });

  blocks.push({ type: "spacer", height: 4 });
  blocks.push({ type: "subheading", text: "Findings by impact" });
  blocks.push({
    type: "metrics",
    items: IMPACT_ORDER.map((impact) => ({
      label: impactLabel(impact),
      value: String(scan.summary.byImpact[impact] ?? 0),
      tone: scan.summary.byImpact[impact] > 0 ? toneFor(impact) : "unknown",
    })),
  });

  const wcagEntries = Object.entries(scan.summary.byWcagTag);
  if (wcagEntries.length > 0) {
    blocks.push({ type: "spacer", height: 4 });
    blocks.push({ type: "subheading", text: "WCAG tags carried by the failing rules" });
    blocks.push({ type: "paragraph", text: wcagEntries.map(([tag, count]) => `${tag} x ${count}`).join("   ·   ") });
  }

  if (scan.summary.truncated) {
    blocks.push({
      type: "note",
      title: "Stored finding list was capped",
      text:
        "The saved violation list reached the storage cap. The counts in this report are the full totals reported by the " +
        "engine; the findings listed below are those that were stored.",
    });
  }

  if (scan.violations.length > 0) {
    blocks.push({ type: "heading", text: "Detailed findings and evidence" });
    blocks.push(...findingBlocks(scan));
  } else {
    blocks.push({ type: "heading", text: "Detailed findings and evidence" });
    blocks.push({
      type: "note",
      title: "No failing rule was recorded",
      text:
        "axe-core reported no failing rule in the scanned tag set for this page, at this viewport, in this state. This " +
        "confirms those rules did not fail here; it does not confirm that the page is accessible to every user.",
    });
  }

  if (scan.incomplete.length > 0) {
    blocks.push({ type: "heading", text: "Rules that could not be decided automatically" });
    blocks.push({
      type: "paragraph",
      text:
        "These rules require human judgement (for example, deciding whether an image is decorative or whether link text " +
        "is meaningful). They are recorded neither as passes nor as failures.",
    });
    blocks.push({ type: "bullets", items: scan.incomplete.map((rule) => `${rule.id} — ${rule.help || rule.description}`) });
  }

  blocks.push({ type: "heading", text: "Remediation approach" });
  blocks.push({
    type: "bullets",
    items: [
      "Work through the findings in impact order: critical and serious rules first.",
      "Use the stored selector and HTML evidence to locate the exact element that failed.",
      "Apply the documented remediation for the rule and re-run the scan to confirm the rule no longer fails.",
      "Re-test manually with a keyboard, a screen reader and browser zoom — automation covers only part of WCAG.",
    ],
  });

  blocks.push({ type: "heading", text: "Limitations of this scan" });
  blocks.push({ type: "bullets", items: scan.limitations });

  blocks.push({ type: "heading", text: "Conclusion" });
  blocks.push({
    type: "paragraph",
    text:
      `The scan recorded ${scan.summary.ruleCount} failing rule(s) and ${scan.summary.elementCount} affected ` +
      `element(s) on ${scan.page.finalUrl}. Addressing the findings in impact order, then re-scanning to verify the ` +
      "change, is the most reliable way to improve the page. Automated rules cover a subset of WCAG success criteria; " +
      "manual testing remains necessary.",
  });
  blocks.push({
    type: "note",
    title: "Language",
    text:
      "Findings in this report are described as observed or reported by the scanning engine. No finding in this report " +
      "claims that a vulnerability was exploited, and no security conclusion is drawn from accessibility results.",
  });

  return buildReportPdf({ brand: "CyberSense", context: `Accessibility report · ${scan.hostname}`, blocks });
}
