import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PrimaryShell } from "@/components/cybersense/primary-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compareA11yScansFn, listA11yScansFn } from "@/lib/a11y/api";

export const Route = createFileRoute("/history")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: HistoryPage,
});

function HistoryPage() {
  const { scans } = Route.useLoaderData();
  const [baseId, setBaseId] = useState("");
  const [laterId, setLaterId] = useState("");
  const compare = useMutation({
    mutationFn: () => compareA11yScansFn({ data: { baseId, laterId } }),
  });

  return (
    <PrimaryShell>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-medium tracking-tight">Scan history and progress</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Trend values are calculated only from stored accessibility scans. Comparisons are valid only for scans with the same host.
        </p>

        <div className="card-neon mt-6 rounded-2xl p-5">
          <h2 className="text-sm font-semibold tracking-tight">Finding trend across saved scans</h2>
          <div className="mt-4">
            {scans.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={scans.map((s) => ({
                    name: s.id,
                    rules: s.summary.ruleCount,
                    elements: s.summary.elementCount,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,0.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8b8b93" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#8b8b93" }} />
                  <Tooltip
                    contentStyle={{ background: "#101736", border: "1px solid rgba(125,211,252,0.2)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#bae6fd" }}
                  />
                  <Bar dataKey="rules" fill="#f87171" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="elements" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No stored scans are available.</p>
            )}
          </div>
        </div>

        <div className="card-neon mt-6 rounded-2xl p-5">
          <h2 className="text-sm font-semibold tracking-tight">Compare compatible scans</h2>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className="rounded-lg border border-border bg-navy-900 px-3 py-2 text-sm" aria-label="Base scan">
                <option value="">Base scan…</option>
                {scans.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
              <select value={laterId} onChange={(e) => setLaterId(e.target.value)} className="rounded-lg border border-border bg-navy-900 px-3 py-2 text-sm" aria-label="Later scan">
                <option value="">Later scan…</option>
                {scans.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
              <Button variant="ghostNeon" size="sm" onClick={() => compare.mutate()} disabled={!baseId || !laterId || compare.isPending}>
                {compare.isPending ? "Comparing…" : "Compare"}
              </Button>
            </div>
            {compare.data && (
              <div className="rounded-lg border border-border/60 bg-navy-900/60 p-4 text-sm">
                <p>Comparable: {String(compare.data.comparable)} {compare.data.reasons.join("; ")}</p>
                <p>New findings: {compare.data.newRules.join(", ") || "none"}</p>
                <p>Resolved findings: {compare.data.resolvedRules.join(", ") || "none"}</p>
                <p>Persistent findings: {compare.data.persistentRules.join(", ") || "none"}</p>
                <p>Changed findings: {compare.data.changedRules.join(", ") || "none"}</p>
                <p>Counts: base {compare.data.counts.base}, later {compare.data.counts.later}, new {compare.data.counts.new}, resolved {compare.data.counts.resolved}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card-neon mt-6 rounded-2xl p-5">
          <h2 className="text-sm font-semibold tracking-tight">Saved scans</h2>
          <div className="mt-4 flex flex-col gap-3">
            {scans.map((scan) => (
              <div key={scan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-navy-900/60 p-4">
                <div className="min-w-0">
                  <Link className="text-sky-300 hover:underline" to="/accessibility/$scanId" params={{ scanId: scan.id }}>{scan.url}</Link>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{scan.scannedAt} · {scan.summary.ruleCount} failing rules</p>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs tabular text-muted-foreground">
                  <span className="text-rose-300">{scan.summary.ruleCount} rules</span>
                  <span className="text-sky-300">{scan.summary.passCount} passed</span>
                </div>
              </div>
            ))}
            {scans.length === 0 && <p className="text-sm text-muted-foreground">No stored scans are available.</p>}
          </div>
        </div>
      </main>
    </PrimaryShell>
  );
}
