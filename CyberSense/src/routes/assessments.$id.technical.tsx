import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Score, Severity } from "@/components/sentinel/severity";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/technical")({ component: Technical });

function Technical() {
  const { id } = useParams({ from: "/assessments/$id/technical" });
  const { data: snap } = useAssessment(id);
  if (!snap) return null;
  const tiles = [
    { to: "/assessments/$id/assets" as const, label: "Assets", value: snap.assets.length },
    { to: "/assessments/$id/evidence" as const, label: "Evidence", value: snap.evidence.length },
    { to: "/assessments/$id/graph" as const, label: "Graph edges", value: snap.graph.edges.length },
    { to: "/assessments/$id/paths" as const, label: "Paths", value: snap.paths.length },
    { to: "/assessments/$id/uncertainty" as const, label: "Evidence gaps", value: snap.evidenceGaps.length },
    { to: "/assessments/$id/audit" as const, label: "Sources", value: snap.sourceRuns.length },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Technical investigation</h1>
        <p className="text-sm text-muted-foreground">Every metric drills into the same twin state.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} params={{ id }}>
            <Card className="hover:bg-muted/30">
              <CardContent className="pt-5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</div>
                <div className="mt-2 font-mono text-3xl tabular">{t.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Source runs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {snap.sourceRuns.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="font-mono text-xs">{s.sourceName}</span>
              <Severity value={s.status} />
              <span className="text-muted-foreground">{s.observationCount} observations</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Risk factor rollup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {snap.risk.factors.map((f) => (
            <div key={f.id}>
              <div className="flex justify-between text-xs">
                <span>{f.name}</span>
                <span className="font-mono tabular">
                  {f.points}/{f.max}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${(f.points / f.max) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Overall <Score value={snap.risk.overallScore} /> with confidence {Math.round(snap.risk.confidence * 100)}%.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
