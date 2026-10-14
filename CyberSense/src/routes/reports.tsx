import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { FileText, LoaderCircle } from "lucide-react";
import { PrimaryShell } from "@/components/cybersense/primary-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateA11yReportFn, listA11yScansFn } from "@/lib/a11y/api";

export const Route = createFileRoute("/reports")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: ReportsPage,
});

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

  return (
    <PrimaryShell>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-medium tracking-tight">Reports</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Accessibility PDFs are generated from saved accessibility scan records. Current reports use a compact text-based PDF layout.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {scans.map((scan) => (
            <div key={scan.id} className="card-neon flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
              <div className="min-w-0">
                <Link className="text-base font-medium text-sky-300 hover:underline" to="/accessibility/$scanId" params={{ scanId: scan.id }}>
                  {scan.url}
                </Link>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{scan.id} · {scan.scannedAt}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {scan.summary.ruleCount} failing rules · {scan.summary.passCount} passed
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => download.mutate(scan.id)} disabled={download.isPending}>
                {download.isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <FileText className="size-3.5" aria-hidden="true" />}
                {download.isPending ? "Generating PDF..." : "Download PDF report"}
              </Button>
            </div>
          ))}
          {scans.length === 0 && (
            <div className="card-neon rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No saved scans are available to report.</p>
            </div>
          )}
        </div>
      </main>
    </PrimaryShell>
  );
}
