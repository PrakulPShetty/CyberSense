import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { runSecurityChecksFn, listSecurityChecksFn } from "@/lib/security/api";
import type { SecurityCheckRun } from "@/lib/security/checks";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
});

const STATUS_STYLES: Record<string, string> = {
  pass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  fail: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  "not-verified": "border-amber-400/30 bg-amber-500/10 text-amber-300",
  skipped: "border-slate-400/30 bg-slate-500/10 text-slate-300",
  error: "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

function SecurityPage() {
  const [url, setUrl] = useState("");
  const run = useMutation<SecurityCheckRun, unknown, string, unknown>({
    mutationFn: (target: string) => runSecurityChecksFn({ data: { url: target } }),
  });

  const history = useQuery({
    queryKey: ["security-checks"],
    queryFn: () => listSecurityChecksFn(),
  });

  const outcome = run.data;

  return (
    <div className="min-h-dvh bg-navy-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 ring-1 ring-sky-400/30">
              <ShieldCheck className="size-5 text-sky-300" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Website security checks</h1>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Low-impact configuration checks for authorized targets</p>
            </div>
          </div>
          <Link to="/" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-sky-300">
            Back to home
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-6">
            <div className="card-neon rounded-2xl p-6">
              <h2 className="text-base font-semibold tracking-tight">Run website security checks</h2>
              <div className="mt-4">
                <Label htmlFor="security-url">Website URL</Label>
                <Input
                  id="security-url"
                  placeholder="https://example.org"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-1.5"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="mt-4">
                <Button variant="primary" onClick={() => run.mutate(url)} disabled={run.isPending || url.trim().length === 0}>
                  {run.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                  {run.isPending ? "Running checks..." : "Run checks"}
                </Button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                These checks observe headers, redirect behavior, TLS evidence, and response cookies. They do not exploit the
                target and do not prove that a site is secure.
              </p>
            </div>

            {outcome && (
              <div className="card-neon rounded-2xl p-6">
                <h2 className="text-base font-semibold tracking-tight">Results for {outcome.targetUrl}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">Saved check ID: {outcome.id ?? "not persisted"}</p>
                <p className="text-xs text-muted-foreground">Observed {outcome.completedAt}</p>
                <div className="mt-4 flex flex-col gap-3">
                  {outcome.results.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border/60 bg-navy-900/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-100">{r.description}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${STATUS_STYLES[r.status] ?? STATUS_STYLES.error}`}>
                          {r.status.replace("-", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Expected: {r.expected}</p>
                      <p className="mt-1 break-all font-mono text-xs text-sky-200">Observed: {r.observed}</p>
                      {r.severityRationale && <p className="mt-2 text-xs text-muted-foreground">{r.severityRationale}</p>}
                      {r.limitation && <p className="mt-1 text-xs text-muted-foreground">Limitation: {r.limitation}</p>}
                    </div>
                  ))}
                  <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                    {outcome.limitations.map((l) => <p key={l}>{l}</p>)}
                  </div>
                </div>
              </div>
            )}

            {run.isError && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-5">
                <h2 className="text-sm font-semibold text-rose-300">Security check refused or unavailable</h2>
                <p className="mt-1.5 text-sm text-rose-200/90">
                  {run.error instanceof Error ? run.error.message : "The security checks could not be completed."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  A refused target, private address, or unavailable response is recorded as an error, not as a passing security check.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="card-neon rounded-2xl p-6">
              <h2 className="text-base font-semibold tracking-tight">Recent security checks</h2>
              <div className="mt-4 flex flex-col gap-2">
                {history.data?.map((row) => (
                  <Link
                    key={row.id}
                    to="/security/$id"
                    params={{ id: row.id }}
                    className="rounded-xl border border-border/60 bg-navy-900/60 p-4 transition-colors hover:border-sky-400/40"
                  >
                    <div className="truncate text-sm text-sky-300">{row.targetUrl}</div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {row.completedAt} · pass {row.statusCounts.pass}, fail {row.statusCounts.fail}, not verified{" "}
                      {row.statusCounts.not_verified}, skipped {row.statusCounts.skipped}, error {row.statusCounts.error}
                    </div>
                  </Link>
                ))}
                {!history.isPending && history.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No security checks have been saved yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-sky-400/15 bg-sky-500/5 p-5">
              <h2 className="text-sm font-semibold text-sky-200">What these checks observe</h2>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>HTTPS availability and HTTP-to-HTTPS redirect behavior</li>
                <li>TLS certificate evidence where a handshake can be observed</li>
                <li>Security headers: HSTS, X-Content-Type-Options, Referrer-Policy, CSP</li>
                <li>Cookie Secure attribute on the initial Set-Cookie response</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
