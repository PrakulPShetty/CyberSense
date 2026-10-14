import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Score, Severity } from "@/components/sentinel/severity";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/risk")({ component: RiskPage });

function RiskPage() {
  const { id } = useParams({ from: "/assessments/$id/risk" });
  const { data: snap } = useAssessment(id);
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Risk analysis</h1>
        <p className="text-sm text-muted-foreground">
          {snap.risk.insufficientEvidence
            ? "No modeled path was found, so no posture score is reported. Absence of observed exposure is not evidence of low risk."
            : `Risk ${snap.risk.overallScore} is not confidence ${Math.round(snap.risk.confidence * 100)}%. Scores decompose into named factors.`}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
            {snap.risk.insufficientEvidence ? (
              <>
                <div className="mt-1 text-2xl text-unknown">No score</div>
                <Severity value="UNKNOWN" className="mt-2" />
              </>
            ) : (
              <>
                <Score value={snap.risk.overallScore} className="text-4xl" />
                <Severity value={snap.risk.band} className="mt-2" />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
            <div className="font-mono text-4xl tabular">{Math.round(snap.risk.confidence * 100)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Uncertainty</div>
            <div className="font-mono text-4xl tabular">{Math.round(snap.risk.uncertainty * 100)}%</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {snap.risk.factors.map((f) => (
            <div key={f.id}>
              <div className="flex justify-between text-sm">
                <span>{f.name}</span>
                <span className="font-mono tabular">
                  +{f.points} / {f.max}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{f.rationale}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Per-path scores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {snap.paths.map((p) => (
            <Link key={p.id} to="/assessments/$id/paths" params={{ id }} className="flex justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="font-mono">{p.displayId}</span>
              <span>
                <Score value={p.risk} /> · {Math.round(p.confidence * 100)}%
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
