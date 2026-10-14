import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateReportFn, listReportsFn } from "@/lib/sentinel/api";
import { Severity } from "@/components/sentinel/severity";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/reports")({ component: ReportsPage });

function ReportsPage() {
  const { id } = useParams({ from: "/assessments/$id/reports" });
  const { data: snap } = useAssessment(id);
  const qc = useQueryClient();
  const { data: reports } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => listReportsFn({ data: { assessmentId: id } }),
  });
  const gen = useMutation({
    mutationFn: () => generateReportFn({ data: { assessmentId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", id] }),
  });
  const current = gen.data?.content ?? reports?.[0]?.content;
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Traceable to evidence, paths, and simulations. Print from the browser if needed.</p>
        </div>
        <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
          {gen.isPending ? "Generating…" : "Generate report"}
        </Button>
      </div>
      {current && (
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle>{current.title}</CardTitle>
            <div className="flex gap-2">
              <Severity value={current.mode} />
              <Severity value={current.posture.band} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
            <p>{current.executiveSummary}</p>
            {current.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-sm font-medium">{s.heading}</h2>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{s.body}</p>
                {s.references.length > 0 && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">refs {s.references.join(", ")}</p>
                )}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">{current.languageDisclaimer}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
