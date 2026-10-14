import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Severity } from "@/components/sentinel/severity";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/twin")({ component: TwinPage });

function TwinPage() {
  const { id } = useParams({ from: "/assessments/$id/twin" });
  const { data: snap } = useAssessment(id);
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Exposure twin</h1>
        <p className="text-sm text-muted-foreground">
          Immutable snapshot of what was known at {new Date(snap.timestamp).toUTCString()}. Historical twins are never mutated.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Assets", snap.assets.length],
          ["Evidence", snap.evidence.length],
          ["Relationships", snap.relationships.length],
          ["Paths", snap.paths.length],
        ].map(([k, v]) => (
          <Card key={String(k)}>
            <CardContent className="pt-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="mt-1 font-mono text-2xl tabular">{v as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {snap.stageLog.map((s) => (
            <div key={s.stage} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span>{s.stage.replaceAll("_", " ")}</span>
              <Severity value={s.status} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Authorization boundary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {snap.authorization ? (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              <li>Target {snap.authorization.target}</li>
              <li>By {snap.authorization.authorizedBy}</li>
              <li>Type {snap.authorization.authorizationType}</li>
              <li>Passive only: {String(snap.authorization.scope.passiveOnly)}</li>
              {snap.authorization.restrictions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p>No authorization record.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
