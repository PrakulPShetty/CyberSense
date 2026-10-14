import { createFileRoute, Link } from "@tanstack/react-router";
import { PrimaryShell } from "@/components/cybersense/primary-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <PrimaryShell>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-medium tracking-tight">Scan results</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          These are stored accessibility runs. Security checks are kept separately under <span className="font-mono text-sky-300">/security</span>.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              to="/accessibility/$scanId"
              params={{ scanId: scan.id }}
              className="card-neon block rounded-2xl p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-medium text-slate-100">{scan.url}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {scan.id} · {stamp(scan.scannedAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {scan.summary.ruleCount} failing rules · {scan.summary.elementCount} failing elements ·{" "}
                {scan.summary.passCount} passed rules · {scan.summary.incompleteCount} undecided rules
              </p>
            </Link>
          ))}
          {scans.length === 0 && (
            <div className="card-neon rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No accessibility scans are stored yet. Run one from the scanner.</p>
            </div>
          )}
        </div>
      </main>
    </PrimaryShell>
  );
}
