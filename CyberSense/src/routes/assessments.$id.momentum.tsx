import { createFileRoute, useParams } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssessment } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/assessments/$id/momentum")({ component: MomentumPage });

function MomentumPage() {
  const { id } = useParams({ from: "/assessments/$id/momentum" });
  const { data: snap } = useAssessment(id);
  if (!snap?.momentum) return null;
  const m = snap.momentum;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">{m.label}</h1>
        <p className="text-sm text-muted-foreground">
          Project-specific metric, not an industry standard. Positive means exposure is becoming more dangerous.
        </p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
          <div className="font-mono text-5xl tabular">{m.score}</div>
          <div className="mt-1 text-sm text-muted-foreground">{m.direction}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.components}>
              <XAxis dataKey="name" stroke="#8b8b93" fontSize={10} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis stroke="#8b8b93" fontSize={11} />
              <Tooltip contentStyle={{ background: "#161618", border: "1px solid #27272b" }} />
              <Bar dataKey="contribution" fill="#d8dbe3" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
