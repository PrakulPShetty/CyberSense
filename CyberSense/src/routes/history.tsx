import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, FileText, GitCompareArrows, History as HistoryIcon, ScanSearch, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, StatTile } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { TableWrap, Td, Th } from "@/components/ui/table";
import { compareA11yScansFn, listA11yScansFn } from "@/lib/a11y/api";

export const Route = createFileRoute("/history")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: HistoryPage,
});

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function HistoryPage() {
  const { scans } = Route.useLoaderData();
  const [baseId, setBaseId] = useState("");
  const [laterId, setLaterId] = useState("");
  const compare = useMutation({
    mutationFn: () => compareA11yScansFn({ data: { baseId, laterId } }),
  });

  const chronological = [...scans].reverse();
  const chartData = chronological.map((scan) => ({
    name: scan.id.slice(-6),
    rules: scan.summary.ruleCount,
    elements: scan.summary.elementCount,
  }));

  const oldest = scans[scans.length - 1];
  const newest = scans[0];
  const trend =
    oldest && newest && oldest.id !== newest.id ? newest.summary.ruleCount - oldest.summary.ruleCount : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Tracking"
        title="Scan History"
        description="Every stored scan with the counts it recorded. Trends are drawn only from saved results, and a comparison is only valid between two scans of the same host."
        actions={
          <Button asChild variant="primary">
            <Link to="/accessibility">
              <ScanSearch className="size-4" aria-hidden="true" />
              New Scan
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Saved scans" value={String(scans.length)} hint={scans.length ? "Stored with their evidence" : "Nothing recorded yet"} icon={<HistoryIcon className="size-4" aria-hidden="true" />} tone="blue" />
        <MetricCard label="Hosts seen" value={String(new Set(scans.map((s) => s.hostname)).size)} hint="Distinct websites scanned (real hostnames only)" icon={<ScanSearch className="size-4" aria-hidden="true" />} tone="cyan" />
        <MetricCard
          label="Latest failing rules"
          value={newest ? String(newest.summary.ruleCount) : "—"}
          hint={newest ? `Recorded ${stamp(newest.scannedAt)}` : "No scan to report"}
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
          tone="amber"
        />
        <MetricCard
          label="Change since first scan"
          value={trend == null ? "—" : `${trend > 0 ? "+" : ""}${trend}`}
          hint={trend == null ? "Two scans of the same host are needed" : "Failing rules vs the oldest stored scan"}
          icon={trend != null && trend < 0 ? <TrendingDown className="size-4" aria-hidden="true" /> : <TrendingUp className="size-4" aria-hidden="true" />}
          tone={trend == null ? "violet" : trend > 0 ? "red" : "green"}
        />
      </div>

      <Panel className="mt-6">
        <PanelHeader>
          <div>
            <PanelTitle icon={<TrendingUp className="size-4 text-sky-300" aria-hidden="true" />}>Finding trend</PanelTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Failing rules and elements recorded by each stored scan, oldest to newest.
            </p>
          </div>
        </PanelHeader>
        <PanelBody>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rules-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="elements-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,0.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8ea3c9" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8ea3c9" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0b1224", border: "1px solid rgba(125,211,252,0.2)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "#bae6fd" }}
                />
                <Area type="monotone" dataKey="rules" name="Failing rules" stroke="#f87171" fill="url(#rules-fill)" strokeWidth={2} />
                <Area type="monotone" dataKey="elements" name="Failing elements" stroke="#38bdf8" fill="url(#elements-fill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No history to chart"
              body="The trend is computed from stored scans. Run at least one scan and it will appear here."
              icon={<HistoryIcon className="size-5" aria-hidden="true" />}
              action={
                <Button asChild variant="primary" size="sm">
                  <Link to="/accessibility">Run a scan</Link>
                </Button>
              }
            />
          )}
        </PanelBody>
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <Panel>
          <PanelHeader>
            <PanelTitle icon={<GitCompareArrows className="size-4 text-violet-300" aria-hidden="true" />}>
              Compare scans
            </PanelTitle>
          </PanelHeader>
          <PanelBody>
            <SectionHeading
              title="Progress between two scans"
              description="Comparable only when both scans target the same host."
              className="flex-col items-start gap-1"
            />
            <div className="mt-4 flex flex-col gap-2.5">
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Base scan
                <select
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  className="rounded-xl border border-border bg-navy-950/70 px-3 py-2.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
                  className="rounded-xl border border-border bg-navy-950/70 px-3 py-2.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
              <div className="mt-5 flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <StatTile label="New" value={String(compare.data.counts.new)} tone={compare.data.counts.new > 0 ? "high" : "default"} />
                  <StatTile label="Resolved" value={String(compare.data.counts.resolved)} tone={compare.data.counts.resolved > 0 ? "low" : "default"} />
                  <StatTile label="Base total" value={String(compare.data.counts.base)} />
                </div>
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <p className={compare.data.comparable ? "text-slate-300" : "text-high"}>
                    Comparable: {String(compare.data.comparable)}
                    {compare.data.reasons.length ? ` — ${compare.data.reasons.join(" ")}` : ""}
                  </p>
                  <p>New findings: {compare.data.newRules.join(", ") || "none"}</p>
                  <p>Resolved findings: {compare.data.resolvedRules.join(", ") || "none"}</p>
                  <p>Persistent findings: {compare.data.persistentRules.join(", ") || "none"}</p>
                  <p>Changed findings: {compare.data.changedRules.join(", ") || "none"}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                Select two stored scans to see which findings are new, resolved, persistent or changed.
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle icon={<HistoryIcon className="size-4 text-sky-300" aria-hidden="true" />}>Saved scans</PanelTitle>
              <p className="mt-1 text-xs text-muted-foreground">Newest first. Open a scan for its findings and evidence.</p>
            </div>
          </PanelHeader>
          <PanelBody>
            {scans.length > 0 ? (
              <TableWrap className="[&_table]:min-w-[720px]">
                <thead>
                  <tr>
                    <Th>Website</Th>
                    <Th>Scanned</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Rules</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id}>
                      <Td className="max-w-[14rem]">
                        <Link
                          to="/accessibility/$scanId"
                          params={{ scanId: scan.id }}
                          className="inline-flex items-center gap-1.5 text-sky-300 hover:underline"
                        >
                          <span className="truncate">{scan.hostname || scan.url}</span>
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                        </Link>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{scan.id}</div>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{stamp(scan.scannedAt)}</Td>
                      <Td><Severity value={scan.status} /></Td>
                      <Td className="text-right font-mono tabular">{scan.summary.ruleCount}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="ghostNeon" size="sm">
                            <Link to="/accessibility/$scanId" params={{ scanId: scan.id }}>
                              Findings
                            </Link>
                          </Button>
                          <Button asChild variant="ghostNeon" size="sm">
                            <Link to="/reports">
                              <FileText className="size-3.5" aria-hidden="true" />
                              Report
                            </Link>
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No scans stored"
                body="Scan history is built from saved scans. Nothing has been recorded in this session yet."
                icon={<HistoryIcon className="size-5" aria-hidden="true" />}
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link to="/accessibility">Run a scan</Link>
                  </Button>
                }
              />
            )}
          </PanelBody>
        </Panel>
      </div>
    </AppShell>
  );
}
