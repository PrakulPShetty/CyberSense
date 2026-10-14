import type { A11yRuleResult, A11yScanRecord } from "./types.ts";

export interface A11yFindingExplanation {
  findingId: string;
  ruleId: string;
  impact: string;
  what: string;
  why: string;
  who: string;
  steps: string[];
  example: string;
  where: string;
  verify: string;
  limitations: string[];
}

const RULE_STEPS: Record<string, { why: string; who: string; steps: string[]; example: string; where: string; verify: string }> = {
  "color-contrast": {
    why: "Low color contrast makes text hard to read, especially for users with low vision or color blindness.",
    who: "Users with low vision, color sensitivity, or viewing on dim screens.",
    steps: ["Measure foreground/background contrast for the failing element.", "Increase contrast to at least 4.5:1 (or 3:1 for large text).", "Re-run the scan to confirm."],
    example: "/* ensure contrast >= 4.5:1 */\ntext-color: #111; background-color: #fff;",
    where: "The flagged element selector shown in evidence.",
    verify: "Re-run CyberSense accessibility scan; the rule should no longer fail.",
  },
  "image-alt": {
    why: "Missing alternative text leaves screen reader users unable to understand image purpose.",
    who: "Blind and low-vision users using screen readers.",
    steps: ["Add a descriptive alt attribute to each flagged image.", "Use alt=\"\" only for decorative images.", "Re-run the scan."],
    example: '<img src="photo.jpg" alt="Description of the image" />',
    where: "Flagged image element selector.",
    verify: "Re-run the scan; image-alt should not flag the elements.",
  },
  "label": {
    why: "Form controls without labels are unusable for assistive technology users.",
    who: "Screen reader users and keyboard-only users.",
    steps: ["Associate a <label for=\"id\"> with each input.", "Or use aria-label/aria-labelledby.", "Re-run the scan."],
    example: '<label for="email">Email</label>\n<input id="email" type="email" />',
    where: "Flagged form control selector.",
    verify: "Re-run the scan; label rule should pass.",
  },
};

function fallbackFor(rule: A11yRuleResult): A11yFindingExplanation {
  return {
    findingId: rule.id,
    ruleId: rule.id,
    impact: rule.impact ?? "unknown",
    what: rule.help || rule.description || `Accessibility rule ${rule.id} failed.`,
    why: "This issue can make content harder to use for people relying on assistive technologies.",
    who: "People using screen readers, keyboard navigation, or other assistive technologies.",
    steps: [
      "Review the flagged element and its surrounding context.",
      "Apply the guidance in help URL.",
      "Retest the page with CyberSense and manual checks.",
    ],
    example: rule.helpUrl ? `See: ${rule.helpUrl}` : "No example available; follow axe-core guidance.",
    where: "Flagged element selectors shown in evidence.",
    verify: "Re-run the accessibility scan and confirm the rule is gone; perform manual keyboard/screen reader checks.",
    limitations: [],
  };
}

export function explainFinding(scan: A11yScanRecord, findingId?: string): A11yFindingExplanation {
  const rule = scan.violations.find((v) => v.id === findingId) ?? scan.violations[0];
  if (!rule) {
    return {
      findingId: findingId ?? "none",
      ruleId: findingId ?? "none",
      impact: "unknown",
      what: "No accessibility violation records were found in this scan.",
      why: "Cannot explain a finding that was not detected.",
      who: "Not applicable.",
      steps: ["Run another scan or inspect manual accessibility checks."],
      example: "N/A",
      where: "N/A",
      verify: "N/A",
      limitations: scan.limitations,
    };
  }
  const base = RULE_STEPS[rule.id];
  const node = rule.nodes[0];
  const selectors = node?.target?.join(" > ") ?? "unknown element";
  if (!base) {
    const f = fallbackFor(rule);
    f.limitations = scan.limitations;
    return f;
  }
  return {
    findingId: rule.id,
    ruleId: rule.id,
    impact: rule.impact ?? "unknown",
    what: `${rule.help}. ${rule.description}`,
    why: base.why,
    who: base.who,
    steps: base.steps,
    example: base.example,
    where: `${selectors}${node?.html ? ` (HTML: ${node.html.slice(0, 200)})` : ""}`,
    verify: base.verify,
    limitations: scan.limitations,
  };
}
