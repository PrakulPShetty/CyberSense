import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Bot, Info, LoaderCircle, MessageSquareText, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { explainA11yFindingFn, getA11yScanFn, listA11yScansFn } from "@/lib/a11y/api";
import type { A11yFindingExplanation } from "@/lib/a11y/assistant";
import type { A11yScanRecord } from "@/lib/a11y/types";

export const Route = createFileRoute("/assistant")({
  loader: async () => {
    const scans = await listA11yScansFn();
    const latest = scans[0] ?? null;
    const scan = latest ? await getA11yScanFn({ data: { id: latest.id } }) : null;
    return { scans, latest, scan };
  },
  component: AssistantPage,
});

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; findingId?: string }
  | { id: string; role: "explanation"; findingId: string; data: A11yFindingExplanation }

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

function AssistantPage() {
  const { scans, scan: initialScan } = Route.useLoaderData();
  const [scan, setScan] = useState<A11yScanRecord | null>(initialScan);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const switchScan = useMutation({
    mutationFn: (id: string) => getA11yScanFn({ data: { id } }),
    onSuccess: (next) => {
      setScan(next ?? null);
      setMessages([]);
    },
  });

  const explain = useMutation({
    mutationFn: (findingId?: string) => explainA11yFindingFn({ data: { scanId: scan?.id ?? "", findingId } }),
    onSuccess: (data, findingId) => {
      if (!data) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", text: "I could not read that finding from the stored scan. Try another rule identifier." },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { id: nextId(), role: "explanation", findingId: data.findingId || findingId || "finding", data }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: "The explanation request failed. The stored scan may no longer be available." },
      ]);
    },
  });

  const findings = scan?.violations ?? [];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, explain.isPending]);

  function askFinding(findingId: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: `Explain the finding "${findingId}".` }]);
    explain.mutate(findingId);
  }

  function submit(text: string) {
    const value = text.trim();
    if (!value) return;
    setInput("");
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: value }]);

    const lower = value.toLowerCase();
    // Match only against findings that are actually stored in this scan.
    const match = findings.find((rule) => lower.includes(rule.id.toLowerCase()));
    if (match) {
      explain.mutate(match.id);
      return;
    }

    const byHelp = findings.find((rule) => rule.help.toLowerCase().split(" ").some((word) => word.length > 5 && lower.includes(word)));
    if (byHelp) {
      explain.mutate(byHelp.id);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        text: findings.length
          ? `I can only explain findings that are stored in this scan. Stored findings are: ${findings
              .map((r) => r.id)
              .join(", ")}. Name one of them, or pick it below.`
          : "This scan has no stored failing findings, so there is nothing for me to explain. Run a scan that returns findings and they will be available here.",
      },
    ]);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Grounded explanations"
        title="AI Assistant"
        description="The assistant explains findings that are stored in a saved scan. It reads the recorded rule, impact and element evidence, and says so when there is nothing to explain."
        actions={
          <Button asChild variant="ghostNeon">
            <Link to="/results">Back to results</Link>
          </Button>
        }
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* Conversation */}
        <Panel className="flex min-h-[32rem] flex-col">
          <PanelHeader>
            <div className="min-w-0">
              <PanelTitle icon={<MessageSquareText className="size-4 text-violet-300" aria-hidden="true" />}>
                Conversation
              </PanelTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {scan ? (
                  <>
                    Grounded in scan <span className="font-mono text-sky-200">{scan.id}</span> · {scan.page.finalUrl}
                  </>
                ) : (
                  "No stored scan is available yet."
                )}
              </p>
            </div>
            {scan ? <Severity value={scan.status} /> : null}
          </PanelHeader>

          <PanelBody className="flex min-h-0 flex-1 flex-col">
            <div ref={logRef} className="scroll-thin flex max-h-[26rem] min-h-[14rem] flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <div className="panel-flat flex items-start gap-3 rounded-2xl px-4 py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-400/25">
                  <Bot className="size-4 text-violet-300" aria-hidden="true" />
                </span>
                <div className="min-w-0 text-sm leading-relaxed text-slate-300">
                  <p className="text-slate-100">
                    {scan
                      ? findings.length
                        ? `This scan recorded ${findings.length} failing rule(s). Ask me about one and I will explain what it means, why it matters and how to fix it.`
                        : "This scan recorded no failing rules, so there is no finding to explain. That is not a claim of WCAG compliance."
                      : "There is no stored scan yet. Run a scan and open the assistant again."}
                  </p>
                  {findings.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {findings.map((rule) => (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => askFinding(rule.id)}
                          className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] text-sky-200 transition-colors hover:border-sky-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          {rule.id}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex items-start justify-end gap-3">
                      <p className="max-w-[80%] rounded-2xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 px-4 py-2.5 text-sm text-sky-50 ring-1 ring-sky-400/20">
                        {message.text}
                      </p>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-400/25">
                        <User className="size-4 text-sky-300" aria-hidden="true" />
                      </span>
                    </div>
                  );
                }
                if (message.role === "assistant") {
                  return (
                    <div key={message.id} className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-400/25">
                        <Bot className="size-4 text-violet-300" aria-hidden="true" />
                      </span>
                      <p className="max-w-[85%] text-sm leading-relaxed text-slate-300">{message.text}</p>
                    </div>
                  );
                }
                const data = message.data;
                return (
                  <div key={message.id} className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-400/25">
                      <Sparkles className="size-4 text-violet-300" aria-hidden="true" />
                    </span>
                    <div className="panel-flat min-w-0 flex-1 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-sky-300">{data.ruleId}</span>
                        <Severity value={data.impact} />
                      </div>
                      <div className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-slate-300">
                        <p><span className="font-medium text-sky-200">What is the problem? </span>{data.what}</p>
                        <p><span className="font-medium text-sky-200">Why does it matter? </span>{data.why}</p>
                        <p><span className="font-medium text-sky-200">Who is affected? </span>{data.who}</p>
                        <div>
                          <span className="font-medium text-sky-200">What needs to be done?</span>
                          <ol className="mt-1 list-decimal space-y-1 pl-5">
                            {data.steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                        <p><span className="font-medium text-sky-200">Example fix: </span><code className="break-all font-mono text-xs">{data.example}</code></p>
                        <p><span className="font-medium text-sky-200">Where to apply: </span>{data.where}</p>
                        <p><span className="font-medium text-sky-200">How to verify: </span>{data.verify}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Evidence: {data.findingId} read from the stored scan record.
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild variant="ghostNeon" size="sm">
                          <Link to="/accessibility/$scanId" params={{ scanId: scan?.id ?? "" }}>
                            Open the finding
                          </Link>
                        </Button>
                        <Button asChild variant="ghostNeon" size="sm">
                          <Link to="/recommendations">See recommended fix</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {explain.isPending ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
                  <LoaderCircle className="size-4 animate-spin text-sky-300" aria-hidden="true" />
                  Reading the stored finding…
                </div>
              ) : null}
            </div>

            <form
              className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
            >
              <label htmlFor="assistant-input" className="sr-only">
                Ask about a stored finding
              </label>
              <Input
                id="assistant-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={findings.length ? `Ask about ${findings[0].id}…` : "No stored findings to explain"}
                disabled={findings.length === 0}
                autoComplete="off"
                className="bg-navy-950/70"
              />
              <Button type="submit" variant="primary" disabled={explain.isPending || !input.trim() || findings.length === 0}>
                {explain.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                Send
              </Button>
            </form>
            <p className="mt-2.5 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Explanations are produced by a deterministic, evidence-grounded explainer that reads the stored findings.
              It cannot describe an issue that was not detected, and it is not an external AI service call.
            </p>
          </PanelBody>
        </Panel>

        {/* Context */}
        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader>
              <PanelTitle icon={<Sparkles className="size-4 text-cyan-300" aria-hidden="true" />}>Scan context</PanelTitle>
            </PanelHeader>
            <PanelBody>
              {scans.length > 0 ? (
                <>
                  <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    Stored scan
                    <select
                      value={scan?.id ?? ""}
                      onChange={(e) => switchScan.mutate(e.target.value)}
                      disabled={switchScan.isPending}
                      className="rounded-xl border border-border bg-navy-950/70 px-3 py-2.5 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      {scans.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.hostname || s.url} — {s.summary.ruleCount} rules
                        </option>
                      ))}
                    </select>
                  </label>
                  {scan ? (
                    <dl className="mt-4 flex flex-col gap-2 text-xs">
                      <div className="flex justify-between gap-3 border-b border-sky-400/10 pb-2">
                        <dt className="text-muted-foreground">Failing rules</dt>
                        <dd className="font-mono text-critical">{scan.summary.ruleCount}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-b border-sky-400/10 pb-2">
                        <dt className="text-muted-foreground">Failing elements</dt>
                        <dd className="font-mono">{scan.summary.elementCount}</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-b border-sky-400/10 pb-2">
                        <dt className="text-muted-foreground">Undecided rules</dt>
                        <dd className="font-mono text-high">{scan.summary.incompleteCount}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Engine</dt>
                        <dd className="font-mono text-slate-300">{scan.engine}</dd>
                      </div>
                    </dl>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="No scan stored yet"
                  body="Run a scan first — the assistant needs a stored scan to ground its explanations."
                  action={
                    <Button asChild variant="primary" size="sm">
                      <Link to="/accessibility">Run a scan</Link>
                    </Button>
                  }
                />
              )}
              {switchScan.isError ? (
                <ErrorState className="mt-4" title="Could not load that scan" body="Choose another stored scan or reload the page." />
              ) : null}
            </PanelBody>
          </Panel>

          <Panel className="border-sky-400/15 bg-sky-500/5">
            <PanelBody className="pt-5">
              <h2 className="text-sm font-semibold text-sky-100">Advice versus evidence</h2>
              <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
                <li><span className="text-slate-200">Evidence</span> — the rule identifier, impact, selector and HTML the scan actually stored.</li>
                <li><span className="text-slate-200">Advice</span> — the general remediation steps for that rule. Verify each fix with a re-scan.</li>
                <li>Manual testing with a keyboard and a screen reader is still required for the criteria automation cannot judge.</li>
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
