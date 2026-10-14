import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { PrimaryShell } from "@/components/cybersense/primary-nav";
import { Button } from "@/components/ui/button";
import { explainA11yFindingFn, getA11yScanFn, listA11yScansFn } from "@/lib/a11y/api";
import type { A11yFindingExplanation } from "@/lib/a11y/assistant";

export const Route = createFileRoute("/assistant")({
  loader: async () => {
    const scans = await listA11yScansFn();
    const latest = scans[0] ?? null;
    const scan = latest ? await getA11yScanFn({ data: { id: latest.id } }) : null;
    return { latest, scan };
  },
  component: AssistantPage,
});

function AssistantPage() {
  const { latest, scan } = Route.useLoaderData();
  const [findingId, setFindingId] = useState<string | undefined>(scan?.violations[0]?.id);

  const explain = useMutation<A11yFindingExplanation | null>({
    mutationFn: () => explainA11yFindingFn({ data: { scanId: scan?.id ?? "", findingId } }),
  });

  const findings = scan?.violations ?? [];

  return (
    <PrimaryShell>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-medium tracking-tight">AI Assistant</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The assistant explains only findings that are present in the latest stored accessibility scan. If evidence is missing, it says so.
        </p>

        {latest ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Latest stored scan:{" "}
            <Link className="text-sky-300 hover:underline" to="/accessibility/$scanId" params={{ scanId: latest.id }}>
              {latest.url}
            </Link>
          </p>
        ) : null}

        {findings.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Select a finding to explain">
            {findings.map((finding) => (
              <button
                key={finding.id}
                type="button"
                aria-pressed={findingId === finding.id}
                className={`rounded-full px-3 py-1.5 font-mono text-xs transition-colors ${
                  findingId === finding.id
                    ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white"
                    : "border border-border text-muted-foreground hover:border-sky-400/40 hover:text-sky-200"
                }`}
                onClick={() => setFindingId(finding.id)}
              >
                {finding.id}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          <Button variant="primary" onClick={() => explain.mutate()} disabled={explain.isPending || findings.length === 0}>
            <Send className="size-4" aria-hidden="true" />
            {explain.isPending ? "Explaining..." : "Explain selected finding"}
          </Button>
        </div>

        {explain.data ? (
          <div className="card-neon mt-6 rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-100">
              <MessageSquareText className="size-4 text-violet-300" aria-hidden="true" />
              {explain.data.ruleId}
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
              <p><span className="font-medium text-sky-200">What is the problem? </span>{explain.data.what}</p>
              <p><span className="font-medium text-sky-200">Why does it matter? </span>{explain.data.why}</p>
              <p><span className="font-medium text-sky-200">Who is affected? </span>{explain.data.who}</p>
              <div>
                <span className="font-medium text-sky-200">What needs to be done?</span>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-300">
                  {explain.data.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
              <p><span className="font-medium text-sky-200">Example fix: </span><code className="font-mono text-xs">{explain.data.example}</code></p>
              <p><span className="font-medium text-sky-200">Where to apply: </span>{explain.data.where}</p>
              <p><span className="font-medium text-sky-200">How to verify: </span>{explain.data.verify}</p>
              <p className="text-xs text-muted-foreground">Limitations: {explain.data.limitations.join(" ")}</p>
            </div>
          </div>
        ) : null}

        {findings.length === 0 && (
          <div className="card-neon mt-6 rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">There is no accessibility finding in the latest stored scan. Run a new scan to ask about an actual finding.</p>
          </div>
        )}
      </main>
    </PrimaryShell>
  );
}
