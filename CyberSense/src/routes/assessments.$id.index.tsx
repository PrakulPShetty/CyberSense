import type { ReactNode } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Score, Severity } from "@/components/sentinel/severity";
import { useAssessment } from "@/lib/sentinel/use-assessment";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/assessments/$id/")({ component: Executive });

function Executive() {
  const { id } = useParams({ from: "/assessments/$id/" });
  const { data: snap } = useAssessment(id);
  if (!snap) return null;
  const top = [...snap.paths].sort((a, b) => b.risk - a.risk).slice(0, 3);
  const rec = top.find((p) => p.controlDependencies.includes("MFA")) ?? top[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Executive posture</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Modeled exposure, not a breach report</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Posture" value={<Score value={snap.risk.overallScore} className="text-3xl" />} hint={snap.risk.band} />
        <Kpi
          label="Confidence"
          value={<span className="font-mono text-3xl tabular">{Math.round(snap.risk.confidence * 100)}%</span>}
          hint="Not the same as risk"
        />
        <Kpi
          label="Critical paths"
          value={<span className="font-mono text-3xl tabular">{snap.risk.criticalPathCount}</span>}
          hint="Modeled to crown jewels"
        />
        <Kpi
          label="Momentum"
          value={<span className="font-mono text-3xl tabular">{snap.momentum?.score ?? 0}</span>}
          hint={snap.momentum?.direction ?? "STABLE"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Highest-scoring modeled paths</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {top.map((p) => (
              <Link
                key={p.id}
                to="/assessments/$id/paths"
                params={{ id }}
                className="rounded-lg bg-muted/50 p-3 hover:bg-muted"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-xs">{p.displayId}</div>
                  <div className="flex gap-2">
                    <Severity value={p.kind} />
                    <Severity value={p.recommendationClass} />
                    <Score value={p.risk} />
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.labels.join(" → ")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Confidence {Math.round(p.confidence * 100)}% · uncertainty {Math.round(p.uncertainty * 100)}%
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Top modeled defense</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{rec ? rec.controlDependencies[0] ?? "MFA" : "Insufficient evidence"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Simulation never changes the real target. Residual risk is recalculated after every control.
              </p>
              <Button asChild className="mt-4 w-full" size="sm">
                <Link to="/assessments/$id/simulate" params={{ id }}>
                  Run MFA simulation
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Shadow inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl tabular">{snap.shadowAssets.length}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                POTENTIAL SHADOW ASSET — REQUIRES VERIFICATION. Not declared unauthorized.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      {snap.drift && (
        <Card>
          <CardHeader>
            <CardTitle>What changed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{snap.drift.causalExplanation}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2">{value}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
