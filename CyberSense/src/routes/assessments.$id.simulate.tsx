import { createFileRoute, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GraphView } from "@/components/sentinel/graph-view";
import { Score, Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runSimulationFn } from "@/lib/sentinel/api";
import { CONTROL_CATALOG } from "@/lib/sentinel/defense";
import type { ControlId } from "@/lib/sentinel/types";
import { useAssessment, useSimulations } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/simulate")({ component: SimulatePage });

function SimulatePage() {
  const { id } = useParams({ from: "/assessments/$id/simulate" });
  const { data: snap } = useAssessment(id);
  const { data: sims } = useSimulations(id);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ControlId[]>(["MFA"]);
  const run = useMutation({
    mutationFn: () => runSimulationFn({ data: { assessmentId: id, controlIds: selected } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["simulations", id] }),
  });
  const latest = run.data ?? sims?.[0];
  const toggle = (c: ControlId) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const beforeGraph = snap?.graph;
  const afterGraph = latest?.afterGraph;
  const view = useMemo(() => afterGraph ?? beforeGraph, [afterGraph, beforeGraph]);
  if (!snap || !view) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Counterfactual simulator</h1>
        <p className="text-sm text-muted-foreground">
          Controls clone the logical graph. The real environment is never modified. Residual risk is always recomputed.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CONTROL_CATALOG.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`h-10 rounded-full px-3 text-xs ${selected.includes(c.id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <Button onClick={() => run.mutate()} disabled={run.isPending || selected.length === 0} className="w-fit">
        {run.isPending ? "Simulating…" : "Apply to cloned graph"}
      </Button>
      {latest && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Risk before" value={<Score value={latest.beforeRisk} className="text-2xl" />} />
          <Stat label="Risk after" value={<Score value={latest.afterRisk} className="text-2xl" />} />
          <Stat label="Critical paths" value={`${latest.survivability.criticalBefore} → ${latest.survivability.criticalAfter}`} />
          <Stat label="Crown jewels reachable" value={`${latest.survivability.crownJewelReachabilityBefore} → ${latest.survivability.crownJewelReachabilityAfter}`} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium">Before</h2>
          <GraphView graph={snap.graph} paths={snap.paths} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium">After {latest ? `(${latest.controlIds.join(" + ")})` : ""}</h2>
          {latest ? (
            <GraphView graph={latest.afterGraph} paths={latest.afterPaths} />
          ) : (
            <p className="text-sm text-muted-foreground">Run a simulation to compare.</p>
          )}
        </div>
      </div>
      {latest && (
        <Card>
          <CardHeader>
            <CardTitle>Survivability</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Removed {latest.survivability.removedPathIds.length} modeled paths. Surviving{" "}
              {latest.survivability.survivingPathIds.length}. Residual {latest.afterRisk}{" "}
              <Severity value={latest.afterBand} />.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Estimated control cost is not financial truth. One control never implies zero risk.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-lg tabular">{value}</div>
      </CardContent>
    </Card>
  );
}
