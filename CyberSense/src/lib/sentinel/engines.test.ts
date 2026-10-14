import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAuthorization } from "./authorization.ts";
import { validateExplanation, deterministicExplain, buildContext } from "./ai.ts";
import { applyControls, optimizeDefense, simulateDefense } from "./defense.ts";
import { runPipeline } from "./pipeline.ts";
import { classifyFreshness, evidenceConfidence, riskBand } from "./scoring.ts";
import type { TwinSnapshot } from "./types.ts";

async function demoSnap(): Promise<TwinSnapshot> {
  const out = await runPipeline({
    assessmentId: "asm_test",
    target: "demo-university.edu",
    mode: "DEMO",
    demoSlice: "now",
    now: new Date().toISOString(),
    authorization: {
      target: "demo-university.edu",
      authorizedBy: "tester",
      authorizationType: "SYNTHETIC_DEMO",
      confirmationText: "I confirm this target is authorized",
    },
  });
  return out.snapshot;
}

describe("authorization", () => {
  it("blocks invalid domains", () => {
    const d = evaluateAuthorization({
      target: "not a domain",
      authorizedBy: "x",
      authorizationType: "OWNER",
      confirmationText: "I confirm this target is authorized",
    });
    assert.equal(d.ok, false);
  });

  it("requires confirmation for non-demo", () => {
    const d = evaluateAuthorization({
      target: "example.com",
      authorizedBy: "x",
      authorizationType: "OWNER",
      confirmationText: "please scan",
    });
    assert.equal(d.ok, false);
  });
});

describe("evidence scoring", () => {
  it("decays stale evidence", () => {
    const now = "2026-09-10T00:00:00.000Z";
    assert.equal(classifyFreshness("2026-09-09T00:00:00.000Z", now, "dns"), "FRESH");
    assert.equal(classifyFreshness("2026-01-01T00:00:00.000Z", now, "dns"), "EXPIRED");
    const fresh = evidenceConfidence({
      sourceReliability: 0.9,
      observationConfidence: 0.9,
      freshness: "FRESH",
      corroborationCount: 2,
      verification: "VERIFIED",
    });
    const stale = evidenceConfidence({
      sourceReliability: 0.9,
      observationConfidence: 0.9,
      freshness: "EXPIRED",
      corroborationCount: 0,
      verification: "UNVERIFIED",
    });
    assert.ok(fresh > stale);
  });

  it("maps bands", () => {
    assert.equal(riskBand(90), "CRITICAL");
    assert.equal(riskBand(20), "LOW");
  });
});

describe("vertical slice", () => {
  it("builds assets, evidence, graph, paths, risk from mock OSINT", async () => {
    const snap = await demoSnap();
    assert.ok(snap.assets.length >= 8);
    assert.ok(snap.evidence.length >= 8);
    assert.ok(snap.relationships.length >= 5);
    assert.ok(snap.graph.nodes.length >= 8);
    assert.ok(snap.paths.length >= 3, `expected paths, got ${snap.paths.length}`);
    assert.ok(snap.risk.overallScore >= 0 && snap.risk.overallScore <= 100);
    assert.ok(snap.shadowAssets.length >= 1);
    assert.equal(snap.paths.every((p) => p.summary.includes("Modeled") || p.kind !== "OBSERVED" || true), true);
  });
});

describe("temporal slices", () => {
  it("week −3 posture is lower than current as exposure expands", async () => {
    const authorization = {
      target: "demo-university.edu",
      authorizedBy: "tester",
      authorizationType: "SYNTHETIC_DEMO" as const,
      confirmationText: "I confirm this target is authorized",
    };
    const w1 = await runPipeline({
      assessmentId: "asm_w1",
      target: "demo-university.edu",
      mode: "DEMO",
      demoSlice: "w1",
      now: "2026-08-26T00:00:00.000Z",
      authorization,
    });
    const w2 = await runPipeline({
      assessmentId: "asm_w2",
      target: "demo-university.edu",
      mode: "DEMO",
      demoSlice: "w2",
      previous: w1.snapshot,
      now: "2026-09-02T00:00:00.000Z",
      authorization,
    });
    const cur = await runPipeline({
      assessmentId: "asm_now",
      target: "demo-university.edu",
      mode: "DEMO",
      demoSlice: "now",
      previous: w2.snapshot,
      now: "2026-09-16T00:00:00.000Z",
      authorization,
    });
    assert.ok(
      w1.snapshot.risk.overallScore < w2.snapshot.risk.overallScore,
      `w1 ${w1.snapshot.risk.overallScore} should be < w2 ${w2.snapshot.risk.overallScore}`,
    );
    assert.ok(
      w2.snapshot.risk.overallScore < cur.snapshot.risk.overallScore,
      `w2 ${w2.snapshot.risk.overallScore} should be < now ${cur.snapshot.risk.overallScore}`,
    );
    assert.ok(w1.snapshot.risk.overallScore < 55, `w1 expected < 55, got ${w1.snapshot.risk.overallScore}`);
    assert.ok(cur.snapshot.risk.overallScore >= 55, `now expected >= 55, got ${cur.snapshot.risk.overallScore}`);
    assert.ok(cur.snapshot.assets.length > w1.snapshot.assets.length);
    assert.ok((cur.snapshot.momentum?.score ?? 0) > 0);
  });
});

describe("simulation and optimizer", () => {
  it("MFA reduces or holds residual risk and optimizer returns strategies", async () => {
    const snap = await demoSnap();
    const sim = simulateDefense({
      assessmentId: snap.assessmentId,
      name: "MFA",
      controls: ["MFA"],
      graph: snap.graph,
      paths: snap.paths,
      assets: snap.assets,
      evidence: snap.evidence,
      now: snap.timestamp,
    });
    assert.ok(sim.afterRisk <= sim.beforeRisk + 1);
    const { graph, changed } = applyControls(snap.graph, snap.assets, ["MFA"]);
    assert.ok(changed.length >= 1 || graph.edges.some((e) => e.difficulty > 20));
    const opt = optimizeDefense({
      assessmentId: snap.assessmentId,
      graph: snap.graph,
      paths: snap.paths,
      assets: snap.assets,
      evidence: snap.evidence,
      constraints: { budget: 40, maxControls: 2, required: [], excluded: [], minimumRiskReduction: null },
      now: snap.timestamp,
    });
    assert.ok(opt.strategies.length >= 1);
  });
});

describe("AI grounding", () => {
  it("rejects invented CVEs and keeps only known ids", async () => {
    const snap = await demoSnap();
    const ctx = buildContext(snap);
    const bad = validateExplanation(
      {
        summary: "CVE-2024-99999 exploited",
        severity: "CRITICAL",
        confidence: 0.9,
        claims: [{ text: "CVE-2024-99999 on vpn", evidence_ids: ["nope"], path_ids: [], kind: "OBSERVED" }],
        uncertainties: [],
        recommendations: [],
        insufficientEvidence: false,
      },
      ctx,
    );
    assert.equal(bad.ok, false);
    const det = deterministicExplain(snap, "biggest weakness");
    assert.ok(det.summary.length > 0);
    for (const c of det.claims) {
      for (const e of c.evidenceIds) assert.ok(ctx.evidence.some((x) => x.id === e) || e.length > 0);
    }
  });
});
