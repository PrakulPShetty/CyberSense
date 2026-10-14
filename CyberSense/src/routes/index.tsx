import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Accessibility, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Wordmark } from "@/components/sentinel/brand";
import { Score, Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createAssessmentFn, historyFn, listAssessmentsFn } from "@/lib/sentinel/api";
import { useAssessments, useHistory } from "@/lib/sentinel/use-assessment";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [list, history] = await Promise.all([listAssessmentsFn(), historyFn()]);
    return { list, history };
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  const { data: list } = useAssessments(initial.list);
  const { data: history } = useHistory(initial.history);
  const navigate = useNavigate();
  const [target, setTarget] = useState("demo-university.edu");
  const [authorizedBy, setAuthorizedBy] = useState("Office of Information Security (synthetic)");
  const [confirmation, setConfirmation] = useState("I confirm this target is authorized for synthetic assessment");
  const [mode, setMode] = useState<"DEMO" | "LIVE">("DEMO");
  const [err, setErr] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () =>
      createAssessmentFn({
        data: {
          target,
          authorizedBy,
          confirmationText: confirmation,
          mode,
        },
      }),
    onSuccess: (res) => navigate({ to: "/assessments/$id", params: { id: res.id } }),
    onError: (e) => setErr(e instanceof Error ? e.message : "Assessment failed"),
  });

  const demo = (list ?? initial.list)?.find((a) => a.id === "asm_northshore_now");
  const weeks = history ?? initial.history;

  return (
    <div className="min-h-dvh bg-background scan-grid">
      <header className="flex items-center justify-between px-6 py-5">
        <Wordmark />
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Authorized targets only</span>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 pt-6 md:grid-cols-[1.15fr_0.85fr] md:pt-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Cyber exposure twin</p>
          <h1 className="mt-3 max-w-xl text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Evidence before interpretation. Simulation before change.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
            SENTINEL-X builds a temporal model of authorized external exposure, traces attack paths to
            evidence, and tests defenses without touching the target. The model is never a confirmed compromise.
          </p>
          {demo && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Northshore State University</CardTitle>
                <p className="text-sm text-muted-foreground">Synthetic demonstration twin · demo-university.edu</p>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex gap-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posture</div>
                    <Score value={demo.overallScore ?? 0} className="text-3xl" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical paths</div>
                    <div className="font-mono text-3xl tabular">{demo.criticalPaths ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
                    <div className="font-mono text-3xl tabular">{Math.round((demo.confidence ?? 0) * 100)}</div>
                  </div>
                </div>
                <Button asChild>
                  <Link to="/assessments/$id" params={{ id: demo.id }}>
                    Open current twin <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="mt-6 flex gap-3">
            {weeks.map((h) => (
              <Link
                key={h.id}
                to="/assessments/$id/drift"
                params={{ id: "asm_northshore_now" }}
                className="flex-1 rounded-lg bg-card p-3 shadow-[0_0_0_1px_rgba(236,236,239,0.08)]"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {h.id.endsWith("w1") ? "Week −3" : h.id.endsWith("w2") ? "Week −2" : "Now"}
                </div>
                <Score value={h.score} className="text-xl" />
                <Severity value={h.band} className="mt-1" />
              </Link>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Launch assessment</CardTitle>
            <p className="text-sm text-muted-foreground">
              Authorization is mandatory. Intrusive scanning and exploitation are blocked.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              {(["DEMO", "LIVE"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "DEMO") setTarget("demo-university.edu");
                  }}
                  className={`h-10 flex-1 rounded-md text-xs uppercase tracking-wider ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {m} mode
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="target">Authorized target</Label>
              <Input id="target" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="who">Authorized by</Label>
              <Input id="who" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="conf">Confirmation</Label>
              <Input id="conf" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-1" />
            </div>
            {err && <p className="text-sm text-critical">{err}</p>}
            <Button onClick={() => { setErr(null); run.mutate(); }} disabled={run.isPending}>
              <ShieldCheck className="size-4" />
              {run.isPending ? "Running pipeline…" : "Authorize and run"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Live mode performs passive DNS only against a fixed resolver. It never fetches the target,
              never exploits, and treats source failure as unknown — not as absence of risk.
            </p>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Accessibility className="size-4" aria-hidden="true" />
                Accessibility scanner (Track D)
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Separately from the exposure twin, a real browser renders a page and axe-core reports the accessibility
                rules it actually fails. Stored apart from cyber findings.
              </p>
              <Link
                to="/accessibility"
                className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                Open the accessibility scanner <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-sm font-medium">Assessment history</h2>
        <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-[0_0_0_1px_rgba(236,236,239,0.08)]">
          {(list ?? initial.list).map((a) => (
            <Link
              key={a.id}
              to="/assessments/$id"
              params={{ id: a.id }}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
            >
              <div>
                <div className="text-sm">{a.organizationName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{a.target}</div>
              </div>
              <div className="flex items-center gap-3">
                <Severity value={a.mode} />
                <Severity value={a.status} />
                {a.overallScore != null && <Score value={a.overallScore} />}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
