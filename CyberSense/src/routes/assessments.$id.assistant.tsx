import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { explainFn } from "@/lib/sentinel/api";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/assistant")({ component: AssistantPage });

const PROMPTS = [
  "What is our biggest modeled security weakness?",
  "Why is the highest-risk path scored that way?",
  "What happens if we enable MFA?",
  "What evidence should we verify next?",
  "Explain this to a nontechnical executive.",
  "What changed since the previous assessment?",
];

function AssistantPage() {
  const { id } = useParams({ from: "/assessments/$id/assistant" });
  const { data: snap } = useAssessment(id);
  const [q, setQ] = useState(PROMPTS[0]);
  const [audience, setAudience] = useState<"executive" | "engineer">("engineer");
  const ask = useMutation({
    mutationFn: () => explainFn({ data: { assessmentId: id, question: q, audience } }),
  });
  if (!snap) return null;
  const r = ask.data;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Decision analyst</h1>
        <p className="text-sm text-muted-foreground">
          Grounded on this assessment only. The model cannot invent CVEs, assets, or compromise. Untrusted source text is never treated as instructions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="rounded-full bg-muted px-3 py-2 text-left text-xs"
            onClick={() => setQ(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => ask.mutate()} disabled={ask.isPending}>
          {ask.isPending ? "Analyzing…" : "Ask"}
        </Button>
      </div>
      <div className="flex gap-2">
        {["engineer", "executive"].map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAudience(a as "engineer" | "executive")}
            className={`h-9 rounded-full px-3 text-xs ${audience === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {a}
          </button>
        ))}
      </div>
      {r && (
        <Card>
          <CardHeader>
            <CardTitle>Decision analyst</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <Severity value={r.explanation.severity} />
              <Severity value={r.provider} />
              {r.rejected && <Severity value="UNKNOWN" />}
            </div>
            <p>{r.explanation.summary}</p>
            <div className="flex flex-col gap-3">
              {r.explanation.claims.map((c, i) => (
                <div key={i} className="rounded-md bg-muted/40 p-3">
                  <div className="flex gap-2">
                    <Severity value={c.kind} />
                  </div>
                  <p className="mt-1">{c.text}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    evidence {c.evidenceIds.join(", ") || "—"} · paths {c.pathIds.join(", ") || "—"}
                  </p>
                </div>
              ))}
            </div>
            {r.explanation.insufficientEvidence && <p>Insufficient evidence.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}