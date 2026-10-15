import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, FileText, Filter, ScanSearch, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { TableWrap, Td, Th } from "@/components/ui/table";
import { listA11yScansFn } from "@/lib/a11y/api";

export const Route = createFileRoute("/results")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: ResultsPage,
});

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function ResultsPage() {
  const { scans } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scans.filter((scan) => {
      if (status !== "all" && scan.status !== status) return false;
      if (!needle) return true;
      return (
        scan.url.toLowerCase().includes(needle) ||
        scan.hostname.toLowerCase().includes(needle) ||
        scan.id.toLowerCase().includes(needle)
      );
    });
  }, [scans, query, status]);

  const totalRules = scans.reduce((sum, s) => sum + s.summary.ruleCount, 0);
  const totalElements = scans.reduce((sum, s) => sum + s.summary.elementCount, 0);
  const latest = scans[0];
  const latestScore = latest
    ? Math.round((latest.summary.passCount / Math.max(1, latest.summary.passCount + latest.summary.ruleCount)) * 100)
    : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Findings"
        title="Scan Results"
        description="Every stored accessibility scan with the counts recorded from axe-core. Open a scan to inspect rule identifiers, impacts, selectors and the stored HTML evidence."
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
        <MetricCard label="Stored scans" value={String(scans.length)} hint={scans.length ? "Accessibility runs on record" : "Nothing stored yet"} icon={<Activity className="size-4" aria-hidden="true" />} tone="blue" />
        <MetricCard label="Failing rules" value={String(totalRules)} hint="Total across all stored scans" icon={<Filter className="size-4" aria-hidden="true" />} tone="amber" />
        <MetricCard label="Failing elements" value={String(totalElements)} hint="Individual elements flagged by axe-core" icon={<Search className="size-4" aria-hidden="true" />} tone="red" />
        <MetricCard label="Latest score" value={latestScore != null ? `${latestScore}%` : "—"} hint={latest ? `Passed rules on ${latest.hostname}` : "No scan to score"} icon={<FileText className="size-4" aria-hidden="true" />} tone="violet" />
      </div>

      <Panel className="mt-6">
        <PanelHeader>
          <div>
            <PanelTitle icon={<Activity className="size-4 text-sky-300" aria-hidden="true" />}>All scan results</PanelTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Security observations are kept separately under Security Checks — the two are never merged into one score.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search website or scan ID"
                aria-label="Search scans"
                className="h-10 w-full bg-navy-950/70 pl-9 text-xs sm:w-60"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by scan status"
              className="h-10 rounded-xl border border-border bg-navy-950/70 px-3 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <option value="all">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PARTIAL">Partial</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </PanelHeader>
        <PanelBody>
          {filtered.length > 0 ? (
            <TableWrap className="[&_table]:min-w-[900px]">
              <thead>
                <tr>
                  <Th>Website</Th>
                  <Th>Scanned</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Failing rules</Th>
                  <Th className="text-right">Elements</Th>
                  <Th className="text-right">Passed</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((scan) => (
                  <tr key={scan.id}>
                    <Td className="max-w-[16rem]">
                      <Link
                        to="/accessibility/$scanId"
                        params={{ scanId: scan.id }}
                        className="inline-flex items-center gap-1.5 text-sky-300 hover:underline"
                      >
                        <span className="truncate">{scan.hostname || scan.url}</span>
                        <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                      </Link>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{scan.url}</div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{scan.id}</div>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{stamp(scan.scannedAt)}</Td>
                    <Td><Severity value={scan.status} /></Td>
                    <Td className="text-right font-mono tabular text-critical">{scan.summary.ruleCount}</Td>
                    <Td className="text-right font-mono tabular">{scan.summary.elementCount}</Td>
                    <Td className="text-right font-mono tabular text-low">{scan.summary.passCount}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="ghostNeon" size="sm">
                          <Link to="/accessibility/$scanId" params={{ scanId: scan.id }}>
                            View findings
                          </Link>
                        </Button>
                        <Button asChild variant="ghostNeon" size="sm">
                          <Link to="/reports">PDF</Link>
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : scans.length === 0 ? (
            <EmptyState
              title="No scan results yet"
              body="Run your first accessibility scan and its findings will appear here with the full stored evidence."
              icon={<ScanSearch className="size-5" aria-hidden="true" />}
              action={
                <Button asChild variant="primary" size="sm">
                  <Link to="/accessibility">Run a scan</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No scans match this filter"
              body="Clear the search box or choose a different status to see the stored results again."
              action={
                <Button
                  variant="ghostNeon"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          )}
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
