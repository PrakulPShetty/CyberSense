import { useMemo, useState } from "react";
import { INTERNET_NODE_ID } from "@/lib/sentinel/scoring";
import type { AttackGraph, AttackPath } from "@/lib/sentinel/types";
import { cn } from "@/lib/utils";
import { Severity } from "./severity";

interface Pt {
  id: string;
  x: number;
  y: number;
}

function layout(graph: AttackGraph): Map<string, Pt> {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const dist = new Map<string, number>();
  const q = [INTERNET_NODE_ID];
  dist.set(INTERNET_NODE_ID, 0);
  while (q.length) {
    const n = q.shift()!;
    for (const t of adj.get(n) ?? []) {
      if (!dist.has(t)) {
        dist.set(t, (dist.get(n) ?? 0) + 1);
        q.push(t);
      }
    }
  }
  for (const n of graph.nodes) if (!dist.has(n.id)) dist.set(n.id, 6);
  const cols = new Map<number, string[]>();
  for (const [id, d] of dist) {
    const list = cols.get(d) ?? [];
    list.push(id);
    cols.set(d, list);
  }
  const maxCol = Math.max(...cols.keys(), 1);
  const width = 1100;
  const height = 560;
  const pos = new Map<string, Pt>();
  for (const [d, ids] of cols) {
    const x = 70 + (d / maxCol) * (width - 140);
    ids.forEach((id, i) => {
      const y = 48 + ((i + 1) / (ids.length + 1)) * (height - 80);
      pos.set(id, { id, x, y });
    });
  }
  return pos;
}

export function GraphView({
  graph,
  paths,
  selectedPathId,
  onSelectPath,
  onSelectNode,
}: {
  graph: AttackGraph;
  paths: AttackPath[];
  selectedPathId?: string | null;
  onSelectPath?: (id: string | null) => void;
  onSelectNode?: (id: string | null) => void;
}) {
  const pos = useMemo(() => layout(graph), [graph]);
  const [hover, setHover] = useState<string | null>(null);
  const selected = paths.find((p) => p.id === selectedPathId);
  const pathNode = new Set(selected?.nodeIds ?? []);
  const pathEdge = new Set(selected?.edgeIds ?? []);
  const node = graph.nodes.find((n) => n.id === hover);

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface scan-grid shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
      <svg viewBox="0 0 1100 560" className="h-auto w-full min-h-[320px]" role="img" aria-label="Attack graph">
        {graph.edges.map((e) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          const on = pathEdge.has(e.id);
          const dim = selected && !on;
          const mx = (a.x + b.x) / 2;
          return (
            <path
              key={e.id}
              d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke={e.blocked ? "#d46a5c" : on ? "#d8dbe3" : "#3a3a40"}
              strokeWidth={on ? 2.2 : 1}
              strokeDasharray={e.kind === "INFERRED" ? "5 4" : e.kind === "MODELED" ? "2 3" : undefined}
              opacity={dim ? 0.18 : e.blocked ? 0.45 : 0.9}
            />
          );
        })}
        {graph.nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const on = pathNode.has(n.id) || n.id === INTERNET_NODE_ID;
          const dim = selected && !on;
          const crit =
            n.criticality === "CRITICAL" ? "#d46a5c" : n.criticality === "HIGH" ? "#c9a36a" : n.type === "INTERNET" ? "#d8dbe3" : "#8b8b93";
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectNode?.(n.id)}
              opacity={dim ? 0.25 : 1}
            >
              <circle r={n.type === "INTERNET" ? 16 : 11} fill="#121214" stroke={crit} strokeWidth={1.6} />
              {n.exposureState === "PUBLIC" && n.type !== "INTERNET" && (
                <circle r={15} fill="none" stroke={crit} strokeOpacity={0.35} />
              )}
              <text
                y={26}
                textAnchor="middle"
                fill="#ececef"
                fontSize={9}
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3">
        {paths.slice(0, 8).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPath?.(selectedPathId === p.id ? null : p.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider",
              selectedPathId === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {p.displayId}
          </button>
        ))}
      </div>
      {node && (
        <div className="absolute bottom-3 left-3 max-w-sm rounded-lg bg-popover p-3 text-xs shadow-[0_0_0_1px_rgba(236,236,239,0.12)]">
          <div className="flex items-center gap-2">
            <span className="font-medium">{node.label}</span>
            <Severity value={node.type} />
            {node.criticality && <Severity value={node.criticality} />}
          </div>
          <p className="mt-1 text-muted-foreground">
            Exposure {node.exposureState} · confidence {Math.round(node.confidence * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
