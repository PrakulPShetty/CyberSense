import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, FileText, Info, LoaderCircle, ScanSearch } from "lucide-react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { MetaList, MetaRow } from "@/components/ui/table";
import { generateA11yReportFn, listA11yScansFn } from "@/lib/a11y/api";

export const Route = createFileRoute("/reports")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: ReportsPage,
});

function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

const REPORT_SECTIONS = [
  "Cover page with the target, report identifier and generation time",
  "Executive summary with the recorded finding counts and severity totals",
  "Accessibility findings with impact, description, WCAG tags and element evidence",
  "Advisory remediation guidance for each failing rule",
  "Rules the engine could not decide, and the scan's own limitations",
] as const;

function ReportsPage() {
  const { scans } = Route.useLoaderData();

  const download = useMutation({
    mutationFn: (scanId: string) => generateA11yReportFn({ data: { scanId } }),
    onSuccess: (result) => {
      if (!result) return;
      const bin = atob(result.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const newest = scans[0];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Deliverables"
        title="Reports"
        description="A branded PDF generated from a saved scan. The report contains only what the scan recorded, together with the limitations of automated testing."
        actions={
          <Button asChild variant="ghostNeon">
            <Link to="/results">Back to results</Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle icon={<FileText className="size-4 text-cyan-300" aria-hidden="true" />}>Available reports</PanelTitle>
              <p className="mt-1 text-xs text-muted-foreground">One report per stored scan. Downloading re-generates it from the stored record.</p>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{scans.length} scan(s)</span>
          </PanelHeader>
          <PanelBody className="flex flex-col gap-3">
            {scans.map((scan) => (
              <div key={scan.id} className="panel-flat flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
                <div className="min-w-0">
                  <Link
                    to="/accessibility/$scanId"
                    params={{ scanId: scan.id }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 hover:underline"
                  >
                    <span className="truncate">{scan.hostname || scan.url}</span>
                    <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                  </Link>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{scan.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scanned {stamp(scan.scannedAt)} · {scan.summary.ruleCount} failing rules ·{" "}
                    {scan.summary.elementCount} elements · {scan.summary.passCount} passed
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Severity value={scan.status} />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => download.mutate(scan.id)}
                    disabled={download.isPending}
                  >
                    {download.isPending && download.variables === scan.id ? (
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileText className="size-3.5" aria-hidden="true" />
                    )}
                    {download.isPending && download.variables === scan.id ? "Generating…" : "Download PDF report"}
                  </Button>
                </div>
              </div>
            ))}

            {scans.length === 0 ? (
              <EmptyState
                title="No reports available"
                body="Reports are generated from saved scans. Run a scan and a report becomes available for it."
                icon={<FileText className="size-5" aria-hidden="true" />}
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link to="/accessibility">
                      <ScanSearch className="size-3.5" aria-hidden="true" />
                      Run a scan
                    </Link>
                  </Button>
                }
              />
            ) : null}

            {download.isError ? (
              <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <p className="flex items-center gap-2 font-semibold text-rose-200">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  The report could not be generated
                </p>
                <p className="mt-1 text-xs text-rose-100/80">Reload the page and try again, or open the scan and download from there.</p>
              </div>
            ) : null}
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader>
              <PanelTitle icon={<Info className="size-4 text-sky-300" aria-hidden="true" />}>Report preview</PanelTitle>
            </PanelHeader>
            <PanelBody>
              {newest ? (
                <>
                  <MetaList>
                    <MetaRow label="Target" value={newest.hostname || newest.url} />
                    <MetaRow label="Report ID" value={newest.id} />
                    <MetaRow label="Scan date" value={stamp(newest.scannedAt)} />
                    <MetaRow label="Failing rules" value={String(newest.summary.ruleCount)} />
                    <MetaRow label="Failing elements" value={String(newest.summary.elementCount)} />
                    <MetaRow label="Rules passed" value={String(newest.summary.passCount)} />
                    <MetaRow label="Undecided rules" value={String(newest.summary.incompleteCount)} />
                  </MetaList>
                  <ol className="mt-4 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
                    {REPORT_SECTIONS.map((section, index) => (
                      <li key={section} className="flex gap-2.5">
                        <span className="font-mono text-[11px] text-sky-300">{String(index + 1).padStart(2, "0")}</span>
                        {section}
                      </li>
                    ))}
                  </ol>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => download.mutate(newest.id)}
                    disabled={download.isPending}
                  >
                    {download.isPending && download.variables === newest.id ? (
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileText className="size-3.5" aria-hidden="true" />
                    )}
                    Download the latest report
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Report metadata appears here once at least one scan is stored.
                </p>
              )}
            </PanelBody>
          </Panel>

          <Panel className="border-sky-400/15 bg-sky-500/5">
            <PanelBody className="pt-5">
              <h2 className="text-sm font-semibold text-sky-100">What the report does not claim</h2>
              <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
                <li>A clean scan is not a statement of WCAG compliance.</li>
                <li>Security observations describe configuration that was visible in an ordinary request — not a full security assessment.</li>
                <li>Findings reflect one page, one viewport and one moment in time.</li>
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
