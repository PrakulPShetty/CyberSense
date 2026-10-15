import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, FileText, Info, LoaderCircle, MessageSquareText, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, StatTile } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { TableWrap, Td, Th } from "@/components/ui/table";
import {
  explainSecurityCheckFn,
  generateSecurityReportFn,
  getSecurityCheckFn,
  securityRecommendationsFn,
} from "@/lib/security/api";

export const Route = createFileRoute("/security/$id")({
  loader: async ({ params }) => ({ run: await getSecurityCheckFn({ data: { id: params.id } }) }),
  component: SecurityDetailPage,
});

function SecurityDetailPage() {
  const { id } = Route.useParams();
  const { run } = Route.useLoaderData();

  const explain = useMutation({
    mutationFn: (checkId: string) => explainSecurityCheckFn({ data: { id, checkId } }),
  });
  const recommendations = useMutation({
    mutationFn: () => securityRecommendationsFn({ data: { id } }),
  });

  const report = useMutation({
    mutationFn: () => generateSecurityReportFn({ data: { id } }),
    onSuccess: (result) => {
      if (!result) return;
      const bin = atob(result.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  if (!run) {
    return (
      <AppShell>
        <Link
          to="/security"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-sky-300"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All security checks
        </Link>
        <PageHeader className="mt-5" eyebrow="Security checks" title="Saved check not found" description="No saved security check is stored under that identifier." />
        <Panel className="mt-8">
          <EmptyState
            title="Nothing to show for this identifier"
            body="Saved checks live in the embedded database for the current server session. Run the check again to recreate it."
            action={
              <Button asChild variant="primary" size="sm">
                <Link to="/security">Run security checks</Link>
              </Button>
            }
          />
        </Panel>
      </AppShell>
    );
  }

  const counts = {
    pass: run.results.filter((r) => r.status === "pass").length,
    fail: run.results.filter((r) => r.status === "fail").length,
    notVerified: run.results.filter((r) => r.status === "not-verified").length,
  };

  return (
    <AppShell>
      <Link
        to="/security"
        className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-sky-300"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All security checks
      </Link>

      <PageHeader
        className="mt-5"
        eyebrow="Saved security check"
        title={run.targetUrl}
        description={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-xs text-muted-foreground">
            <span>ID {run.id ?? id}</span>
            <span>·</span>
            <span>observed {run.completedAt}</span>
          </span>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => report.mutate()} disabled={report.isPending}>
            {report.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="size-3.5" aria-hidden="true" />
            )}
            {report.isPending ? "Generating PDF…" : "Download security PDF"}
          </Button>
        }
      />

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Checks run" value={run.results.length} />
        <StatTile label="Passed" value={counts.pass} tone="low" />
        <StatTile label="Failed" value={counts.fail} tone={counts.fail > 0 ? "critical" : "default"} />
        <StatTile label="Not verified" value={counts.notVerified} tone="high" />
      </div>

      <Panel className="mt-6">
        <PanelHeader>
          <div>
            <PanelTitle icon={<ShieldCheck className="size-4 text-sky-300" aria-hidden="true" />}>Observed results</PanelTitle>
            <p className="mt-1 text-xs text-muted-foreground">Select a check to see the explanation grounded in its observed value.</p>
          </div>
        </PanelHeader>
        <PanelBody>
          <TableWrap>
            <thead>
              <tr>
                <Th>Check</Th>
                <Th>Expected</Th>
                <Th>Observed</Th>
                <Th>Status</Th>
                <Th className="text-right">Explain</Th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((result) => (
                <tr key={result.id}>
                  <Td className="max-w-[12rem]">
                    <span className="text-slate-200">{result.description}</span>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">{result.id}</div>
                    {result.limitation ? (
                      <div className="mt-1 text-[10px] leading-snug text-muted-foreground">{result.limitation}</div>
                    ) : null}
                  </Td>
                  <Td className="max-w-[14rem] text-xs text-muted-foreground">{result.expected}</Td>
                  <Td className="max-w-[18rem] break-words font-mono text-[11px] text-sky-200">{result.observed}</Td>
                  <Td><Severity value={result.status} /></Td>
                  <Td className="text-right">
                    <Button variant="ghostNeon" size="sm" onClick={() => explain.mutate(result.id)}>
                      Explain
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </PanelBody>
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle icon={<MessageSquareText className="size-4 text-violet-300" aria-hidden="true" />}>
              Explanation
            </PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Explanations are built from the observed value stored with the selected check. If no check is selected, the
              first recorded check is explained.
            </p>
            <Button variant="ghostNeon" size="sm" className="mt-3" onClick={() => explain.mutate(run.results[0]?.id ?? "")} disabled={explain.isPending || run.results.length === 0}>
              {explain.isPending ? "Explaining…" : "Explain the first check"}
            </Button>

            {explain.data ? (
              <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-sky-400/10 bg-navy-950/60 p-4 text-sm leading-relaxed">
                <p className="font-mono text-xs text-sky-300">{explain.data.checkId}</p>
                <p><span className="font-medium text-sky-200">What is the problem? </span>{explain.data.what}</p>
                <p><span className="font-medium text-sky-200">Why does it matter? </span>{explain.data.why}</p>
                <p><span className="font-medium text-sky-200">Who is affected? </span>{explain.data.who}</p>
                <div>
                  <span className="font-medium text-sky-200">What should be done?</span>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-300">
                    {explain.data.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
                <p><span className="font-medium text-sky-200">Example: </span><code className="break-all font-mono text-xs">{explain.data.example}</code></p>
                <p><span className="font-medium text-sky-200">Where to apply: </span>{explain.data.where}</p>
                <p><span className="font-medium text-sky-200">How to verify: </span>{explain.data.verify}</p>
                <p className="break-all text-[11px] text-muted-foreground">Evidence: {explain.data.evidence}</p>
              </div>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle icon={<Info className="size-4 text-cyan-300" aria-hidden="true" />}>
              Remediation guidance
            </PanelTitle>
          </PanelHeader>
          <PanelBody>
            <Button variant="ghostNeon" size="sm" onClick={() => recommendations.mutate()} disabled={recommendations.isPending}>
              {recommendations.isPending ? "Generating guidance…" : "Show recommended actions"}
            </Button>

            {recommendations.data ? (
              recommendations.data.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3">
                  {recommendations.data.map((rec) => (
                    <div key={rec.checkId} className="panel-flat rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-sky-300">{rec.checkId}</span>
                        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                          Priority {rec.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-200">{rec.action}</p>
                      <p className="mt-2 break-all font-mono text-[11px] text-slate-400">{rec.example}</p>
                      <p className="mt-2 text-xs text-sky-200">Verify: {rec.verification}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{rec.caveat}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No failed or unverified check requires remediation in this run.
                </p>
              )
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Guidance is advisory only. Do not change production configuration without an authorized review.
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel className="mt-6 border-sky-400/15 bg-sky-500/5">
        <PanelBody className="pt-5">
          <h2 className="text-sm font-semibold text-sky-100">Limitations of these checks</h2>
          <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
            {run.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3">
            <Link to="/security" className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:underline">
              Run another check
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          </p>
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
