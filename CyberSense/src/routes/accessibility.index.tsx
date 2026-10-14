import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Accessibility, Info, ScanSearch } from "lucide-react";
import { useState } from "react";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { listA11yScansFn, runA11yScanFn } from "@/lib/a11y/api";
import type { A11yScanListItem, A11yScanOutcome } from "@/lib/a11y/types";

export const Route = createFileRoute("/accessibility/")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: AccessibilityPage,
});

/** UTC formatting only — a locale-dependent date would differ between server and client. */
function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function AccessibilityPage() {
  const initial = Route.useLoaderData();
  const [url, setUrl] = useState("");
  const scan = useMutation({
    mutationFn: (target: string) => runA11yScanFn({ data: { url: target } }),
  });

  const outcome: A11yScanOutcome | undefined = scan.data;
  const history: A11yScanListItem[] = initial.scans;

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <Accessibility className="size-5" aria-hidden="true" />
          <div className="leading-none">
            <div className="text-sm font-medium tracking-[0.14em]">ACCESSIBILITY</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Track D · automated page scan
            </div>
          </div>
        </div>
        <Link to="/" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          Back to SENTINEL-X
        </Link>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Accessibility scanner</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A real browser loads the page you name and axe-core runs its accessibility rules against the rendered DOM.
            Every rule, impact, selector and snippet shown below is returned by that engine — nothing is prewritten or
            inferred. Results are stored separately from SENTINEL-X cyber findings.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scan a page</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label htmlFor="a11y-url">Page URL</Label>
              <Input
                id="a11y-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.org/page"
                className="mt-1"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Only public http/https addresses are accepted. Private, loopback and link-local targets are refused, the
                scan will not follow a redirect onto another host, and every request is subject to a 20 s navigation and
                45 s overall budget. To scan the bundled controlled fixture (a page with deliberate defects), start the
                app with <span className="font-mono">npm run dev:a11y-demo</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => scan.mutate(url)}
                disabled={scan.isPending || url.trim().length === 0}
                className="w-fit"
              >
                <ScanSearch className="size-4" aria-hidden="true" />
                {scan.isPending ? "Rendering and running axe-core…" : "Run accessibility scan"}
              </Button>
              <Link to="/a11y-demo" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
                View the controlled fixture page
              </Link>
            </div>
          </CardContent>
        </Card>

        {outcome && !outcome.ok && (
          <Card>
            <CardHeader>
              <CardTitle>Scan refused ({outcome.error_code})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-critical">{outcome.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                A refused or failed scan is recorded in the audit log and is never displayed as a page that passed.
              </p>
            </CardContent>
          </Card>
        )}

        {outcome?.ok && (
          <Card>
            <CardHeader>
              <CardTitle>{outcome.scan.page.title || outcome.scan.url}</CardTitle>
              <p className="font-mono text-[11px] text-muted-foreground">{outcome.scan.page.finalUrl}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Failing rules" value={outcome.scan.summary.ruleCount} />
                <Stat label="Failing elements" value={outcome.scan.summary.elementCount} />
                <Stat label="Rules passed" value={outcome.scan.summary.passCount} />
                <Stat label="Undecided rules" value={outcome.scan.summary.incompleteCount} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["critical", "serious", "moderate", "minor", "unknown"] as const)
                  .filter((k) => outcome.scan.summary.byImpact[k] > 0)
                  .map((k) => (
                    <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Severity value={k} />
                      {outcome.scan.summary.byImpact[k]} rule(s)
                    </span>
                  ))}
                {outcome.scan.summary.ruleCount === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No rule in this tag set failed on this page, at this viewport, in this state. That is not a claim of
                    WCAG compliance — see the limitations below.
                  </p>
                )}
              </div>
              {/* A real anchor: navigation stays keyboard- and screen-reader-friendly. */}
              <Button variant="outline" size="sm" className="w-fit" asChild>
                <Link to="/accessibility/$scanId" params={{ scanId: outcome.scan.id }}>
                  Open full findings
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4" aria-hidden="true" />
              What automated scanning does not prove
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>Automated rules detect only a subset of WCAG success criteria; a clean scan is not WCAG compliance.</li>
              <li>The page is loaded once, at one viewport, in its initial state; menus, modals and interactive states are not exercised.</li>
              <li>Authenticated pages and content behind user input are never reached.</li>
              <li>Some accessibility problems — cognitive load, reading order quality, meaningful alt text — require manual testing.</li>
            </ul>
          </CardContent>
        </Card>

        <section>
          <h2 className="text-sm font-medium">Scan history</h2>
          <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
            {history.map((row) => (
              <Link
                key={row.id}
                to="/accessibility/$scanId"
                params={{ scanId: row.id }}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">{row.url}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {stamp(row.scannedAt)} · {row.engine}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Severity value={row.status} />
                  <span className="font-mono text-xs tabular">{row.summary.elementCount} elements</span>
                  <span className="font-mono text-xs tabular">{row.summary.ruleCount} rules</span>
                </div>
              </Link>
            ))}
            {history.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No accessibility scans recorded yet. Run one above.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl tabular">{value}</div>
    </div>
  );
}
