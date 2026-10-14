/**
 * Accessibility (Track D) domain contracts.
 *
 * These are deliberately SEPARATE from the CyberSense cyber exposure model in
 * `@/lib/sentinel/types`: an accessibility violation is a fact about a rendered
 * page, not a modeled attack path, and mixing the two would corrupt both.
 */

export const A11Y_IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
export type A11yImpact = (typeof A11Y_IMPACTS)[number];

export const A11Y_SCAN_STATUSES = ["COMPLETED", "PARTIAL", "FAILED"] as const;
export type A11yScanStatus = (typeof A11Y_SCAN_STATUSES)[number];

/** WCAG success-criterion levels axe tags its rules with. */
export const WCAG_LEVEL_TAGS = ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] as const;

/** A single failing element inside a rule result. */
export interface A11yViolationNode {
  /** CSS selector path axe used to locate the element. */
  target: string[];
  /** Outer HTML of the failing element, truncated for storage. */
  html: string;
  /** axe's plain-language explanation of what is wrong here. */
  failureSummary: string;
}

/** One axe-core rule that failed, with the real instances it found. */
export interface A11yRuleResult {
  id: string;
  impact: A11yImpact | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  /** Total nodes axe flagged — may exceed `nodes.length` when truncated. */
  nodeCount: number;
  /** First `MAX_NODES_PER_RULE` instances, verbatim from axe. */
  nodes: A11yViolationNode[];
  wcagCriteria: string[];
}

export interface A11yScanSummary {
  ruleCount: number;
  /** Every individual failing element across all rules. */
  elementCount: number;
  byImpact: Record<A11yImpact | "unknown", number>;
  /** Rule counts per WCAG tag axe attached (`wcag2a`, `wcag21aa`, ...). */
  byWcagTag: Record<string, number>;
  /** Rules that did not produce a definitive pass or fail. */
  incompleteCount: number;
  passCount: number;
  inapplicableCount: number;
  /** True when the stored violation list was capped — the counts stay honest. */
  truncated: boolean;
}

export interface A11yPageInfo {
  title: string;
  finalUrl: string;
  lang: string | null;
  elementCount: number;
  loadMs: number;
  viewport: string;
}

export interface A11yScanRecord {
  id: string;
  url: string;
  hostname: string;
  status: A11yScanStatus;
  /** Which browser binary actually produced the result. */
  engine: string;
  /** Version string reported by the injected axe-core engine. */
  engineVersion: string;
  scannedAt: string;
  page: A11yPageInfo;
  summary: A11yScanSummary;
  violations: A11yRuleResult[];
  /** Rules axe could not decide — reported, never counted as passes. */
  incomplete: A11yRuleResult[];
  /** Rule ids that ran and found nothing on this page. */
  passes: string[];
  errorCode: string | null;
  errorMessage: string | null;
  /** What automated scanning cannot tell you. Always populated. */
  limitations: string[];
}

/** Row shape for the history list — no per-node payload. */
export interface A11yScanListItem {
  id: string;
  url: string;
  hostname: string;
  status: A11yScanStatus;
  scannedAt: string;
  engine: string;
  summary: A11yScanSummary;
  errorCode: string | null;
}

export type A11yScanOutcome =
  | { ok: true; scan: A11yScanRecord }
  | { ok: false; error_code: string; message: string };
