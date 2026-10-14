import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Severity } from "@/components/sentinel/severity";
import { Card, CardContent } from "@/components/ui/card";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/evidence")({ component: EvidencePage });

function EvidencePage() {
  const { id } = useParams({ from: "/assessments/$id/evidence" });
  const { data: snap } = useAssessment(id);
  const [open, setOpen] = useState<string | null>(null);
  if (!snap) return null;
  const selected = snap.evidence.find((e) => e.id === open) ?? snap.evidence[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Evidence locker</h1>
        <p className="mb-4 text-sm text-muted-foreground">Provenance for every observation. Nothing here is a vulnerability by itself.</p>
        <div className="flex flex-col gap-2">
          {snap.evidence.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setOpen(e.id)}
              className="rounded-lg bg-card p-3 text-left text-sm shadow-[0_0_0_1px_rgba(236,236,239,0.08)] hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px]">{e.id}</span>
                <div className="flex gap-1">
                  <Severity value={e.freshness} />
                  <Severity value={e.kind} />
                </div>
              </div>
              <div className="mt-1">{e.normalized.type}</div>
              <div className="truncate text-xs text-muted-foreground">{e.normalized.value}</div>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <Card className="h-fit">
          <CardContent className="flex flex-col gap-2 pt-5 text-sm">
            <div className="font-mono text-xs">{selected.id}</div>
            <Row k="What" v={selected.normalized.value} />
            <Row k="Source" v={`${selected.source} (${selected.sourceType})`} />
            <Row k="Observed" v={selected.observationTimestamp} />
            <Row k="Ingested" v={selected.ingestionTimestamp} />
            <Row k="Reliability" v={String(selected.sourceReliability)} />
            <Row k="Confidence" v={`${Math.round(selected.evidenceConfidence * 100)}%`} />
            <Row k="Corroboration" v={String(selected.corroborationCount)} />
            <Row k="Verification" v={selected.verificationState} />
            <Row k="Provenance" v={selected.provenance} />
            <Row k="Raw ref" v={selected.rawObservationReference} />
            <Row k="Assets" v={selected.assetIds.join(", ") || "—"} />
            <Row k="Relationships" v={selected.relationshipIds.join(", ") || "—"} />
            <Row k="Paths" v={selected.pathIds.join(", ") || "—"} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="break-all font-mono text-xs">{v}</div>
    </div>
  );
}
