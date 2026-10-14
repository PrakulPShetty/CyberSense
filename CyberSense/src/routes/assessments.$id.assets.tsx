import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Score, Severity } from "@/components/sentinel/severity";
import { Input } from "@/components/ui/input";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/assets")({ component: AssetsPage });

function AssetsPage() {
  const { id } = useParams({ from: "/assessments/$id/assets" });
  const { data: snap } = useAssessment(id);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    if (!snap) return [];
    const shadows = new Set(snap.shadowAssets.map((s) => s.assetId));
    return snap.assets
      .filter((a) => `${a.displayName} ${a.type} ${a.canonicalId}`.toLowerCase().includes(q.toLowerCase()))
      .map((a) => ({ ...a, shadow: shadows.has(a.id) }));
  }, [snap, q]);
  if (!snap) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Asset inventory</h1>
          <p className="text-sm text-muted-foreground">{snap.assets.length} resolved assets · known vs discovered</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="max-w-xs" />
      </div>
      <div className="overflow-x-auto rounded-xl bg-card shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Asset", "Type", "Criticality", "Exposure", "Ownership", "Conf", "Sources"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{a.displayName}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{a.id}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{a.type}</td>
                <td className="px-3 py-2">
                  <Severity value={a.criticality} />
                </td>
                <td className="px-3 py-2 text-xs">{a.exposureState}</td>
                <td className="px-3 py-2">
                  {a.shadow ? <Severity value="VERIFY" /> : <span className="text-xs text-muted-foreground">{a.ownershipState}</span>}
                </td>
                <td className="px-3 py-2 font-mono tabular">{Math.round(a.confidence * 100)}%</td>
                <td className="px-3 py-2 font-mono tabular">{a.sourceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Score value={snap.risk.overallScore} className="hidden" />
    </div>
  );
}
