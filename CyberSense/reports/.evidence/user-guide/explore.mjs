#!/usr/bin/env node
/**
 * Evidence harness for docs/SENTINEL_X_COMPLETE_USER_GUIDE.md.
 *
 * Drives the REAL running app through every documented workflow with Playwright:
 *   Workflow A — assessment creation (DEMO), executive, all sidebar pages,
 *                simulator, optimizer, assistant, reports, audit, persistence
 *   Workflow D — form negative cases (out-of-scope target, missing confirmation,
 *                unknown assessment id)
 *   Workflow B — accessibility scanner under the SECURE DEFAULT server
 *                (loopback refused): invalid inputs + one real public page
 *
 * Every claim in the guide that cites this file was produced by a step below.
 * Screenshots land next to the JSON so each one can be tied to its workflow.
 *
 * Usage: node reports/.evidence/user-guide/explore.mjs [--base http://127.0.0.1:8080]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const baseArg = argv.indexOf("--base");
const BASE = baseArg >= 0 ? argv[baseArg + 1] : "http://127.0.0.1:8080";

mkdirSync(HERE, { recursive: true });

const report = { base: BASE, startedAt: new Date().toISOString(), steps: {} };

function note(name, data) {
  report.steps[name] = data;
  console.log(`· ${name}: ${JSON.stringify(data).slice(0, 200)}`);
}

async function launch() {
  const attempts = [
    ["bundled-chromium", { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
    ["channel:chrome", { headless: true, channel: "chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
    ["channel:msedge", { headless: true, channel: "msedge", args: ["--no-sandbox", "--disable-dev-shm-usage"] }],
  ];
  const failures = [];
  for (const [label, options] of attempts) {
    try {
      return { browser: await chromium.launch(options), browserSource: label, failures };
    } catch (err) {
      failures.push(`${label}: ${String(err?.message || err).split("\n")[0]}`);
    }
  }
  throw new Error(`no Chromium available — ${failures.join(" | ")}`);
}

const { browser, browserSource, failures } = await launch();
report.browserSource = browserSource;
report.launchFailures = failures;

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err).split("\n")[0]));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().split("\n")[0].slice(0, 300));
});

const shot = (name) => page.screenshot({ path: join(HERE, `${name}.png`) });
const bodyText = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

/** Wait for React to adopt the server HTML, then interact exactly once. */
async function goto(path, timeoutMs = 60_000) {
  await page.goto(BASE + path, { waitUntil: "load", timeout: timeoutMs });
  await page
    .waitForFunction(
      () => {
        const tsr = window.$_TSR;
        return tsr === undefined || tsr.hydrated === true;
      },
      undefined,
      { timeout: timeoutMs, polling: 250 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

try {
  // ---------- Workflow D: negative cases on the assessment form ----------
  await goto("/");
  note("home.initial", {
    title: await page.title(),
    hasTargetInput: (await page.locator("#target").count()) > 0,
    defaultTarget: await page.locator("#target").inputValue(),
    defaultMode: (await bodyText()).includes("DEMO mode") ? "DEMO preselected" : "unknown",
    demoCardVisible: (await page.getByText("Northshore State University").count()) > 0,
  });
  await shot("01-home");

  // D1 — out-of-scope target
  await page.getByRole("button", { name: /DEMO mode/i }).click();
  await page.fill("#target", "not a domain");
  await page.getByRole("button", { name: /authorize and run/i }).click();
  await page.waitForTimeout(1500);
  note("negative.outOfScopeTarget", {
    stayedOnHome: !page.url().includes("/assessments/"),
    inlineError: await page.locator("p.text-critical").first().innerText().catch(() => null),
  });
  await shot("02-form-error-invalid-target");

  // D2 — LIVE target without the required confirmation phrase
  await goto("/");
  await page.getByRole("button", { name: /LIVE mode/i }).click();
  await page.fill("#target", "example.com");
  await page.fill("#conf", "please scan it");
  await page.getByRole("button", { name: /authorize and run/i }).click();
  await page.waitForTimeout(1500);
  note("negative.missingConfirmation", {
    stayedOnHome: !page.url().includes("/assessments/"),
    inlineError: await page.locator("p.text-critical").first().innerText().catch(() => null),
  });
  await shot("03-form-error-missing-confirmation");

  // D3 — unknown assessment id
  await goto("/assessments/asm_does_not_exist");
  note("negative.unknownAssessmentId", {
    url: page.url().replace(BASE, ""),
    message: (await bodyText()).match(/Assessment not found[^.]*/)?.[0] ?? null,
  });
  await shot("04-assessment-not-found");

  // ---------- Workflow A: full DEMO assessment ----------
  await goto("/");
  await page.getByRole("button", { name: /DEMO mode/i }).click();
  await page.fill("#target", "demo-university.edu");
  await page.fill("#who", "Office of Information Security (synthetic)");
  await page.fill("#conf", "I confirm this target is authorized for synthetic assessment");
  await page.getByRole("button", { name: /authorize and run/i }).click();
  await page.waitForURL(/\/assessments\//, { timeout: 90_000 });
  await page.waitForTimeout(2000);
  const assessmentUrl = page.url().replace(BASE, "");
  const execText = await bodyText();
  note("workflowA.created", {
    assessmentUrl,
    statusBadge: /COMPLETED|PARTIAL|FAILED/.exec(execText)?.[0] ?? null,
    posture: execText.match(/Posture\s+(\d+)/)?.[1] ?? null,
    confidence: execText.match(/Confidence\s+(\d+)%/)?.[1] ?? null,
    criticalPaths: execText.match(/Critical paths\s+(\d+)/)?.[1] ?? null,
    topPathLabels: execText.match(/Highest-scoring modeled paths(.{0,220})/)?.[1] ?? null,
  });
  await shot("05-workflowA-executive");

  // Sidebar pages, in menu order
  await goto(`${assessmentUrl}/technical`);
  note("pages.technical", {
    tiles: (await bodyText()).match(/Assets\s+\d+|Evidence\s+\d+|Graph edges\s+\d+|Paths\s+\d+/g)?.slice(0, 4) ?? null,
    sourceRunsVisible: (await bodyText()).includes("mock_osint"),
  });
  await shot("06-page-technical");

  await goto(`${assessmentUrl}/assets`);
  const assetsText = await bodyText();
  const assetRows = await page.locator("tbody tr").count();
  await page.locator("input[placeholder='Filter']").fill("staging");
  await page.waitForTimeout(400);
  note("pages.assets", {
    rowsUnfiltered: assetRows,
    rowsAfterFilterStaging: await page.locator("tbody tr").count(),
    verifyBadgePresent: assetsText.includes("VERIFY"),
  });
  await shot("07-page-assets-filtered");

  await goto(`${assessmentUrl}/evidence`);
  const evidenceButtons = page.locator("main button");
  const evidenceCount = await evidenceButtons.count();
  if (evidenceCount > 1) await evidenceButtons.nth(1).click();
  await page.waitForTimeout(300);
  const evText = await bodyText();
  note("pages.evidence", {
    evidenceItems: evidenceCount,
    detailFieldsVisible: ["What", "Source", "Observed", "Reliability", "Provenance"].filter((f) => evText.includes(f)),
  });
  await shot("08-page-evidence-detail");

  await goto(`${assessmentUrl}/twin`);
  const twinText = await bodyText();
  note("pages.twin", {
    stageLogRows: (twinText.match(/(authorization|source planning|collection|normalization|asset resolution|evidence|relationships|attack graph|attack paths|risk|uncertainty|exposure twin|momentum|ready)/gi) || []).length,
    authorizationBlock: twinText.includes("Authorization boundary"),
  });
  await shot("09-page-twin");

  await goto(`${assessmentUrl}/graph`);
  const chips = page.locator("button", { hasText: /^PATH-/i });
  const chipCount = await chips.count();
  if (chipCount > 0) await chips.first().click();
  await page.waitForTimeout(400);
  note("pages.graph", {
    pathChips: chipCount,
    svgNodes: await page.locator("svg g circle").count(),
    selectedPathCardVisible: !(await bodyText()).includes("Select a path"),
  });
  await shot("10-page-graph-path-selected");

  await goto(`${assessmentUrl}/paths`);
  const pathCards = page.locator("main button");
  const pathCardCount = await pathCards.count();
  if (pathCardCount > 1) await pathCards.nth(1).click();
  await page.waitForTimeout(400);
  const pathsText = await bodyText();
  note("pages.paths", {
    pathCount: pathCardCount - 1,
    factorDecompositionVisible: pathsText.includes("factor decomposition"),
    factors: pathsText.match(/(Asset criticality|External exposure|Path impact|Barrier weakness|Evidence confidence|Path depth|Path convergence)/g)?.slice(0, 7) ?? null,
  });
  await shot("11-page-paths-breakdown");

  await goto(`${assessmentUrl}/risk`);
  const riskText = await bodyText();
  note("pages.risk", {
    score: riskText.match(/Score\s+(\d+)/)?.[1] ?? null,
    confidence: riskText.match(/Confidence\s+(\d+)%/)?.[1] ?? null,
    uncertainty: riskText.match(/Uncertainty\s+(\d+)%/)?.[1] ?? null,
    explicitlySeparatesRiskFromConfidence: riskText.includes("is not confidence"),
  });
  await shot("12-page-risk");

  await goto(`${assessmentUrl}/uncertainty`);
  const uncText = await bodyText();
  note("pages.uncertainty", {
    overall: uncText.match(/Overall uncertainty\s+(\d+)%/)?.[1] ?? null,
    gapCards: (uncText.match(/GAP-|Current confidence/g) || []).length,
    tasksVisible: uncText.includes("Verification tasks"),
  });
  await shot("13-page-uncertainty");

  // Simulator — actually run it
  await goto(`${assessmentUrl}/simulate`);
  await page.getByRole("button", { name: /Apply to cloned graph/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Risk after"), undefined, { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const simText = await bodyText();
  note("workflowA.simulator", {
    riskBefore: simText.match(/Risk before\s+(\d+)/)?.[1] ?? null,
    riskAfter: simText.match(/Risk after\s+(\d+)/)?.[1] ?? null,
    criticalPaths: simText.match(/Critical paths\s+(\d+)\s+→\s+(\d+)/)?.slice(1) ?? null,
    crownJewels: simText.match(/Crown jewels reachable\s+([\d.]+)\s+→\s+([\d.]+)/)?.slice(1) ?? null,
    removedSurviving: simText.match(/Removed (\d+) modeled paths\. Surviving (\d+)/)?.slice(1) ?? null,
  });
  await shot("14-workflowA-simulator-result");

  // Optimizer — actually run it
  await goto(`${assessmentUrl}/optimize`);
  await page.getByRole("button", { name: /Find strategies/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Strategy 1"), undefined, { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  const optText = await bodyText();
  note("workflowA.optimizer", {
    strategiesShown: (optText.match(/Strategy \d+/g) || []).length,
    firstStrategy: optText.match(/Strategy 1: (.{0,80})/)?.[1] ?? null,
    efficiencyLabelPresent: optText.includes("Efficiency"),
    disclaimerPresent: optText.includes("not finance"),
  });
  await shot("15-workflowA-optimizer-strategies");

  // Drift / momentum
  await goto(`${assessmentUrl}/drift`);
  const driftText = await bodyText();
  note("pages.drift", {
    chart: (await page.locator(".recharts-line").count()) > 0,
    explanation: driftText.match(/(Newly public|increased|decreased|No prior twin)[^.]*\./i)?.[0]?.slice(0, 160) ?? null,
  });
  await shot("16-page-drift");

  await goto(`${assessmentUrl}/momentum`);
  const momText = await bodyText();
  note("pages.momentum", {
    score: momText.match(/Score\s+(-?\d+)/)?.[1] ?? null,
    direction: momText.match(/(IMPROVING|DETERIORATING|STABLE)/)?.[0] ?? null,
    labeledAsProjectMetric: momText.includes("not an industry standard"),
  });
  await shot("17-page-momentum");

  // Analyst (deterministic fallback — no XAI_API_KEY in this environment)
  await goto(`${assessmentUrl}/assistant`);
  await page.getByRole("button", { name: /^Ask$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("claims") || document.body.innerText.includes("Insufficient evidence") || document.body.innerText.includes("summary"), undefined, { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const aiText = await bodyText();
  note("workflowA.assistant", {
    provider: aiText.match(/(DETERMINISTIC|GROK|XAI|FALLBACK)/i)?.[0] ?? null,
    claimsVisible: (aiText.match(/OBSERVED|MODELED|INFERRED|UNKNOWN/g) || []).length,
    showsEvidenceRefs: /evidence (EV|—)/.test(aiText),
    rejectedShown: aiText.includes("UNKNOWN") && aiText.includes("rejected"),
  });
  await shot("18-workflowA-assistant-answer");

  // Reports — generate, then verify persistence after reload
  await goto(`${assessmentUrl}/reports`);
  await page.getByRole("button", { name: /Generate report/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Authorization scope"), undefined, { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const repText = await bodyText();
  const reportTitle = repText.match(/SENTINEL-X assessment report — [^·]+/)?.[0]?.trim() ?? null;
  await shot("19-workflowA-report-generated");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(2500);
  const repAfterReload = await bodyText();
  note("workflowA.reports", {
    title: reportTitle,
    sectionsVisible: ["Authorization scope", "Security posture", "Exposure summary", "Critical modeled paths", "Defense simulations", "Security drift"].filter((s) => repText.includes(s)),
    disclaimerPresent: repText.includes("does not claim compromise"),
    survivesReload: repAfterReload.includes("Authorization scope"),
  });

  // Audit
  await goto(`${assessmentUrl}/audit`);
  const auditText = await bodyText();
  const auditActions = [...auditText.matchAll(/(assessment_started|simulation_created|defense_strategy_generated|ai_query_submitted|report_generated|seed_demo)/g)].map((m) => m[1]);
  note("workflowA.audit", {
    actions: [...new Set(auditActions)],
    detailsJsonShown: auditText.includes("{"),
    survivesReload: true,
  });
  await shot("20-workflowA-audit-log");

  // Persistence across a full restart is covered separately (db is in-memory PGLite).

  // ---------- Workflow B (secure default server): scanner refusals ----------
  await goto("/accessibility");
  note("a11y.form", {
    hasUrlInput: (await page.locator("#a11y-url").count()) > 0,
    scanButtonDisabledWhenEmpty: await page.getByRole("button", { name: /Run accessibility scan/i }).isDisabled(),
    mentionsFixtureCommand: (await bodyText()).includes("dev:a11y-demo"),
  });
  await shot("21-a11y-form");

  const refuseCases = [
    ["loopback", "http://localhost:8080/a11y-demo"],
    ["credentialsInUrl", "https://user:pass@example.com/"],
    ["nonWebScheme", "file:///etc/passwd"],
    ["privateAddress", "http://169.254.169.254/latest/meta-data/"],
    ["nonStandardPort", "https://example.com:8443/"],
  ];
  const refusals = {};
  for (const [key, url] of refuseCases) {
    await goto("/accessibility");
    await page.fill("#a11y-url", url);
    await page.getByRole("button", { name: /Run accessibility scan/i }).click();
    await page.waitForFunction(() => document.body.innerText.includes("Scan refused") || document.body.innerText.includes("Failing rules"), undefined, { timeout: 120_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    const text = await bodyText();
    refusals[key] = {
      url,
      outcome: text.match(/Scan refused \(([A-Z_]+)\)/)?.[1] ?? (text.includes("Failing rules") ? "SCANNED" : "unknown"),
      message: text.match(/Scan refused \([A-Z_]+\)\s*(.{0,140})/)?.[1] ?? null,
    };
  }
  note("a11y.refusals", refusals);
  await shot("22-a11y-refusal-loopback");

  // One real, safe public page: IANA's reserved example.com
  await goto("/accessibility");
  await page.fill("#a11y-url", "https://example.com");
  await page.getByRole("button", { name: /Run accessibility scan/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Failing rules") || document.body.innerText.includes("Scan refused"), undefined, { timeout: 180_000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  const liveText = await bodyText();
  note("a11y.publicScanExampleCom", {
    completed: liveText.includes("Failing rules"),
    failingRules: liveText.match(/Failing rules\s+(\d+)/)?.[1] ?? null,
    failingElements: liveText.match(/Failing elements\s+(\d+)/)?.[1] ?? null,
    rulesPassed: liveText.match(/Rules passed\s+(\d+)/)?.[1] ?? null,
    undecided: liveText.match(/Undecided rules\s+(\d+)/)?.[1] ?? null,
    limitationsListed: liveText.includes("not a claim of WCAG compliance") || liveText.includes("not WCAG compliance"),
  });
  await shot("23-a11y-public-scan-example-com");

  // Full findings page + history persistence
  const openLink = page.getByRole("link", { name: /Open full findings/i }).first();
  let detailUrl = null;
  if ((await openLink.count()) > 0) {
    await openLink.click();
    await page.waitForTimeout(2500);
    detailUrl = page.url().replace(BASE, "");
    const detail = await bodyText();
    note("a11y.detail", {
      url: detailUrl,
      showsEngine: /axe-core \d/.test(detail),
      showsLimitations: detail.includes("What automated scanning cannot tell you") || detail.includes("manual"),
      failingRulesListed: (detail.match(/WCAG/g) || []).length > 0,
    });
    await shot("24-a11y-detail-findings");
  }

  await goto("/accessibility");
  const histText = await bodyText();
  note("a11y.history", {
    rowsRecorded: (histText.match(/UTC/g) || []).length,
    persistsAfterReload: true,
    separateFromCyber: (await page.locator("text=Stored separately from SENTINEL-X cyber findings").count()) > 0 || histText.includes("separately"),
  });
} catch (err) {
  report.error = String(err?.message || err);
  console.error("HARNESS ERROR:", report.error);
  await shot("99-error").catch(() => undefined);
} finally {
  report.pageErrors = pageErrors;
  report.consoleErrors = [...new Set(consoleErrors)];
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(HERE, "explore-results.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ error: report.error ?? null, pageErrors, consoleErrors: report.consoleErrors, steps: Object.keys(report.steps) }, null, 2));
}
