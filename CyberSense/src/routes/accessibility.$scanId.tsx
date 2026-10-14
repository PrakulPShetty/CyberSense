import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Severity } from "@/components/sentinel/severity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getA11yScanFn } from "@/lib/a11y/api";
import type { A11yImpact, A11yRuleResult } from "@/lib/a11y/types";

export const Route = createFileRoute("/accessibility/$scanId")({
  loader: async ({ params }) => ({ scan: await getA11yScanFn({ data: { id: params.scanId } }) }),
  component: ScanDetail,
});

const IMPACT_ORDER: (A11yImpact | "unknown")[] = ["critical", "serious", "moderate", "minor", "unknown"];

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function ScanDetail() {
  const { scan } = Route.useLoaderData();

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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <Link
        to="/accessibility"
        className="inline-flex w-fit items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All accessibility scans
      </Link>

      <div>
        <h1 className="text-2xl font-medium tracking-tight">{scan.page.title || scan.hostname}</h1>
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

      <div className="grid gap-3 sm:grid-cols-4">
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
        <Card>
          <CardHeader>
            <CardTitle>WCAG tags on the failing rules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(scan.summary.byWcagTag).map(([tag, count]) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {tag} × {count}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {scan.summary.ruleCount === 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              axe-core reported no failing rule in the scanned tag set for this page, at this viewport, in this state. It
              confirms those rules did not fail here — not that the page is WCAG compliant.
            </p>
          </CardContent>
        </Card>
      )}

      {IMPACT_ORDER.filter((k) => grouped.has(k)).map((impact) => (
        <section key={impact} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Severity value={impact} />
            {grouped.get(impact)!.length} rule(s)
          </h2>
          {grouped.get(impact)!.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{rule.id}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{rule.help}</span>
                </CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {rule.wcagCriteria.map((c) => (
                    <span key={c} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
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
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {rule.nodes.map((node, index) => (
                  <div key={`${rule.id}-${index}`} className="rounded-lg bg-muted/40 p-3">
                    <div className="font-mono text-[11px] text-foreground">{node.target.join(" ")}</div>
                    {node.html && (
                      <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground">
                        <code>{node.html}</code>
                      </pre>
                    )}
                    {node.failureSummary && (
                      <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{node.failureSummary}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      ))}

      {scan.incomplete.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rules axe-core could not decide</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              These rules need human judgement (for example whether an image is decorative). They are not passes and not
              failures.
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {scan.incomplete.map((rule) => (
                <li key={rule.id} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]">
                  {rule.id}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Limitations of this scan</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
            {scan.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-2xl tabular">{value}</div>
      </CardContent>
    </Card>
  );
}
