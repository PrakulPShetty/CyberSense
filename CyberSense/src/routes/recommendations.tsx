import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ExternalLink, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { a11yRecommendationsFn, listA11yScansFn } from "@/lib/a11y/api";
import type { A11yRecommendation } from "@/lib/a11y/recommendations";

export const Route = createFileRoute("/recommendations")({
  loader: async () => {
    const scans = await listA11yScansFn();
    const latest = scans[0];
    const recommendations = latest ? await a11yRecommendationsFn({ data: { scanId: latest.id } }) : null;
    return { scans, latest, recommendations };
  },
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const { scans, latest, recommendations } = Route.useLoaderData();
  const [scanId, setScanId] = useState(latest?.id ?? "");

  const load = useMutation({
    mutationFn: (id: string) => a11yRecommendationsFn({ data: { scanId: id } }),
  });

  // The loader only resolves the newest scan; selecting an older one refetches
  // the same advisory builder for that stored scan.
  useEffect(() => {
    setScanId(latest?.id ?? "");
    load.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  const selectedScan = scans.find((s) => s.id === scanId) ?? latest;
  const usingLoaderRecommendations = !load.data && scanId === (latest?.id ?? "");
  const list: A11yRecommendation[] | null = usingLoaderRecommendations
    ? (recommendations ?? null)
    : (load.data ?? null);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Remediation"
        title="Fix Recommendations"
        description="Advisory guidance derived from the findings stored in a saved scan. CyberSense never modifies your site, repository or accounts."
        actions={
          <Button asChild variant="ghostNeon">
            <Link to="/results">Back to results</Link>
          </Button>
        }
      />

      {scans.length > 0 ? (
        <Panel className="mt-7">
          <PanelBody className="flex flex-wrap items-end justify-between gap-4 pt-5">
            <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
              Scan to generate guidance from
              <select
                value={scanId}
                onChange={(e) => {
                  setScanId(e.target.value);
                  if (e.target.value && e.target.value !== latest?.id) load.mutate(e.target.value);
                }}
                className="rounded-xl border border-border bg-navy-950/70 px-3 py-2.5 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {scan.hostname || scan.url} — {scan.summary.ruleCount} failing rules
                  </option>
                ))}
              </select>
            </label>
            {selectedScan ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{selectedScan.id}</span>
                <Severity value={selectedScan.status} />
                <Button asChild variant="ghostNeon" size="sm">
                  <Link to="/accessibility/$scanId" params={{ scanId: selectedScan.id }}>
                    Open findings
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

      {load.isPending ? (
        <Panel className="mt-5">
          <PanelBody className="flex items-center gap-3 py-6">
            <LoaderCircle className="size-5 animate-spin text-sky-300" aria-hidden="true" />
            <p className="text-sm text-slate-200">Building recommendations from the stored findings…</p>
          </PanelBody>
        </Panel>
      ) : null}

      {load.isError ? (
        <Panel className="mt-5 border-rose-400/30 bg-rose-500/10">
          <PanelBody className="pt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-200">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Recommendations could not be generated
            </p>
            <p className="mt-1.5 text-sm text-rose-100/90">
              The selected scan could not be read. Reload the page or choose another stored scan.
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      {list && list.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {list.map((rec: A11yRecommendation) => (
            <Panel key={rec.findingId} interactive>
              <PanelHeader>
                <div className="min-w-0">
                  <PanelTitle icon={<SlidersHorizontal className="size-4 text-violet-300" aria-hidden="true" />}>
                    <span className="font-mono text-sm text-sky-300">{rec.findingId}</span>
                  </PanelTitle>
                  <p className="mt-1.5 text-sm text-slate-100">{rec.problem}</p>
                </div>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                  Priority {rec.priority}
                </span>
              </PanelHeader>
              <PanelBody>
                <p className="text-xs leading-relaxed text-muted-foreground">{rec.why}</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-300">
                  {rec.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-400/10 bg-navy-950/60 p-3">
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-sky-300" aria-hidden="true" />
                  <p className="break-all font-mono text-[11px] text-slate-300">{rec.example}</p>
                </div>
                <p className="mt-3 text-xs text-sky-200">Verify: {rec.verify}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{rec.caveat}</p>
              </PanelBody>
            </Panel>
          ))}
        </div>
      ) : null}

      {list && list.length === 0 ? (
        <Panel className="mt-6">
          <EmptyState
            title="No remediation needed from this scan"
            body="Every rule that ran on this page passed, so there is no failing finding to advise on. That is not a claim of WCAG compliance — see the scan's limitations."
            action={
              selectedScan ? (
                <Button asChild variant="ghostNeon" size="sm">
                  <Link to="/accessibility/$scanId" params={{ scanId: selectedScan.id }}>
                    Open the scan
                  </Link>
                </Button>
              ) : null
            }
          />
        </Panel>
      ) : null}

      {!list && !load.isPending && !load.isError ? (
        <Panel className="mt-6">
          <EmptyState
            title="No stored scan to advise on"
            body="Recommendations are generated from saved findings. Run a scan first and the advisory guidance will be derived from it."
            action={
              <Button asChild variant="primary" size="sm">
                <Link to="/accessibility">Run a scan</Link>
              </Button>
            }
          />
        </Panel>
      ) : null}
    </AppShell>
  );
}
