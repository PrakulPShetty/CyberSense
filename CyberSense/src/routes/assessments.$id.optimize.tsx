import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Score, Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { optimizeFn } from "@/lib/sentinel/api";
import { CONTROL_CATALOG } from "@/lib/sentinel/defense";
import type { ControlId } from "@/lib/sentinel/types";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/optimize")({ component: OptimizePage });

function OptimizePage() {
  const { id } = useParams({ from: "/assessments/$id/optimize" });
  const { data: snap } = useAssessment(id);
  const [budget, setBudget] = useState("40");
  const [maxControls, setMaxControls] = useState("3");
  const [excluded, setExcluded] = useState<ControlId[]>([]);
  const run = useMutation({
    mutationFn: () =>
      optimizeFn({
        data: {
          assessmentId: id,
          constraints: {
            budget: Number(budget) || null,
            maxControls: Number(maxControls) || 3,
            required: [],
            excluded,
            minimumRiskReduction: null,
          },
        },
      }),
  });
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Minimum defense cut</h1>
        <p className="text-sm text-muted-foreground">
          Bounded combinatorial search over the control catalog. Defense Efficiency = modeled risk reduction / estimated cost — a SENTINEL-X metric, not finance.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Budget (estimated units)</Label>
          <Input className="mt-1" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div>
          <Label>Max controls</Label>
          <Input className="mt-1" value={maxControls} onChange={(e) => setMaxControls(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Searching…" : "Find strategies"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {CONTROL_CATALOG.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setExcluded((xs) => (xs.includes(c.id) ? xs.filter((x) => x !== c.id) : [...xs, c.id]))}
            className={`h-9 rounded-full px-3 text-[11px] ${excluded.includes(c.id) ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}
          >
            {excluded.includes(c.id) ? `Exclude ${c.id}` : c.id}
          </button>
        ))}
      </div>
      {run.data && (
        <div className="grid gap-3">
          {run.data.strategies.map((s, i) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>
                  Strategy {i + 1}: {s.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <div>Estimated cost {s.totalCost}</div>
                <div>
                  Residual risk <Score value={s.residualRisk} />
                </div>
                <div>Critical paths removed {s.criticalPathsRemoved}</div>
                <div>Efficiency {s.defenseEfficiency}</div>
                <p className="sm:col-span-2 text-xs text-muted-foreground">{s.whySelected || s.whyRejected}</p>
                {i === 0 && <Severity value="REMEDIATE" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
