import { createFileRoute, Link } from "@tanstack/react-router";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Severity } from "@/components/sentinel/severity";
import { useAssessment, useHistory } from "@/lib/sentinel/use-assessment";
import { useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/assessments/$id/drift")({ component: DriftPage });

function DriftPage() {
  const { id } = useParams({ from: "/assessments/$id/drift" });
  const { data: snap } = useAssessment(id);
  const { data: history } = useHistory();
  if (!snap) return null;
  const points = (history ?? []).map((h) => ({
    name: h.id.endsWith("w1") ? "W−3" : h.id.endsWith("w2") ? "W−2" : "Now",
    risk: h.score,
  }));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Security drift</h1>
        <p className="text-sm text-muted-foreground">{snap.drift?.causalExplanation ?? "No prior twin to compare."}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Modeled risk over synthetic weeks</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points.length ? points : [{ name: "Now", risk: snap.risk.overallScore }]}>
              <XAxis dataKey="name" stroke="#8b8b93" fontSize={11} />
              <YAxis stroke="#8b8b93" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#161618", border: "1px solid #27272b" }} />
              <Line type="monotone" dataKey="risk" stroke="#d8dbe3" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2">
        {(snap.drift?.events ?? []).map((e) => (
          <div key={e.id} className="rounded-lg bg-card p-3 shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
            <div className="flex flex-wrap items-center gap-2">
              <Severity value={e.type} />
              <span className="text-sm">{e.summary}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{e.details}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-sm">
        {(history ?? []).map((h) => (
          <Link key={h.id} to="/assessments/$id" params={{ id: h.id }} className="rounded-md bg-muted px-3 py-2">
            {h.id.replace("asm_northshore_", "")} · {h.score}
          </Link>
        ))}
      </div>
    </div>
  );
}
