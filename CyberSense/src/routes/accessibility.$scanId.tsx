import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  FileText,
  Filter,
  LoaderCircle,
  MessageSquareText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, StatTile } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { a11yRecommendationsFn, explainA11yFindingFn, generateA11yReportFn, getA11yScanFn } from "@/lib/a11y/api";
import type { A11yImpact, A11yRuleResult } from "@/lib/a11y/types";

export const Route = createFileRoute("/accessibility/$scanId")({
  loader: async ({ params }) => {
    const scan = await getA11yScanFn({ data: { id: params.scanId } });
    const recommendations = scan ? await a11yRecommendationsFn({ data: { scanId: params.scanId } }) : null;
    return { scan, recommendations };
  },
  component: ScanDetail,
});

const IMPACT_ORDER: (A11yImpact | "unknown")[] = ["critical", "serious", "moderate", "minor", "unknown"];

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function ScanDetail() {
  const { scan, recommendations } = Route.useLoaderData();
  const [selectedFinding, setSelectedFinding] = useState<string | undefined>(scan?.violations[0]?.id);
  const [query, setQuery] = useState("");
  const [impactFilter, setImpactFilter] = useState<string>("all");

  const explain = useMutation({
    mutationFn: () => explainA11yFindingFn({ data: { scanId: scan?.id ?? "", findingId: selectedFinding } }),
  });

  const pdf = useMutation({
    mutationFn: () => generateA11yReportFn({ data: { scanId: scan?.id ?? "" } }),
    onSuccess: (d) => {
      if (!d) return;
      const bin = atob(d.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const violations = useMemo(() => scan?.violations ?? [], [scan]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return violations.filter((rule) => {
      const matchesImpact = impactFilter === "all" || (rule.impact ?? "unknown") === impactFilter;
      if (!matchesImpact) return false;
      if (!needle) return true;
      return (
        rule.id.toLowerCase().includes(needle) ||
        rule.help.toLowerCase().includes(needle) ||
        rule.description.toLowerCase().includes(needle) ||
        rule.nodes.some((node) => node.target.join(" ").toLowerCase().includes(needle))
      );
    });
  }, [violations, query, impactFilter]);

  if (!scan) {
    return (
      <AppShell>
        <PageHeader eyebrow="Scan results" title="Scan not found" description="No accessibility scan is stored under that identifier." />
        <Panel className="mt-8">
          <EmptyState
            title="Nothing to show for this identifier"
            body="The scan may have been created in a previous server session. In the current session the embedded database starts empty, so only scans run since the server started are stored."
            action={
              <Button asChild variant="primary" size="sm">
                <Link to="/accessibility">Run a new scan</Link>
              </Button>
            }
          />
        </Panel>
      </AppShell>
    );
  }

  const grouped = new Map<A11yImpact | "unknown", A11yRuleResult[]>();
  for (const rule of filtered) {
    const key = rule.impact ?? "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), rule]);
  }

  return (
    <AppShell>
      <Link
        to="/results"
        className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-sky-300"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All scan results
      </Link>

      <PageHeader
        className="mt-5"
        eyebrow="Scan results"
        title={scan.page.title || scan.hostname}
        description={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Severity value={scan.status} />
            <span className="break-all font-mono text-xs text-sky-200">{scan.page.finalUrl}</span>
            <span className="text-xs text-muted-foreground">
              Scanned {stamp(scan.scannedAt)} · {scan.engine} · viewport {scan.page.viewport} · lang{" "}
              {scan.page.lang ?? "(not set)"} · {scan.page.elementCount} elements · {scan.page.loadMs} ms
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => pdf.mutate()} disabled={pdf.isPending}>
              {pdf.isPending ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5" aria-hidden="true" />
              )}
              {pdf.isPending ? "Generating…" : "Download PDF report"}
            </Button>
            <Button asChild variant="ghostNeon" size="sm">
              <Link to="/recommendations">Fix recommendations</Link>
            </Button>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Failing rules" value={scan.summary.ruleCount} tone={scan.summary.ruleCount > 0 ? "critical" : "default"} />
        <StatTile label="Failing elements" value={scan.summary.elementCount} />
        <StatTile label="Rules passed" value={scan.summary.passCount} tone="low" />
        <StatTile label="Undecided rules" value={scan.summary.incompleteCount} tone="high" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">Scan ID: {scan.id}</span>
        <span className="text-[11px] text-muted-foreground">
          Findings stored: {violations.length}
          {scan.summary.truncated ? " (the stored list was capped — the counts above are the full totals)" : ""}
        </span>
      </div>

      {Object.keys(scan.summary.byWcagTag).length > 0 ? (
        <Panel className="mt-5">
          <PanelHeader>
            <PanelTitle icon={<ShieldCheck className="size-4 text-sky-300" aria-hidden="true" />}>
              WCAG tags on the failing rules
            </PanelTitle>
          </PanelHeader>
          <PanelBody>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scan.summary.byWcagTag).map(([tag, count]) => (
                <span
                  key={tag}
                  className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] text-sky-200"
                >
                  {tag} × {count}
                </span>
              ))}
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {scan.summary.ruleCount === 0 ? (
        <Panel className="mt-5 border-emerald-400/25 bg-emerald-500/10">
          <PanelBody className="pt-5">
            <p className="text-sm leading-relaxed text-emerald-100">
              axe-core reported no failing rule in the scanned tag set for this page, at this viewport, in this state. It
              confirms those rules did not fail here — not that the page is WCAG compliant.
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      {/* Findings */}
      {violations.length > 0 ? (
        <section className="mt-8" aria-labelledby="findings-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="findings-heading" className="text-lg font-semibold tracking-tight text-slate-100">
                Findings
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Grouped by axe-core impact. Expand a row to see the stored element evidence.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search rules or selectors"
                  aria-label="Search findings"
                  className="h-10 w-full bg-navy-950/70 pl-9 text-xs sm:w-64"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="size-3.5 text-slate-500" aria-hidden="true" />
                <select
                  value={impactFilter}
                  onChange={(e) => setImpactFilter(e.target.value)}
                  aria-label="Filter findings by impact"
                  className="h-10 rounded-xl border border-border bg-navy-950/70 px-3 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <option value="all">All impacts</option>
                  {IMPACT_ORDER.map((impact) => (
                    <option key={impact} value={impact}>
                      {impact}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-6">
            {IMPACT_ORDER.filter((k) => grouped.has(k)).map((impact) => (
              <div key={impact} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                  <Severity value={impact} />
                  {grouped.get(impact)!.length} rule(s)
                </h3>
                {grouped.get(impact)!.map((rule) => (
                  <Panel key={rule.id}>
                    <PanelHeader>
                      <div className="min-w-0">
                        <PanelTitle className="font-mono text-sm text-sky-300">{rule.id}</PanelTitle>
                        <p className="mt-1.5 text-sm font-medium text-slate-100">{rule.help}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {rule.nodeCount} failing element(s)
                          {rule.nodes.length < rule.nodeCount ? ` — first ${rule.nodes.length} shown` : ""}
                        </span>
                        {rule.helpUrl ? (
                          <a
                            href={rule.helpUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline"
                          >
                            Remediation guidance
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </PanelHeader>
                    <PanelBody>
                      <div className="flex flex-wrap gap-2">
                        {rule.wcagCriteria.map((c) => (
                          <span
                            key={c}
                            className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] text-sky-200"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      {rule.nodes.length > 0 ? (
                        <details className="group mt-4" open={rule.nodes.length === 1}>
                          <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-sky-400/10 bg-navy-950/50 px-3.5 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                            Show element evidence ({rule.nodes.length})
                          </summary>
                          <div className="mt-3 flex flex-col gap-2.5">
                            {rule.nodes.map((node, index) => (
                              <div key={`${rule.id}-${index}`} className="panel-flat rounded-xl p-3.5">
                                <div className="break-all font-mono text-[11px] text-sky-200">{node.target.join(" ")}</div>
                                {node.html ? (
                                  <pre className="scroll-thin mt-2 overflow-x-auto rounded-lg border border-sky-400/10 bg-navy-950/70 p-2.5 text-[11px] text-slate-300">
                                    <code>{node.html}</code>
                                  </pre>
                                ) : null}
                                {node.failureSummary ? (
                                  <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                                    {node.failureSummary}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">No stored element evidence for this rule.</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="ghostNeon"
                          size="sm"
                          onClick={() => {
                            setSelectedFinding(rule.id);
                            explain.mutate();
                          }}
                          disabled={explain.isPending}
                        >
                          <MessageSquareText className="size-3.5" aria-hidden="true" />
                          Explain this finding
                        </Button>
                      </div>
                    </PanelBody>
                  </Panel>
                ))}
              </div>
            ))}
            {filtered.length === 0 ? (
              <Panel>
                <EmptyState
                  title="No findings match the current filter"
                  body="Clear the search box or choose a different impact level to see the stored findings again."
                  action={
                    <Button
                      variant="ghostNeon"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setImpactFilter("all");
                      }}
                    >
                      Reset filters
                    </Button>
                  }
                />
              </Panel>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Report + assistant */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle icon={<FileText className="size-4 text-cyan-300" aria-hidden="true" />}>PDF report</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="text-xs leading-relaxed text-muted-foreground">
              A branded report generated from this stored scan: executive summary, severity totals, findings with their
              evidence, remediation guidance and the scan's own limitations.
            </p>
            <Button variant="primary" size="sm" className="mt-4" onClick={() => pdf.mutate()} disabled={pdf.isPending}>
              {pdf.isPending ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5" aria-hidden="true" />
              )}
              {pdf.isPending ? "Generating PDF…" : "Download PDF report"}
            </Button>
          </PanelBody>
        </Panel>

        <Panel id="assistant">
          <PanelHeader>
            <PanelTitle icon={<MessageSquareText className="size-4 text-violet-300" aria-hidden="true" />}>
              AI assistant
            </PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Explanations are generated from this scan's stored findings — the assistant cannot describe a finding that
              was not detected.
            </p>
            {violations.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Select a finding to explain">
                {violations.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={selectedFinding === v.id}
                    className={`rounded-full px-3 py-1.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      selectedFinding === v.id
                        ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white"
                        : "border border-border text-muted-foreground hover:border-sky-400/40 hover:text-sky-200"
                    }`}
                    onClick={() => setSelectedFinding(v.id)}
                  >
                    {v.id}
                  </button>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghostNeon"
              size="sm"
              className="mt-4 w-fit"
              onClick={() => explain.mutate()}
              disabled={explain.isPending || (!violations.length && !scan.incomplete.length)}
            >
              {explain.isPending ? "Explaining…" : "Explain selected finding"}
            </Button>

            {explain.isError ? (
              <p className="mt-3 text-xs text-rose-300">The explanation could not be generated. Try again.</p>
            ) : null}

            {explain.data ? (
              <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-sky-400/10 bg-navy-950/60 p-4 text-sm leading-relaxed">
                <p><span className="font-medium text-sky-200">What is the problem? </span>{explain.data.what}</p>
                <p><span className="font-medium text-sky-200">Why does it matter? </span>{explain.data.why}</p>
                <p><span className="font-medium text-sky-200">Who is affected? </span>{explain.data.who}</p>
                <div>
                  <span className="font-medium text-sky-200">What needs to be done?</span>
                  <ol className="mt-1 list-decimal pl-5 text-slate-300">
                    {explain.data.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
                <p><span className="font-medium text-sky-200">Example fix: </span><code className="break-all font-mono text-xs">{explain.data.example}</code></p>
                <p><span className="font-medium text-sky-200">Where to apply: </span>{explain.data.where}</p>
                <p><span className="font-medium text-sky-200">How to verify: </span>{explain.data.verify}</p>
                <p className="text-[11px] text-muted-foreground">
                  Evidence for this explanation: {explain.data.findingId} (impact {explain.data.impact}).
                </p>
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 ? (
        <section className="mt-8" aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading" className="text-lg font-semibold tracking-tight text-slate-100">
            Fix recommendations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Advisory guidance derived from the stored findings. Nothing on your site is modified.
          </p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {recommendations.map((r) => (
              <Panel key={r.findingId}>
                <PanelHeader>
                  <PanelTitle className="font-mono text-sm text-sky-300">{r.findingId}</PanelTitle>
                  <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                    Priority {r.priority}
                  </span>
                </PanelHeader>
                <PanelBody>
                  <p className="text-sm text-slate-100">{r.problem}</p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-300">
                    {r.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <pre className="scroll-thin mt-3 overflow-x-auto rounded-lg border border-sky-400/10 bg-navy-950/70 p-3 font-mono text-[11px] text-slate-300">
                    {r.example}
                  </pre>
                  <p className="mt-2 text-xs text-sky-200">Verify: {r.verify}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{r.caveat}</p>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {scan.incomplete.length > 0 ? (
          <Panel>
            <PanelHeader>
              <PanelTitle icon={<ShieldCheck className="size-4 text-high" aria-hidden="true" />}>
                Rules axe-core could not decide
              </PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="text-xs leading-relaxed text-muted-foreground">
                These rules need human judgement (for example whether an image is decorative). They are neither passes nor
                failures.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {scan.incomplete.map((rule) => (
                  <li key={rule.id} className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    {rule.id}
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        ) : null}

        <Panel className="border-sky-400/15 bg-sky-500/5">
          <PanelHeader>
            <PanelTitle icon={<ShieldCheck className="size-4 text-sky-200" aria-hidden="true" />}>
              Limitations of this scan
            </PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
              {scan.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      </div>
    </AppShell>
  );
}
