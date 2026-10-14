import { createFileRoute, Link } from "@tanstack/react-router";
import { PrimaryShell } from "@/components/cybersense/primary-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { a11yRecommendationsFn, listA11yScansFn } from "@/lib/a11y/api";
import type { A11yRecommendation } from "@/lib/a11y/recommendations";

export const Route = createFileRoute("/recommendations")({
  loader: async () => {
    const scans = await listA11yScansFn();
    const latest = scans[0];
    const recommendations = latest ? await a11yRecommendationsFn({ data: { scanId: latest.id } }) : null;
    return { latest, recommendations };
  },
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const { latest, recommendations } = Route.useLoaderData();

  return (
    <PrimaryShell>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-medium tracking-tight">Fix recommendations</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Advisory guidance generated from stored accessibility findings. No target site, repository, or account is modified automatically.
        </p>

        {latest ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Latest stored scan:{" "}
            <Link className="text-sky-300 hover:underline" to="/accessibility/$scanId" params={{ scanId: latest.id }}>
              {latest.url}
            </Link>
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {recommendations?.map((rec: A11yRecommendation) => (
            <div key={rec.findingId} className="card-neon rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-sky-300">{rec.findingId}</span>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">
                  Priority {rec.priority}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-100">{rec.problem}</p>
              <p className="mt-1 text-sm text-muted-foreground">{rec.why}</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                {rec.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <pre className="mt-3 overflow-auto rounded-lg border border-border/60 bg-navy-950 p-3 font-mono text-xs text-muted-foreground">{rec.example}</pre>
              <p className="mt-2 text-xs text-muted-foreground">{rec.caveat}</p>
              <p className="mt-1 text-xs text-sky-200">Verification: {rec.verify}</p>
            </div>
          ))}
          {recommendations?.length === 0 && (
            <div className="card-neon rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">The latest stored scan has no accessibility failures needing advisory remediation.</p>
            </div>
          )}
          {!recommendations && (
            <div className="card-neon rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No stored scan is available to generate recommendations.</p>
            </div>
          )}
        </div>
      </main>
    </PrimaryShell>
  );
}
