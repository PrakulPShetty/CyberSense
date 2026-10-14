import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, LoaderCircle, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (!scan) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-medium tracking-tight">Scan not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">No accessibility scan is stored under that id.</p>
        <Link to="/accessibility" className="mt-4 inline-block text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
          Back to the scanner
        </Link>
      </div>
    );
  }

  const grouped = new Map<A11yImpact | "unknown", A11yRuleResult[]>();
  for (const v of scan.violations) {
    const key = v.impact ?? "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), v]);
  }

  return (
    <div className="min-h-dvh bg-navy-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Link
          to="/accessibility"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-sky-300"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All accessibility scans
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{scan.page.title || scan.hostname}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{scan.page.finalUrl}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Severity value={scan.status} />
            <span>Scanned {stamp(scan.scannedAt)}</span>
            <span>·</span>
            <span>{scan.engine}</span>
            <span>·</span>
            <span>viewport {scan.page.viewport}</span>
            <span>·</span>
            <span>lang {scan.page.lang ?? "(not set)"}</span>
            <span>·</span>
            <span>{scan.page.elementCount} elements</span>
            <span>·</span>
            <span>{scan.page.loadMs} ms</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Failing rules" value={scan.summary.ruleCount} />
          <Stat label="Failing elements" value={scan.summary.elementCount} />
          <Stat label="Rules passed" value={scan.summary.passCount} />
          <Stat label="Undecided rules" value={scan.summary.incompleteCount} />
        </div>

        {scan.summary.truncated && (
          <p className="text-xs text-high">
            The stored finding list was capped; the counts above are the full totals.
          </p>
        )}

        {Object.keys(scan.summary.byWcagTag).length > 0 && (
          <div className="card-neon rounded-2xl p-5">
            <h2 className="text-sm font-semibold tracking-tight">WCAG tags on the failing rules</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(scan.summary.byWcagTag).map(([tag, count]) => (
                <span key={tag} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] text-sky-200">
                  {tag} × {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {scan.summary.ruleCount === 0 && (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">
              axe-core reported no failing rule in the scanned tag set for this page, at this viewport, in this state. It
              confirms those rules did not fail here — not that the page is WCAG compliant.
            </p>
          </div>
        )}

        {IMPACT_ORDER.filter((k) => grouped.has(k)).map((impact) => (
          <section key={impact} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Severity value={impact} />
              {grouped.get(impact)!.length} rule(s)
            </h2>
            {grouped.get(impact)!.map((rule) => (
              <div key={rule.id} className="card-neon rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-sky-300">{rule.id}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm font-medium text-slate-100">{rule.help}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rule.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {rule.wcagCriteria.map((c) => (
                    <span key={c} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] text-sky-200">
                      {c}
                    </span>
                  ))}
                  <span className="text-[11px] text-muted-foreground">
                    {rule.nodeCount} failing element(s)
                    {rule.nodes.length < rule.nodeCount ? ` — first ${rule.nodes.length} shown` : ""}
                  </span>
                  {rule.helpUrl && (
                    <a
                      href={rule.helpUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[11px] text-medium hover:underline"
                    >
                      Remediation guidance
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-2.5">
                  {rule.nodes.map((node, index) => (
                    <div key={`${rule.id}-${index}`} className="rounded-lg border border-border/60 bg-navy-900/60 p-3">
                      <div className="font-mono text-[11px] text-sky-200">{node.target.join(" ")}</div>
                      {node.html && (
                        <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground">
                          <code>{node.html}</code>
                        </pre>
                      )}
                      {node.failureSummary && (
                        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{node.failureSummary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-neon rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <FileText className="size-4 text-cyan-300" aria-hidden="true" />
              PDF report
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Generate a downloadable PDF for this saved scan, including counts, evidence, and limitations.
            </p>
            <Button variant="primary" size="sm" className="mt-3" onClick={() => pdf.mutate()} disabled={pdf.isPending}>
              {pdf.isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <FileText className="size-3.5" aria-hidden="true" />}
              {pdf.isPending ? "Generating PDF..." : "Download PDF report"}
            </Button>
          </div>

          <div className="card-neon rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <MessageSquareText className="size-4 text-violet-300" aria-hidden="true" />
              AI Assistant (simple academic English)
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {scan.violations.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select a finding to explain">
                  {scan.violations.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={selectedFinding === v.id}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
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
              )}
              <Button type="button" variant="ghostNeon" size="sm" onClick={() => explain.mutate()} disabled={explain.isPending || (!scan.violations.length && !scan.incomplete.length)} className="w-fit">
                {explain.isPending ? "Explaining..." : "Explain selected finding"}
              </Button>
              {explain.data && (
                <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-navy-900/60 p-4 text-sm">
                  <p><span className="font-medium text-sky-200">What is the problem? </span>{explain.data.what}</p>
                  <p><span className="font-medium text-sky-200">Why does it matter? </span>{explain.data.why}</p>
                  <p><span className="font-medium text-sky-200">Who is affected? </span>{explain.data.who}</p>
                  <div><span className="font-medium text-sky-200">What needs to be done?</span><ol className="mt-1 list-decimal pl-5 text-slate-300">{explain.data.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
                  <p><span className="font-medium text-sky-200">Example fix: </span><code className="font-mono text-xs">{explain.data.example}</code></p>
                  <p><span className="font-medium text-sky-200">Where to apply: </span>{explain.data.where}</p>
                  <p><span className="font-medium text-sky-200">How to verify: </span>{explain.data.verify}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {recommendations && recommendations.length > 0 && (
          <div className="card-neon rounded-2xl p-5">
            <h2 className="text-sm font-semibold tracking-tight">Fix recommendations</h2>
            <div className="mt-3 flex flex-col gap-3">
              {recommendations.map((r) => (
                <div key={r.findingId} className="rounded-lg border border-border/60 bg-navy-900/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-sky-300">{r.findingId}</span>
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">Priority {r.priority}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-200">{r.problem}</p>
                  <ol className="mt-2 list-decimal pl-5 text-xs leading-relaxed text-muted-foreground">
                    {r.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <pre className="mt-2 overflow-auto rounded border border-border/60 bg-navy-950 p-2 font-mono text-[11px] text-muted-foreground">{r.example}</pre>
                  <p className="mt-1.5 text-xs text-muted-foreground">{r.caveat}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {scan.incomplete.length > 0 && (
          <div className="card-neon rounded-2xl p-5">
            <h2 className="text-sm font-semibold tracking-tight">Rules axe-core could not decide</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              These rules need human judgement (for example whether an image is decorative). They are not passes and not
              failures.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {scan.incomplete.map((rule) => (
                <li key={rule.id} className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  {rule.id}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-sky-400/15 bg-sky-500/5 p-5">
          <h2 className="text-sm font-semibold text-sky-200">Limitations of this scan</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
            {scan.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl tabular text-slate-100">{value}</div>
    </div>
  );
}
