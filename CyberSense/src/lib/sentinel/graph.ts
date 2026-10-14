import { INTERNET_NODE_ID, MAX_PATH_LENGTH, MAX_PATHS, MIN_EDGE_CONFIDENCE, PATH_BREAK_DIFFICULTY } from "./scoring.ts";
import { stableId } from "./ids.ts";
import type {
  Asset,
  AttackGraph,
  AttackPath,
  ClaimKind,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  RecommendationClass,
  Relationship,
} from "./types.ts";

function nodeTypeFor(asset: Asset): GraphNodeType {
  if (asset.type === "data_asset") return "DATA_ASSET";
  if (asset.type === "identity_surface") return "IDENTITY";
  if (asset.type === "authentication_endpoint") return "AUTHENTICATION";
  if (asset.type === "service") return "SERVICE";
  if (asset.type === "application" || asset.type === "api") return "APPLICATION";
  return "ASSET";
}

export function buildAttackGraph(
  assessmentId: string,
  assets: Asset[],
  relationships: Relationship[],
  now: string,
): AttackGraph {
  const nodes: GraphNode[] = [
    {
      id: INTERNET_NODE_ID,
      type: "INTERNET",
      assetId: null,
      label: "INTERNET",
      criticality: null,
      exposureState: "EXTERNAL",
      confidence: 1,
    },
  ];
  for (const a of assets) {
    if (a.type === "organization") continue;
    nodes.push({
      id: `node_${a.id}`,
      type: nodeTypeFor(a),
      assetId: a.id,
      label: a.displayName,
      criticality: a.criticality,
      exposureState: a.exposureState,
      confidence: a.confidence,
    });
  }
  const nodeByAsset = new Map(nodes.filter((n) => n.assetId).map((n) => [n.assetId as string, n]));
  const edges: GraphEdge[] = [];

  for (const a of assets) {
    if (a.exposureState !== "PUBLIC") continue;
    const n = nodeByAsset.get(a.id);
    if (!n) continue;
    if (a.type === "domain" || a.type === "ip" || a.type === "certificate") continue;
    edges.push({
      id: stableId("gedge", assessmentId, "internet", a.id),
      source: INTERNET_NODE_ID,
      target: n.id,
      type: "REACHES",
      relationshipId: null,
      confidence: Math.min(0.95, a.confidence),
      difficulty: 12,
      evidenceIds: [],
      prerequisites: [],
      controlDependencies: ["REMOVE_PUBLIC_EXPOSURE", "RESTRICT_EXTERNAL_ACCESS", "WAF"],
      blocked: false,
      kind: "OBSERVED",
      assumptions: [],
    });
  }

  for (const r of relationships) {
    const s = nodeByAsset.get(r.sourceAssetId);
    const t = nodeByAsset.get(r.targetAssetId);
    if (!s || !t) continue;
    edges.push({
      id: stableId("gedge", assessmentId, r.id),
      source: s.id,
      target: t.id,
      type: r.type,
      relationshipId: r.id,
      confidence: r.confidence,
      difficulty: r.difficulty,
      evidenceIds: r.evidenceIds,
      prerequisites: [],
      controlDependencies: r.controlDependencies,
      blocked: false,
      kind: r.kind,
      assumptions: r.assumptions,
    });
  }

  return { id: stableId("graph", assessmentId), assessmentId, nodes, edges, generatedAt: now };
}

interface Walk {
  nodeIds: string[];
  edgeIds: string[];
}

function enumeratePaths(graph: AttackGraph, destNodeId: string): Walk[] {
  const out: Walk[] = [];
  const adj = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    if (e.blocked || e.confidence < MIN_EDGE_CONFIDENCE || e.difficulty >= PATH_BREAK_DIFFICULTY) continue;
    const list = adj.get(e.source) ?? [];
    list.push(e);
    adj.set(e.source, list);
  }

  const stack: { node: string; walk: Walk }[] = [{ node: INTERNET_NODE_ID, walk: { nodeIds: [INTERNET_NODE_ID], edgeIds: [] } }];
  while (stack.length && out.length < MAX_PATHS * 3) {
    const cur = stack.pop();
    if (!cur) break;
    if (cur.walk.nodeIds.length > MAX_PATH_LENGTH) continue;
    if (cur.node === destNodeId && cur.walk.edgeIds.length > 0) {
      out.push(cur.walk);
      continue;
    }
    const edges = adj.get(cur.node) ?? [];
    for (const e of edges) {
      if (cur.walk.nodeIds.includes(e.target)) continue;
      stack.push({
        node: e.target,
        walk: {
          nodeIds: [...cur.walk.nodeIds, e.target],
          edgeIds: [...cur.walk.edgeIds, e.id],
        },
      });
    }
  }
  return out
    .sort((a, b) => a.edgeIds.length - b.edgeIds.length)
    .slice(0, MAX_PATHS);
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function generateAttackPaths(
  assessmentId: string,
  graph: AttackGraph,
  assets: Asset[],
): AttackPath[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(graph.edges.map((e) => [e.id, e]));
  const crown = assets.filter((a) => a.criticality === "CRITICAL" || a.criticality === "HIGH");
  const paths: AttackPath[] = [];
  let seq = 1;

  for (const asset of crown) {
    const dest = graph.nodes.find((n) => n.assetId === asset.id);
    if (!dest) continue;
    const walks = enumeratePaths(graph, dest.id);
    for (const w of walks) {
      const edges = w.edgeIds.map((id) => edgeById.get(id)!).filter(Boolean);
      const nodes = w.nodeIds.map((id) => nodeById.get(id)!).filter(Boolean);
      const confidence = mean(edges.map((e) => e.confidence));
      const uncertainty = 1 - confidence;
      const kinds = edges.map((e) => e.kind);
      const kind: ClaimKind = kinds.includes("INFERRED")
        ? "INFERRED"
        : kinds.includes("MODELED")
          ? "MODELED"
          : "OBSERVED";
      const evidenceIds = [...new Set(edges.flatMap((e) => e.evidenceIds))];
      const assumptions = [...new Set(edges.flatMap((e) => e.assumptions))];
      const controlDependencies = [...new Set(edges.flatMap((e) => e.controlDependencies))];
      const destCritical = asset.criticality === "CRITICAL";
      let recommendation: RecommendationClass = "MONITOR";
      if (destCritical && confidence >= 0.7) recommendation = "REMEDIATE";
      else if (destCritical || (asset.criticality === "HIGH" && confidence < 0.65)) recommendation = "VERIFY";
      else if (confidence >= 0.75 && asset.criticality === "HIGH") recommendation = "REMEDIATE";

      const labels = nodes.map((n) => n.label);
      const displayId = `P-${String(seq).padStart(3, "0")}`;
      paths.push({
        id: stableId("pth", assessmentId, w.nodeIds.join(">")),
        assessmentId,
        displayId,
        entryPoint: INTERNET_NODE_ID,
        destination: dest.id,
        destinationAssetId: asset.id,
        nodeIds: w.nodeIds,
        edgeIds: w.edgeIds,
        labels,
        confidence: Math.round(confidence * 100) / 100,
        risk: 0,
        impact: destCritical ? 90 : asset.criticality === "HIGH" ? 70 : 40,
        uncertainty: Math.round(uncertainty * 100) / 100,
        assumptions,
        evidenceIds,
        controlDependencies,
        kind,
        recommendationClass: recommendation,
        crownJewel: destCritical,
        summary: `Modeled potential path ${labels.join(" → ")}`,
      });
      seq += 1;
      if (paths.length >= MAX_PATHS) break;
    }
    if (paths.length >= MAX_PATHS) break;
  }

  const unique = new Map<string, AttackPath>();
  for (const p of paths) {
    const key = p.nodeIds.join(">");
    if (!unique.has(key)) unique.set(key, p);
  }
  return [...unique.values()].sort((a, b) => b.impact * b.confidence - a.impact * a.confidence);
}

export function applyPathEvidenceLinks(
  paths: AttackPath[],
  evidence: { id: string; pathIds: string[] }[],
): void {
  for (const p of paths) {
    for (const e of evidence) {
      if (p.evidenceIds.includes(e.id) && !e.pathIds.includes(p.id)) e.pathIds.push(p.id);
    }
  }
}
