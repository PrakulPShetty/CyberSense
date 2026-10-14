import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { GraphView } from "@/components/sentinel/graph-view";
import { Severity } from "@/components/sentinel/severity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/graph")({ component: GraphPage });

function GraphPage() {
  const { id } = useParams({ from: "/assessments/$id/graph" });
  const { data: snap } = useAssessment(id);
  const [pathId, setPathId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  if (!snap) return null;
  const path = snap.paths.find((p) => p.id === pathId);
  const node = snap.graph.nodes.find((n) => n.id === nodeId);
  const edges = node
    ? snap.graph.edges.filter((e) => e.source === node.id || e.target === node.id)
    : [];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Attack graph</h1>
        <p className="text-sm text-muted-foreground">
          Solid = observed, dashed = modeled, dotted = inferred. Highlight a path to isolate it.
        </p>
      </div>
      <GraphView
        graph={snap.graph}
        paths={snap.paths}
        selectedPathId={pathId}
        onSelectPath={setPathId}
        onSelectNode={setNodeId}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{path ? path.displayId : "Select a path"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {path ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Severity value={path.kind} />
                  <Severity value={path.recommendationClass} />
                </div>
                <p>{path.labels.join(" → ")}</p>
                <p>
                  Risk {path.risk} · confidence {Math.round(path.confidence * 100)}% · uncertainty{" "}
                  {Math.round(path.uncertainty * 100)}%
                </p>
                {path.assumptions[0] && <p>{path.assumptions[0]}</p>}
              </div>
            ) : (
              "Click a path chip above."
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{node ? node.label : "Select a node"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {edges.map((e) => (
              <div key={e.id} className="rounded-md bg-muted/40 p-2">
                <div className="flex gap-2">
                  <span className="font-mono text-[11px]">{e.type}</span>
                  <Severity value={e.kind} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Confidence {Math.round(e.confidence * 100)}% · difficulty {e.difficulty}
                  {e.blocked ? " · blocked in simulation" : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
