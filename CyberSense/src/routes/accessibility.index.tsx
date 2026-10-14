import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Accessibility, ArrowRight, Info, LoaderCircle, ScanSearch, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { compareA11yScansFn, listA11yScansFn, runA11yScanFn } from "@/lib/a11y/api";

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
  const router = useRouter();
  const [url, setUrl] = useState("");
  const scan = useMutation({
    mutationFn: (target: string) => runA11yScanFn({ data: { url: target } }),
    // A completed scan is persisted server-side, so the sibling lists on this route
    // (history, compare selects) must be re-read — loader data is otherwise frozen
    // at the moment of navigation and the new scan would appear to be missing.
    onSuccess: (outcome) => {
      if (outcome.ok) void router.invalidate();
    },
  });

  const outcome = scan.data;
  const history = initial.scans;
  const [baseId, setBaseId] = useState("");
  const [laterId, setLaterId] = useState("");
  const compare = useMutation({
    mutationFn: () => compareA11yScansFn({ data: { baseId, laterId } }),
  });

  return (
    <div className="min-h-dvh bg-navy-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 ring-1 ring-sky-400/30">
              <Accessibility className="size-5 text-sky-300" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Accessibility scanner</h1>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Track D · automated page scan</p>
            </div>
          </div>
          <Link to="/" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-sky-300">
            Back to home
          </Link>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          A real browser loads the page you name and axe-core runs its accessibility rules against the rendered DOM.
          Every rule, impact, selector and snippet shown below is returned by that engine — nothing is prewritten or inferred.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Scan form */}
          <div className="flex flex-col gap-6">
            <div className="card-neon rounded-2xl p-6">
              <h2 className="text-base font-semibold tracking-tight">Scan a page</h2>
              <div className="mt-4">
                <Label htmlFor="a11y-url">Page URL</Label>
                <Input
                  id="a11y-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.org/page"
                  className="mt-1.5"
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
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => scan.mutate(url)}
                  disabled={scan.isPending || url.trim().length === 0}
                >
                  {scan.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
                  {scan.isPending ? "Rendering and running axe-core…" : "Run accessibility scan"}
                </Button>
                <Button asChild variant="ghostNeon">
                  <Link to="/security">Run website security checks</Link>
                </Button>
                <Link to="/a11y-demo" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-sky-300">
                  View the controlled fixture page
                </Link>
              </div>
            </div>

            {outcome && !outcome.ok && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-5">
                <h2 className="text-sm font-semibold text-rose-300">Scan refused ({outcome.error_code})</h2>
                <p className="mt-1.5 text-sm text-rose-200/90">{outcome.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  A refused or failed scan is recorded in the audit log and is never displayed as a page that passed.
                </p>
              </div>
            )}

            {outcome?.ok && (
              <div className="card-neon rounded-2xl p-6">
                <h2 className="text-base font-semibold tracking-tight">{outcome.scan.page.title || outcome.scan.url}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{outcome.scan.page.finalUrl}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  <Stat label="Failing rules" value={outcome.scan.summary.ruleCount} />
                  <Stat label="Failing elements" value={outcome.scan.summary.elementCount} />
                  <Stat label="Rules passed" value={outcome.scan.summary.passCount} />
                  <Stat label="Undecided rules" value={outcome.scan.summary.incompleteCount} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
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
                <Button asChild variant="primary" size="sm" className="mt-4">
                  <Link to="/accessibility/$scanId" params={{ scanId: outcome.scan.id }}>
                    Open full findings
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-sky-400/15 bg-sky-500/5 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                <Info className="size-4" aria-hidden="true" />
                What automated scanning does not prove
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>Automated rules detect only a subset of WCAG success criteria; a clean scan is not WCAG compliance.</li>
                <li>The page is loaded once, at one viewport, in its initial state; menus, modals and interactive states are not exercised.</li>
                <li>Authenticated pages and content behind user input are never reached.</li>
                <li>Some accessibility problems — cognitive load, reading order quality, meaningful alt text — require manual testing.</li>
              </ul>
            </div>
          </div>

          {/* Right column: history + compare */}
          <div className="flex flex-col gap-6">
            <div className="card-neon rounded-2xl p-6">
              <h2 className="text-base font-semibold tracking-tight">Scan history</h2>
              <div className="mt-4 flex max-h-[380px] flex-col gap-1 overflow-y-auto pr-1">
                {history.map((row) => (
                  <Link
                    key={row.id}
                    to="/accessibility/$scanId"
                    params={{ scanId: row.id }}
                    className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-sky-400/10"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-200 group-hover:text-sky-200">{row.url}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {stamp(row.scannedAt)} · {row.engine}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Severity value={row.status} />
                      <span className="font-mono text-xs tabular text-muted-foreground">{row.summary.ruleCount} rules</span>
                    </div>
                  </Link>
                ))}
                {history.length === 0 && (
                  <p className="px-3 py-6 text-sm text-muted-foreground">
                    No accessibility scans recorded yet. Run one above.
                  </p>
                )}
              </div>
            </div>

            <div className="card-neon rounded-2xl p-6">
              <h2 className="text-base font-semibold tracking-tight">Historical comparison / progress</h2>
              <div className="mt-4 flex flex-col gap-2">
                <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className="rounded-lg border border-border bg-navy-900 px-3 py-2 text-sm" aria-label="Base scan">
                  <option value="">Base scan…</option>
                  {history.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
                <select value={laterId} onChange={(e) => setLaterId(e.target.value)} className="rounded-lg border border-border bg-navy-900 px-3 py-2 text-sm" aria-label="Later scan">
                  <option value="">Later scan…</option>
                  {history.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
                <Button variant="ghostNeon" size="sm" onClick={() => compare.mutate()} disabled={!baseId || !laterId || compare.isPending}>
                  {compare.isPending ? "Comparing…" : "Compare"}
                </Button>
              </div>
              {compare.data && (
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <p>Comparable: {String(compare.data.comparable)} {compare.data.reasons.join("; ")}</p>
                  <p>New findings: {compare.data.newRules.join(", ") || "none"}</p>
                  <p>Resolved findings: {compare.data.resolvedRules.join(", ") || "none"}</p>
                  <p>Persistent findings: {compare.data.persistentRules.join(", ") || "none"}</p>
                  <p>Changed findings: {compare.data.changedRules.join(", ") || "none"}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl tabular text-slate-100">{value}</div>
    </div>
  );
}
