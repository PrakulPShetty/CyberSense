import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { GraphView } from "@/components/sentinel/graph-view";
import { Score, Severity } from "@/components/sentinel/severity";
import { Card, CardContent } from "@/components/ui/card";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/paths")({ component: PathsPage });

function PathsPage() {
  const { id } = useParams({ from: "/assessments/$id/paths" });
  const { data: snap } = useAssessment(id);
  const [sel, setSel] = useState<string | null>(null);
  if (!snap) return null;
  const path = snap.paths.find((p) => p.id === sel) ?? snap.paths[0];
  const breakdown = snap.risk.pathBreakdowns.find((b) => b.pathId === path?.id);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Attack path explorer</h1>
        <p className="text-sm text-muted-foreground">Modeled potential routes given available evidence. Not confirmed attacker capability.</p>
      </div>
      {path && <GraphView graph={snap.graph} paths={snap.paths} selectedPathId={path.id} onSelectPath={setSel} />}
      <div className="grid gap-3">
        {snap.paths.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p.id)}
            className="rounded-xl bg-card p-4 text-left shadow-[0_0_0_1px_rgba(236,236,239,0.08)] hover:bg-muted/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{p.displayId}</span>
              <div className="flex items-center gap-2">
                <Severity value={p.kind} />
                <Severity value={p.recommendationClass} />
                <Score value={p.risk} />
              </div>
            </div>
            <p className="mt-2 text-sm">{p.labels.join(" → ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Confidence {Math.round(p.confidence * 100)}% · uncertainty {Math.round(p.uncertainty * 100)}% ·{" "}
              {p.crownJewel ? "crown jewel" : "non-jewel"}
            </p>
          </button>
        ))}
      </div>
      {path && breakdown && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-medium">
              {path.displayId} factor decomposition — score {breakdown.score}
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {breakdown.factors.map((f) => (
                <div key={f.id} className="flex justify-between text-sm">
                  <span>
                    {f.name}
                    <span className="ml-2 text-xs text-muted-foreground">{f.rationale}</span>
                  </span>
                  <span className="font-mono tabular">+{f.points}</span>
                </div>
              ))}
            </div>
            {path.assumptions.length > 0 && (
              <div className="mt-4 text-xs text-muted-foreground">
                Assumptions: {path.assumptions.join(" ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
