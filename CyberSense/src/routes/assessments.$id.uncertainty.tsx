import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Severity } from "@/components/sentinel/severity";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/uncertainty")({ component: UncertaintyPage });

function UncertaintyPage() {
  const { id } = useParams({ from: "/assessments/$id/uncertainty" });
  const { data: snap } = useAssessment(id);
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Uncertainty and next-best evidence</h1>
        <p className="text-sm text-muted-foreground">
          High risk with low confidence means verify, not blindly remediate. Recommendations collect evidence — they do not invent it.
        </p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall uncertainty</div>
          <div className="font-mono text-4xl tabular">{Math.round(snap.uncertainty.overall * 100)}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Evidence gaps</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {snap.evidenceGaps.map((g) => (
            <div key={g.id} className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px]">{g.id}</span>
                <Severity value={g.priority} />
              </div>
              <p className="mt-1">{g.recommendedVerification}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Current confidence {Math.round(g.currentConfidence * 100)}% · potential +
                {Math.round(g.potentialImprovement * 100)}% · sources {g.candidateSources.join(", ")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Verification tasks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {snap.verificationTasks.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span>{t.title}</span>
              <Severity value={t.recommendationClass} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
