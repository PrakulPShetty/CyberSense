import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAuditFn } from "@/lib/sentinel/api";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/audit")({ component: AuditPage });

function AuditPage() {
  const { id } = useParams({ from: "/assessments/$id/audit" });
  const { data: snap } = useAssessment(id);
  const { data } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => listAuditFn({ data: { assessmentId: id } }),
  });
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">Assessment, simulation, report, and analyst events.</p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
        {(data ?? []).map((row) => (
          <div key={row.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{row.action}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{String(row.createdAt)}</span>
            </div>
            <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground">{JSON.stringify(row.details, null, 0)}</pre>
          </div>
        ))}
        {(data ?? []).length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No events recorded yet for this assessment.</p>}
      </div>
    </div>
  );
}
