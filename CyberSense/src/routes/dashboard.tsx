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
  MessageSquare,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, StatTile } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { TableWrap, Td, Th } from "@/components/ui/table";
import { compareA11yScansFn, listA11yScansFn } from "@/lib/a11y/api";
import type { A11yScanListItem } from "@/lib/a11y/types";

export const Route = createFileRoute("/dashboard")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: DashboardPage,
});

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

/** Decorative radar mark beside the page title. Purely visual. */
function DashboardPulse() {
  return (
    <span className="relative hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-navy-900/80 ring-1 ring-sky-400/25 sm:flex" aria-hidden="true">
      <span className="absolute inset-0 rounded-2xl bg-sky-500/10 animate-pulse-glow" />
      <span className="absolute inset-0 animate-pulse-ring rounded-2xl ring-1 ring-sky-400/40" />
      <Activity className="relative size-5 text-sky-300" />
    </span>
  );
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

  // Oldest → newest so the chart reads left to right.
  const chartData = [...scans]
    .slice(0, 10)
    .reverse()
    .map((scan) => ({
      name: scan.id.slice(-6),
      rules: scan.summary.ruleCount,
      elements: scan.summary.elementCount,
    }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Overview"
        visual={<DashboardPulse />}
        title="Dashboard"
        description="Metrics computed from stored scan records. When nothing has been scanned yet, the panel says so instead of showing a placeholder figure."
        actions={
          <>
            <Button asChild variant="ghostNeon">
              <Link to="/security">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Security checks
              </Link>
            </Button>
            <Button asChild variant="primary">
              <Link to="/accessibility">
                <ScanSearch className="size-4" aria-hidden="true" />
                New Scan
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total scans"
          value={String(totalScans)}
          hint={totalScans ? `Oldest ${stamp(scans[scans.length - 1].scannedAt)}` : "No scans recorded yet"}
          icon={<Activity className="size-4" aria-hidden="true" />}
          tone="blue"
        />
        <MetricCard
          label="Issues found"
          value={String(issuesFound)}
          hint={totalScans ? "Failing rules across all stored scans" : "Nothing recorded yet"}
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
          tone="amber"
        />
        <MetricCard
          label="Resolved issues"
          value={compare.data ? String(compare.data.counts.resolved) : "—"}
          hint={
            compare.data
              ? `Comparing ${baseId.slice(0, 12)} → ${laterId.slice(0, 12)}`
              : "Compare two scans of the same host below"
          }
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="green"
        />
        <MetricCard
          label="Accessibility score"
          value={latestScore != null ? `${latestScore}%` : "—"}
          hint={
            latest && latestScore != null
              ? `${latest.summary.passCount} rules passed on the latest scan`
              : "No scan available to score"
          }
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
          tone="violet"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        {/* Recent scans */}
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle icon={<History className="size-4 text-sky-300" aria-hidden="true" />}>Recent scans</PanelTitle>
              <p className="mt-1 text-xs text-muted-foreground">The eight most recent stored scans, newest first.</p>
            </div>
            <Button asChild variant="ghostNeon" size="sm">
              <Link to="/results">
                All results
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </PanelHeader>
          <PanelBody>
            {scans.length > 0 ? (
              <TableWrap className="[&_table]:min-w-[880px]">
                <thead>
                  <tr>
                    <Th>Website</Th>
                    <Th>Scanned</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Failing rules</Th>
                    <Th className="text-right">Elements</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {scans.slice(0, 8).map((scan: A11yScanListItem) => (
                    <tr key={scan.id}>
                      <Td className="max-w-[15rem]">
                        <Link
                          to="/accessibility/$scanId"
                          params={{ scanId: scan.id }}
                          className="inline-flex items-center gap-1.5 text-sky-300 hover:underline"
                        >
                          <span className="truncate">{scan.hostname || scan.url}</span>
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                        </Link>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{scan.id}</div>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{stamp(scan.scannedAt)}</Td>
                      <Td><Severity value={scan.status} /></Td>
                      <Td className="text-right font-mono tabular">{scan.summary.ruleCount}</Td>
                      <Td className="text-right font-mono tabular text-muted-foreground">{scan.summary.elementCount}</Td>
                      <Td className="text-right">
                        <Button asChild variant="ghostNeon" size="sm">
                          <Link to="/accessibility/$scanId" params={{ scanId: scan.id }}>
                            View results
                          </Link>
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No scans yet"
                body="Run an accessibility scan and every stored finding will appear here, on the results page and in the report."
                icon={<ScanSearch className="size-5" aria-hidden="true" />}
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link to="/accessibility">Run your first scan</Link>
                  </Button>
                }
              />
            )}
          </PanelBody>
        </Panel>

        {/* Quick actions */}
        <Panel>
            <PanelHeader>
              <PanelTitle icon={<SlidersHorizontal className="size-4 text-violet-300" aria-hidden="true" />}>
                Quick actions
              </PanelTitle>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-2.5">
              <QuickAction to="/accessibility" icon={<ScanSearch className="size-4 text-sky-300" aria-hidden="true" />} label="Scan a website" hint="Run a real browser scan" />
              <QuickAction to="/history" icon={<History className="size-4 text-cyan-300" aria-hidden="true" />} label="View scan history" hint="Track and compare findings" />
              <QuickAction to="/reports" icon={<FileText className="size-4 text-violet-300" aria-hidden="true" />} label="Generate a PDF report" hint="Download a branded report" />
              <QuickAction to="/assistant" icon={<MessageSquare className="size-4 text-indigo-300" aria-hidden="true" />} label="Open the AI assistant" hint="Explain a stored finding" />
            </PanelBody>
          </Panel>

      </div>

      {/* Scan activity */}
      <Panel className="mt-5">
            <PanelHeader>
              <div>
                <PanelTitle icon={<TrendingUp className="size-4 text-sky-300" aria-hidden="true" />}>Scan activity</PanelTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Failing rules and elements recorded by each stored scan, oldest to newest.
                </p>
              </div>
            </PanelHeader>
            <PanelBody>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8ea3c9" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8ea3c9" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#0b1224",
                        border: "1px solid rgba(125,211,252,0.2)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#bae6fd" }}
                    />
                    <Bar dataKey="rules" name="Failing rules" fill="#f87171" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="elements" name="Failing elements" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No scans recorded yet — the chart is drawn from stored results only.
                </p>
              )}
            </PanelBody>
      </Panel>

      {/* Getting started */}
      <Panel className="mt-5">
        <PanelHeader>
          <div>
            <PanelTitle icon={<CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />}>
              Getting started
            </PanelTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Scan a page, then compare two scans of the same host to see what improved.
            </p>
          </div>
        </PanelHeader>
        <PanelBody className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <ol className="flex flex-col gap-3">
            {[
              { to: "/accessibility", label: "Run a scan on a public URL", body: "A real browser renders the page; axe-core checks the rendered DOM." },
              { to: "/results", label: "Inspect the findings", body: "Every rule, impact, selector and HTML snippet is stored with the scan." },
              { to: "/reports", label: "Download a PDF report", body: "Executive summary, findings, guidance and the scan's limitations." },
            ].map((step, index) => (
              <li key={step.label}>
                <Link
                  to={step.to}
                  className="flex items-start gap-3 rounded-xl border border-sky-400/10 bg-navy-950/40 px-4 py-3 transition-colors hover:border-sky-400/30 hover:bg-sky-500/5"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 font-mono text-xs text-sky-300 ring-1 ring-sky-400/20">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-100">{step.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{step.body}</span>
                  </span>
                  <ArrowRight className="ml-auto mt-1 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>

          <div className="panel-flat rounded-xl p-4">
            <SectionHeading
              title="Compare progress"
              description="Comparisons are only valid for two scans of the same host."
              className="flex-col items-start gap-1"
            />
            <div className="mt-4 flex flex-col gap-2.5">
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Base scan
                <select
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  className="rounded-xl border border-border bg-navy-950/70 px-3 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <option value="">Select a base scan…</option>
                  {scans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.hostname || s.url} — {stamp(s.scannedAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Later scan
                <select
                  value={laterId}
                  onChange={(e) => setLaterId(e.target.value)}
                  className="rounded-xl border border-border bg-navy-950/70 px-3 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <option value="">Select a later scan…</option>
                  {scans.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.hostname || s.url} — {stamp(s.scannedAt)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="primary"
                size="sm"
                className="w-fit"
                onClick={() => compare.mutate()}
                disabled={!baseId || !laterId || compare.isPending}
              >
                {compare.isPending ? "Comparing…" : "Compare scans"}
              </Button>
            </div>

            {compare.data ? (
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <StatTile label="New" value={String(compare.data.counts.new)} tone={compare.data.counts.new > 0 ? "high" : "default"} />
                <StatTile label="Resolved" value={String(compare.data.counts.resolved)} tone={compare.data.counts.resolved > 0 ? "low" : "default"} />
                <StatTile label="Persistent" value={String(compare.data.persistentRules.length)} />
              </div>
            ) : (
              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                Select two stored scans of the same host to compare their findings.
              </p>
            )}
            {compare.data && !compare.data.comparable && (
              <p className="mt-3 text-[11px] leading-relaxed text-high">
                {compare.data.reasons.join(" ") || "These scans are not comparable."}
              </p>
            )}
          </div>
        </PanelBody>
      </Panel>
    </AppShell>
  );
}

function QuickAction({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-sky-400/10 bg-navy-950/40 px-3.5 py-3 transition-colors hover:border-sky-400/35 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-400/20">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-slate-100">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <ArrowRight className="ml-auto size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
    </Link>
  );
}
