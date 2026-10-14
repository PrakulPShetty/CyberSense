import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { explainSecurityCheckFn, generateSecurityReportFn, getSecurityCheckFn, securityRecommendationsFn } from "@/lib/security/api";

export const Route = createFileRoute("/security/$id")({
  loader: async ({ params }) => ({ run: await getSecurityCheckFn({ data: { id: params.id } }) }),
  component: SecurityDetailPage,
});

function SecurityDetailPage() {
  const { id } = Route.useParams();
  const { run } = Route.useLoaderData();

  const explain = useMutation({
    mutationFn: (checkId: string) => explainSecurityCheckFn({ data: { id, checkId } }),
  });
  const recommendations = useMutation({
    mutationFn: () => securityRecommendationsFn({ data: { id } }),
  });

  const report = useMutation({
    mutationFn: () => generateSecurityReportFn({ data: { id } }),
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

  if (!run) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-medium">Security check not found</h1>
        <Link to="/security" className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground">
          Back to security checks
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <Link to="/security" className="inline-flex w-fit items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All security checks
      </Link>

      <div>
        <h1 className="text-2xl font-medium">Saved security check</h1>
        <p className="mt-1 text-sm text-muted-foreground break-all">{run.targetUrl}</p>
        <p className="font-mono text-xs text-muted-foreground">ID: {run.id ?? id}</p>
        <p className="font-mono text-xs text-muted-foreground">Observed {run.completedAt}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF report</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => report.mutate()} disabled={report.isPending}>
            {report.isPending ? "Generating PDF..." : "Download security PDF report"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observed results</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {run.results.map((result) => (
            <div key={result.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => explain.mutate(result.id)} className="text-left text-sm font-medium hover:underline">
                  {result.description}
                </button>
                <span className="rounded-full bg-muted px-2 py-1 text-xs uppercase">{result.status}</span>
              </div>
              <p>Expected: {result.expected}</p>
              <p className="break-all">Observed: <span className="font-mono">{result.observed}</span></p>
              {result.severityRationale && <p className="text-xs text-muted-foreground">{result.severityRationale}</p>}
              {result.limitation && <p className="text-xs text-muted-foreground">Limitation: {result.limitation}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI explanation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Select any result above, or request the first unavailable/error check.</p>
          {explain.data && (
            <div className="flex flex-col gap-2 text-sm">
              <p><span className="font-medium">What is the problem? </span>{explain.data.what}</p>
              <p><span className="font-medium">Why does it matter? </span>{explain.data.why}</p>
              <p><span className="font-medium">Who is affected? </span>{explain.data.who}</p>
              <div>
                <span className="font-medium">What should be done?</span>
                <ol className="list-decimal pl-5">{explain.data.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
              </div>
              <p><span className="font-medium">Example fix: </span><code>{explain.data.example}</code></p>
              <p><span className="font-medium">Where to apply: </span>{explain.data.where}</p>
              <p><span className="font-medium">How to verify: </span>{explain.data.verify}</p>
              <p><span className="font-medium">Evidence: </span><span className="break-all font-mono">{explain.data.evidence}</span></p>
              <p className="text-xs text-muted-foreground">Limitations: {explain.data.limitations.join(" ")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remediation guidance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => recommendations.mutate()} disabled={recommendations.isPending}>
            {recommendations.isPending ? "Generating guidance..." : "Show recommended actions"}
          </Button>
          {recommendations.data && (
            <div className="flex flex-col gap-3">
              {recommendations.data.map((rec) => (
                <div key={rec.checkId} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{rec.checkId}</span>
                    <span className="text-xs text-muted-foreground">Priority {rec.priority}</span>
                  </div>
                  <p>{rec.action}</p>
                  <p><span className="font-medium">Example:</span> <code>{rec.example}</code></p>
                  <p><span className="font-medium">Verify:</span> {rec.verification}</p>
                  <p className="text-xs text-muted-foreground">{rec.caveat}</p>
                </div>
              ))}
              {recommendations.data.length === 0 && <p>No failed or unverified checks require remediation.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
