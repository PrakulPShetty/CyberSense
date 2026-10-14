import type { A11yRuleResult, A11yScanRecord } from "./types.ts";

export interface A11yRecommendation {
  findingId: string;
  priority: number;
  problem: string;
  why: string;
  steps: string[];
  example: string;
  verify: string;
  caveat: string;
}

function priorityFor(impact: string | null): number {
  switch (impact) {
    case "critical": return 1;
    case "serious": return 2;
    case "moderate": return 3;
    case "minor": return 4;
    default: return 5;
  }
}

export function buildRecommendations(scan: A11yScanRecord): A11yRecommendation[] {
  return scan.violations
    .map((v: A11yRuleResult) => ({
      findingId: v.id,
      priority: priorityFor(v.impact),
      problem: v.help || v.description,
      why: v.description,
      steps: [
        "Locate the flagged elements using the evidence selectors.",
        "Apply the suggested remediation and review the help URL.",
        "Retest with CyberSense and manual checks.",
      ],
      example: v.helpUrl ? `Reference: ${v.helpUrl}` : "Follow axe-core guidance for this rule.",
      verify: "Re-run the accessibility scan and confirm the rule no longer fails.",
      caveat: "Automated fixes may not resolve all accessibility barriers; manual testing is required.",
    }))
    .sort((a, b) => a.priority - b.priority);
}
