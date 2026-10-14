import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  History,
  Rocket,
  ScanSearch,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { PrimaryShell } from "@/components/cybersense/primary-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compareA11yScansFn, listA11yScansFn } from "@/lib/a11y/api";
import type { A11yScanListItem } from "@/lib/a11y/types";
import { Severity } from "@/components/sentinel/severity";

export const Route = createFileRoute("/dashboard")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: DashboardPage,
});

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function DashboardPage() {
  const { scans } = Route.useLoaderData();
  const [baseId, setBaseId] = useState("");
  const [laterId, setLaterId] = useState("");
  const compare = useMutation({ mutationFn: () => compareA11yScansFn({ data: { baseId, laterId } }) });

  const totalScans = scans.length;
  const issuesFound = scans.reduce((sum, s) => sum + s.summary.ruleCount, 0);
  const latest = scans[0];

  const latestScore = latest
    ? Math.round((latest.summary.passCount / Math.max(1, latest.summary.passCount + latest.summary.ruleCount)) * 100)
    : null;

  return (
    <PrimaryShell>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Accessibility metrics computed from stored scan records. Empty states are shown honestly when no data exists yet.
            </p>
          </div>
          <Button asChild variant="primary">
            <Link to="/accessibility">
              <ScanSearch className="size-4" aria-hidden="true" />
              New Scan
            </Link>
          </Button>
        </div>

        {/* Metric cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Activity className="size-4 text-sky-300" aria-hidden="true" />}
            label="Total scans"
            value={String(totalScans)}
            hint={totalScans ? `Oldest ${stamp(scans[scans.length - 1].scannedAt)}` : "No scans recorded"}
          />
          <MetricCard
            icon={<AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />}
            label="Issues found"
            value={String(issuesFound)}
            hint={totalScans ? "Failing rules across all scans" : "No issues recorded"}
          />
          <MetricCard
            icon={<CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />}
            label="Resolved issues"
            value={compare.data ? String(compare.data.counts.resolved) : "—"}
            hint={compare.data
              ? `${baseId.slice(0, 8)} → ${laterId.slice(0, 8)}`
              : "Compare two scans of the same host"}
          />
          <MetricCard
            icon={<TrendingUp className="size-4 text-violet-300" aria-hidden="true" />}
            label="Accessibility score"
            value={latestScore != null ? String(latestScore) : "—"}
            hint={latest && latestScore != null
              ? `${latest.summary.passCount} rules passed on latest scan`
              : "No scan available to score"}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Recent scans table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-sky-300" aria-hidden="true" />
                Recent scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scans.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Target</th>
                        <th className="pb-2 pr-4 font-medium">Scanned</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Failing rules</th>
                        <th className="pb-2 font-medium">Elements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scans.slice(0, 8).map((s: A11yScanListItem) => (
                        <tr key={s.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 pr-4">
                            <Link
                              to="/accessibility/$scanId"
                              params={{ scanId: s.id }}
                              className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                            >
                              <span className="max-w-[220px] truncate">{s.url}</span>
                              <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{stamp(s.scannedAt)}</td>
                          <td className="py-2.5 pr-4"><Severity value={s.status} /></td>
                          <td className="py-2.5 pr-4 font-mono tabular">{s.summary.ruleCount}</td>
                          <td className="py-2.5 font-mono tabular text-muted-foreground">{s.summary.elementCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No scans yet"
                  body="Run your first accessibility scan and the results will appear here."
                  action={<Button asChild variant="primary" size="sm"><Link to="/accessibility">New Scan</Link></Button>}
                />
              )}
            </CardContent>
          </Card>

          {/* Right column: activity + getting started */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4 text-cyan-300" aria-hidden="true" />
                  Scan activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scans.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {scans.slice(0, 4).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs text-muted-foreground">{s.id}</div>
                          <div className="mt-0.5 flex gap-2 font-mono text-[11px]">
                            <span className="text-rose-300">{s.summary.ruleCount} rules</span>
                            <span className="text-sky-300">{s.summary.passCount} passed</span>
                          </div>
                        </div>
                        <Severity value={s.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="size-4 text-violet-300" aria-hidden="true" />
                  Getting started
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <QuickAction to="/accessibility" icon={<ScanSearch className="size-4 text-sky-300" aria-hidden="true" />} label="Run an accessibility scan" />
                <QuickAction to="/security" icon={<span className="inline-block size-4 rounded-sm bg-gradient-to-br from-sky-500/30 to-violet-500/30 ring-1 ring-sky-400/30" aria-hidden="true" />} label="Check website security" />
                <QuickAction to="/recommendations" icon={<SlidersHorizontal className="size-4 text-indigo-300" aria-hidden="true" />} label="Review recommendations" />
                <QuickAction to="/reports" icon={<FileText className="size-4 text-cyan-300" aria-hidden="true" />} label="Download a PDF report" />
                <div className="mt-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">Compare progress between two stored scans of the same host:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" aria-label="Base scan">
                      <option value="">Base scan…</option>
                      {scans.map((s) => <option key={s.id} value={s.id}>{s.id.slice(0, 12)}…</option>)}
                    </select>
                    <select value={laterId} onChange={(e) => setLaterId(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" aria-label="Later scan">
                      <option value="">Later scan…</option>
                      {scans.map((s) => <option key={s.id} value={s.id}>{s.id.slice(0, 12)}…</option>)}
                    </select>
                    <Button size="sm" variant="ghostNeon" onClick={() => compare.mutate()} disabled={!baseId || !laterId || compare.isPending}>
                      {compare.isPending ? "Comparing…" : "Compare"}
                    </Button>
                  </div>
                  {compare.data && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Comparable: {String(compare.data.comparable)} · new {compare.data.counts.new} · resolved {compare.data.counts.resolved}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </PrimaryShell>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="card-neon rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-400/20">{icon}</span>
      </div>
      <div className="mt-3 font-mono text-3xl tabular text-slate-100">{value}</div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm text-slate-300 transition-colors hover:border-sky-400/40 hover:text-sky-200">
      {icon}
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
