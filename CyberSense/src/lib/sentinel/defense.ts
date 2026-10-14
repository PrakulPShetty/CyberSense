import { PATH_BREAK_DIFFICULTY, riskBand, round0, round1 } from "./scoring.ts";
import { generateAttackPaths } from "./graph.ts";
import { buildRisk } from "./risk.ts";
import { newId } from "./ids.ts";
import type {
  Asset,
  AttackGraph,
  AttackPath,
  ControlDef,
  ControlId,
  DefenseStrategy,
  EvidenceRecord,
  OptimizationConstraints,
  OptimizationResult,
  SimulationResult,
  Survivability,
} from "./types.ts";

export const CONTROL_CATALOG: ControlDef[] = [
  {
    id: "MFA",
    name: "Multi-factor authentication",
    description: "Require a second factor on authentication and VPN edges. Modeled as a sharp increase in transition difficulty.",
    category: "identity",
    applicableAssetTypes: ["authentication_endpoint", "identity_surface", "application", "subdomain"],
    estimatedCost: 8,
    implementationDifficulty: "MEDIUM",
    reductionDimensions: ["authentication exposure", "vpn reachability"],
  },
  {
    id: "CREDENTIAL_ROTATION",
    name: "Credential rotation",
    description: "Invalidate modeled secret-material edges originating from public repositories.",
    category: "identity",
    applicableAssetTypes: ["repository", "api", "application"],
    estimatedCost: 5,
    implementationDifficulty: "LOW",
    reductionDimensions: ["inferred repo-to-staging"],
  },
  {
    id: "REMOVE_PUBLIC_EXPOSURE",
    name: "Remove public exposure",
    description: "Block INTERNET reaches and EXPOSES edges for non-production or sensitive assets.",
    category: "exposure",
    applicableAssetTypes: ["staging_environment", "development_environment", "application", "service"],
    estimatedCost: 12,
    implementationDifficulty: "MEDIUM",
    reductionDimensions: ["external exposure"],
  },
  {
    id: "RESTRICT_EXTERNAL_ACCESS",
    name: "Restrict external access",
    description: "Block INTERNET → VPN / CI / admin reaches.",
    category: "network",
    applicableAssetTypes: ["subdomain", "development_environment"],
    estimatedCost: 10,
    implementationDifficulty: "MEDIUM",
    reductionDimensions: ["vpn", "ci", "admin"],
  },
  {
    id: "NETWORK_SEGMENTATION",
    name: "Network segmentation",
    description: "Increase difficulty of CONNECTED_TO, ASSOCIATED_WITH, and DEPENDS_ON between tiers.",
    category: "network",
    applicableAssetTypes: ["application", "api", "data_asset", "staging_environment"],
    estimatedCost: 18,
    implementationDifficulty: "HIGH",
    reductionDimensions: ["lateral movement"],
  },
  {
    id: "DISABLE_UNNECESSARY_SERVICE",
    name: "Disable unnecessary service",
    description: "Remove CI / historical VPN services from the modeled graph.",
    category: "hardening",
    applicableAssetTypes: ["development_environment", "service", "subdomain"],
    estimatedCost: 6,
    implementationDifficulty: "LOW",
    reductionDimensions: ["shadow services"],
  },
  {
    id: "REMOVE_PUBLIC_REPOSITORY",
    name: "Remove or privatize public repository",
    description: "Drop REFERENCES edges from public repositories.",
    category: "supply_chain",
    applicableAssetTypes: ["repository"],
    estimatedCost: 4,
    implementationDifficulty: "LOW",
    reductionDimensions: ["repo exposure"],
  },
  {
    id: "IMPROVE_ACCESS_CONTROL",
    name: "Improve access control",
    description: "Raise difficulty on AUTHENTICATES and administrative edges.",
    category: "identity",
    applicableAssetTypes: ["application", "authentication_endpoint"],
    estimatedCost: 9,
    implementationDifficulty: "MEDIUM",
    reductionDimensions: ["authz"],
  },
  {
    id: "WAF",
    name: "Web application firewall",
    description: "Increase difficulty of INTERNET reaches to public applications.",
    category: "edge",
    applicableAssetTypes: ["application", "api", "authentication_endpoint"],
    estimatedCost: 11,
    implementationDifficulty: "MEDIUM",
    reductionDimensions: ["application exposure"],
  },
  {
    id: "PRIVILEGED_ACCESS_CONTROL",
    name: "Privileged access control",
    description: "Block or harden administrative portal paths to crown jewels.",
    category: "identity",
    applicableAssetTypes: ["application", "data_asset"],
    estimatedCost: 14,
    implementationDifficulty: "HIGH",
    reductionDimensions: ["admin"],
  },
];

const COST = Object.fromEntries(CONTROL_CATALOG.map((c) => [c.id, c.estimatedCost])) as Record<ControlId, number>;

function cloneGraph(graph: AttackGraph): AttackGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n })),
    edges: graph.edges.map((e) => ({
      ...e,
      evidenceIds: [...e.evidenceIds],
      controlDependencies: [...e.controlDependencies],
      assumptions: [...e.assumptions],
    })),
  };
}

function nodeLabel(graph: AttackGraph, nodeId: string): string {
  return graph.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
}

function assetOf(graph: AttackGraph, nodeId: string, assets: Asset[]): Asset | undefined {
  const assetId = graph.nodes.find((n) => n.id === nodeId)?.assetId;
  return assets.find((a) => a.id === assetId);
}

/** Deterministic control effects. The LLM never decides graph mutations. */
export function applyControls(graph: AttackGraph, assets: Asset[], controls: ControlId[]): { graph: AttackGraph; changed: string[] } {
  const g = cloneGraph(graph);
  const changed: string[] = [];
  const set = new Set(controls);

  for (const e of g.edges) {
    const src = nodeLabel(g, e.source);
    const dst = nodeLabel(g, e.target);
    const srcAsset = assetOf(g, e.source, assets);
    const dstAsset = assetOf(g, e.target, assets);
    let difficulty = e.difficulty;
    let blocked = e.blocked;

    if (set.has("MFA")) {
      if (e.type === "AUTHENTICATES" || src.startsWith("vpn.") || dst.startsWith("vpn.") || src.startsWith("auth.") || dst.startsWith("idp.")) {
        difficulty += 48;
      }
    }
    if (set.has("CREDENTIAL_ROTATION") && e.type === "REFERENCES") {
      difficulty += 40;
    }
    if (set.has("REMOVE_PUBLIC_REPOSITORY") && (srcAsset?.type === "repository" || e.type === "REFERENCES")) {
      blocked = true;
    }
    if (set.has("REMOVE_PUBLIC_EXPOSURE")) {
      const sensitive =
        dstAsset?.type === "staging_environment" ||
        dstAsset?.type === "development_environment" ||
        dst.startsWith("staging.") ||
        dst.startsWith("jenkins.") ||
        dst.startsWith("admin.") ||
        dst.startsWith("dev.");
      if (e.type === "REACHES" && sensitive) blocked = true;
      if (e.type === "EXPOSES" && sensitive) blocked = true;
    }
    if (set.has("RESTRICT_EXTERNAL_ACCESS") && e.type === "REACHES") {
      if (/^(vpn|old-vpn|jenkins|admin)\./.test(dst) || dstAsset?.type === "development_environment") blocked = true;
    }
    if (set.has("NETWORK_SEGMENTATION")) {
      if (e.type === "CONNECTS_TO" || e.type === "ASSOCIATED_WITH" || e.type === "DEPENDS_ON") difficulty += 36;
    }
    if (set.has("DISABLE_UNNECESSARY_SERVICE")) {
      if (src.startsWith("jenkins.") || dst.startsWith("jenkins.") || src.startsWith("old-vpn.") || dst.startsWith("old-vpn.")) {
        blocked = true;
      }
    }
    if (set.has("IMPROVE_ACCESS_CONTROL") && (e.type === "AUTHENTICATES" || src.startsWith("admin.") || dst.startsWith("admin."))) {
      difficulty += 28;
    }
    if (set.has("WAF") && e.type === "REACHES") {
      if (dstAsset?.type === "application" || dstAsset?.type === "api" || dstAsset?.type === "authentication_endpoint") {
        difficulty += 22;
      }
    }
    if (set.has("PRIVILEGED_ACCESS_CONTROL")) {
      if (src.startsWith("admin.") || dst.startsWith("admin.") || e.type === "POTENTIALLY_AFFECTS") difficulty += 40;
    }

    if (difficulty >= PATH_BREAK_DIFFICULTY) blocked = true;
    if (blocked !== e.blocked || difficulty !== e.difficulty) changed.push(e.id);
    e.difficulty = Math.min(100, difficulty);
    e.blocked = blocked;
  }

  return { graph: g, changed: [...new Set(changed)] };
}

export function survivability(before: AttackPath[], after: AttackPath[], beforeRisk: number, afterRisk: number): Survivability {
  const beforeIds = new Set(before.map((p) => p.nodeIds.join(">")));
  const afterKeys = new Set(after.map((p) => p.nodeIds.join(">")));
  const removed = before.filter((p) => !afterKeys.has(p.nodeIds.join(">")));
  const surviving = after;
  const crownBefore = before.filter((p) => p.crownJewel).length;
  const jewelsBefore = new Set(before.filter((p) => p.crownJewel).map((p) => p.destinationAssetId));
  const jewelsAfter = new Set(after.filter((p) => p.crownJewel).map((p) => p.destinationAssetId));
  return {
    totalPathsBefore: before.length,
    totalPathsAfter: after.length,
    criticalBefore: before.filter((p) => p.risk >= 80 && p.crownJewel).length || crownBefore,
    criticalAfter: after.filter((p) => p.risk >= 80 && p.crownJewel).length,
    highBefore: before.filter((p) => p.risk >= 60).length,
    highAfter: after.filter((p) => p.risk >= 60).length,
    crownJewelReachabilityBefore: jewelsBefore.size,
    crownJewelReachabilityAfter: jewelsAfter.size,
    residualRisk: afterRisk,
    residualBand: riskBand(afterRisk),
    removedPathIds: removed.map((p) => p.id),
    survivingPathIds: surviving.map((p) => p.id),
  };
}

export function simulateDefense(args: {
  assessmentId: string;
  name: string;
  controls: ControlId[];
  graph: AttackGraph;
  paths: AttackPath[];
  assets: Asset[];
  evidence: EvidenceRecord[];
  now: string;
}): SimulationResult {
  const { graph: nextGraph, changed } = applyControls(args.graph, args.assets, args.controls);
  const nextPaths = generateAttackPaths(args.assessmentId, nextGraph, args.assets);
  const nextRisk = buildRisk(args.assessmentId, nextGraph, nextPaths, args.assets, args.evidence, args.now);
  const beforeRisk = args.paths.length ? round0(args.paths.reduce((s, p) => Math.max(s, p.risk), 0) * 0 + (nextRisk.overallScore >= 0 ? 0 : 0)) : 0;
  // Use provided current overall from max of current path risks' assessment: caller passes scored paths
  const currentOverall = args.paths.length
    ? round0(args.paths.slice().sort((a, b) => b.risk - a.risk).slice(0, 5).reduce((s, p, _, arr) => s + p.risk / arr.length, 0))
    : 12;
  const surv = survivability(args.paths, nextPaths, currentOverall, nextRisk.overallScore);
  surv.residualRisk = nextRisk.overallScore;
  surv.residualBand = nextRisk.band;
  return {
    id: newId("sim"),
    assessmentId: args.assessmentId,
    name: args.name,
    controlIds: args.controls,
    survivability: surv,
    beforeRisk: currentOverall,
    afterRisk: nextRisk.overallScore,
    afterBand: nextRisk.band,
    afterPaths: nextPaths,
    afterGraph: nextGraph,
    afterRiskAssessment: nextRisk,
    changedEdgeIds: changed,
    createdAt: args.now,
  };
}

function combinations<T>(items: T[], maxLen: number): T[][] {
  const out: T[][] = [[]];
  for (const item of items) {
    const add: T[][] = [];
    for (const prev of out) {
      if (prev.length < maxLen) add.push([...prev, item]);
    }
    out.push(...add);
  }
  return out.filter((c) => c.length > 0);
}

export function optimizeDefense(args: {
  assessmentId: string;
  graph: AttackGraph;
  paths: AttackPath[];
  assets: Asset[];
  evidence: EvidenceRecord[];
  constraints: OptimizationConstraints;
  now: string;
}): OptimizationResult {
  const excluded = new Set(args.constraints.excluded);
  const required = args.constraints.required;
  const pool = CONTROL_CATALOG.map((c) => c.id).filter((id) => !excluded.has(id));
  const max = Math.min(args.constraints.maxControls, 3);
  const combos = combinations(pool, max).filter((c) => required.every((r) => c.includes(r)));
  const scored: DefenseStrategy[] = [];

  for (const combo of combos) {
    const cost = combo.reduce((s, id) => s + COST[id], 0);
    if (args.constraints.budget != null && cost > args.constraints.budget) continue;
    const sim = simulateDefense({
      assessmentId: args.assessmentId,
      name: combo.join("+"),
      controls: combo,
      graph: args.graph,
      paths: args.paths,
      assets: args.assets,
      evidence: args.evidence,
      now: args.now,
    });
    const reduction = sim.beforeRisk - sim.afterRisk;
    if (args.constraints.minimumRiskReduction != null && reduction < args.constraints.minimumRiskReduction) continue;
    const critRemoved = sim.survivability.criticalBefore - sim.survivability.criticalAfter;
    const efficiency = cost > 0 ? reduction / cost : reduction;
    scored.push({
      id: newId("str"),
      name: combo.map((id) => CONTROL_CATALOG.find((c) => c.id === id)?.name ?? id).join(" + "),
      items: combo.map((id) => ({
        controlId: id,
        reason: CONTROL_CATALOG.find((c) => c.id === id)?.description ?? id,
      })),
      totalCost: cost,
      controlCount: combo.length,
      criticalPathsRemoved: Math.max(0, critRemoved),
      criticalPathSurvival: sim.survivability.criticalAfter,
      residualRisk: sim.afterRisk,
      riskReduction: reduction,
      costPerRisk: reduction > 0 ? round1(cost / reduction) : 99,
      defenseEfficiency: round1(efficiency),
      recommendationConfidence: 0.78,
      whySelected: "",
      whyRejected: null,
    });
  }

  scored.sort((a, b) => {
    if (b.criticalPathsRemoved !== a.criticalPathsRemoved) return b.criticalPathsRemoved - a.criticalPathsRemoved;
    if (b.riskReduction !== a.riskReduction) return b.riskReduction - a.riskReduction;
    return a.totalCost - b.totalCost;
  });

  const top = scored.slice(0, 5);
  if (top[0]) {
    top[0].whySelected =
      `Removes ${top[0].criticalPathsRemoved} critical modeled path(s) with residual risk ${top[0].residualRisk} at estimated cost ${top[0].totalCost}. Defense Efficiency is a SENTINEL-X project metric (risk reduction / estimated cost), not financial truth.`;
  }
  for (let i = 1; i < top.length; i += 1) {
    top[i].whyRejected = `Alternative: fewer critical-path removals or weaker efficiency than ${top[0].name}.`;
  }

  return {
    id: newId("opt"),
    assessmentId: args.assessmentId,
    constraints: args.constraints,
    strategies: top,
    selectedStrategyId: top[0]?.id ?? null,
    createdAt: args.now,
  };
}
