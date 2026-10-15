import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Info, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, StatTile } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { TableWrap, Td, Th } from "@/components/ui/table";
import { listSecurityChecksFn, runSecurityChecksFn } from "@/lib/security/api";
import type { SecurityCheckRun } from "@/lib/security/checks";

export const Route = createFileRoute("/security/")({
  component: SecurityPage,
});

function validateUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter the website URL you are authorized to check.";
  if (/\s/.test(value)) return "A URL cannot contain spaces.";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Enter a full URL including the scheme, for example https://example.org.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "Only http and https addresses can be checked.";
  if (!parsed.hostname.includes(".")) return "Enter a public domain, for example example.org.";
  return null;
}

function SecurityPage() {
  const [url, setUrl] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const run = useMutation<SecurityCheckRun, unknown, string, unknown>({
    mutationFn: (target: string) => runSecurityChecksFn({ data: { url: target } }),
    // A saved run must show up in the sibling history panel immediately; the
    // query is cached, so without this the list still reads "none saved yet".
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["security-checks"] });
    },
  });

  const history = useQuery({
    queryKey: ["security-checks"],
    queryFn: () => listSecurityChecksFn(),
  });

  const outcome = run.data;
  const counts = outcome
    ? {
        pass: outcome.results.filter((r) => r.status === "pass").length,
        fail: outcome.results.filter((r) => r.status === "fail").length,
        notVerified: outcome.results.filter((r) => r.status === "not-verified").length,
        skipped: outcome.results.filter((r) => r.status === "skipped").length,
        error: outcome.results.filter((r) => r.status === "error").length,
      }
    : null;

  function submit() {
    const error = validateUrl(url);
    setFieldError(error);
    if (!error) setConfirmOpen(true);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configuration observations"
        title="Website Security Checks"
        description="Low-impact checks of what an ordinary request already returns: HTTPS availability, the HTTP→HTTPS redirect, TLS certificate evidence, security headers and cookie attributes. Nothing is exploited and no site is modified."
        actions={
          <Button asChild variant="ghostNeon">
            <Link to="/accessibility">Accessibility scanner</Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <Panel glow>
            <PanelHeader>
              <div>
                <PanelTitle icon={<ShieldCheck className="size-4 text-sky-300" aria-hidden="true" />}>
                  Run security checks
                </PanelTitle>
                <p className="mt-1 text-xs text-muted-foreground">Run only against targets you are authorized to check.</p>
              </div>
            </PanelHeader>
            <PanelBody>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                noValidate
              >
                <Label htmlFor="security-url">Website URL</Label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Input
                      id="security-url"
                      placeholder="https://example.org"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (fieldError) setFieldError(null);
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? "security-url-error" : undefined}
                      className="bg-navy-950/70"
                    />
                    {fieldError ? (
                      <p id="security-url-error" role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-rose-300">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {fieldError}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="shrink-0"
                    disabled={run.isPending || url.trim().length === 0}
                  >
                    {run.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="size-4" aria-hidden="true" />
                    )}
                    {run.isPending ? "Running checks…" : "Run checks"}
                  </Button>
                </div>
              </form>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                A refused target, a private address or an unavailable response is recorded as an error or as
                “not verified” — never as a passing check.
              </p>
            </PanelBody>
          </Panel>

          {run.isPending ? (
            <Panel aria-live="polite">
              <PanelBody className="flex items-center gap-3 py-6">
                <LoaderCircle className="size-5 animate-spin text-sky-300" aria-hidden="true" />
                <p className="text-sm text-slate-200">
                  Requesting {url.trim()} and reading the response headers, redirects and certificate…
                </p>
              </PanelBody>
            </Panel>
          ) : null}

          {run.isError ? (
            <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                <AlertTriangle className="size-4" aria-hidden="true" />
                Security check refused or unavailable
              </h2>
              <p className="mt-1.5 text-sm text-rose-100/90">
                {run.error instanceof Error ? run.error.message : "The security checks could not be completed."}
              </p>
              <p className="mt-2 text-xs text-rose-100/70">
                A refused target, private address or timeout is recorded as a failure, not as a passing security check.
              </p>
            </div>
          ) : null}

          {outcome && counts ? (
            <Panel aria-live="polite">
              <PanelHeader>
                <div className="min-w-0">
                  <PanelTitle icon={<ShieldCheck className="size-4 text-cyan-300" aria-hidden="true" />}>
                    Results for {outcome.targetUrl}
                  </PanelTitle>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    Check ID {outcome.id ?? "not persisted"} · observed {outcome.completedAt}
                  </p>
                </div>
                <Button asChild variant="ghostNeon" size="sm">
                  {outcome.id ? (
                    <Link to="/security/$id" params={{ id: outcome.id }}>
                      Open saved check
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link to="/security">Recent checks</Link>
                  )}
                </Button>
              </PanelHeader>
              <PanelBody>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Passed" value={counts.pass} tone="low" />
                  <StatTile label="Failed" value={counts.fail} tone={counts.fail > 0 ? "critical" : "default"} />
                  <StatTile label="Not verified" value={counts.notVerified} tone="high" />
                  <StatTile label="Skipped / error" value={counts.skipped + counts.error} />
                </div>

                <div className="mt-5">
                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>Check</Th>
                        <Th>Expected</Th>
                        <Th>Observed</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {outcome.results.map((result) => (
                        <tr key={result.id}>
                          <Td className="max-w-[12rem]">
                            <span className="text-slate-200">{result.description}</span>
                            <div className="mt-0.5 font-mono text-[10px] text-slate-500">{result.id}</div>
                          </Td>
                          <Td className="max-w-[14rem] text-xs text-muted-foreground">{result.expected}</Td>
                          <Td className="max-w-[18rem] break-words font-mono text-[11px] text-sky-200">{result.observed}</Td>
                          <Td><Severity value={result.status} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>

                {outcome.limitations.length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {outcome.limitations.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </PanelBody>
            </Panel>
          ) : null}

          <Panel className="border-sky-400/15 bg-sky-500/5">
            <PanelBody className="pt-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-100">
                <Info className="size-4" aria-hidden="true" />
                What these checks observe
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>HTTPS availability and HTTP-to-HTTPS redirect behaviour</li>
                <li>TLS certificate evidence where a handshake can be observed</li>
                <li>Security headers: HSTS, X-Content-Type-Options, Referrer-Policy, Content-Security-Policy</li>
                <li>Cookie attributes on the initial Set-Cookie response</li>
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                A passing check means the condition was observed in this response. It is not a statement that the site is
                secure.
              </p>
            </PanelBody>
          </Panel>
        </div>

        {/* Recent checks */}
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle icon={<ShieldCheck className="size-4 text-violet-300" aria-hidden="true" />}>
                Recent checks
              </PanelTitle>
              <p className="mt-1 text-xs text-muted-foreground">Saved runs from this server session.</p>
            </div>
            {history.isFetching ? <LoaderCircle className="size-4 animate-spin text-sky-300" aria-hidden="true" /> : null}
          </PanelHeader>
          <PanelBody>
            {history.isPending ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            ) : history.data && history.data.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {history.data.map((row) => (
                  <Link
                    key={row.id}
                    to="/security/$id"
                    params={{ id: row.id }}
                    className="panel-flat rounded-xl p-3.5 transition-colors hover:border-sky-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-sky-300">{row.hostname || row.targetUrl}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">{row.id}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      pass {row.statusCounts.pass} · fail {row.statusCounts.fail} · not verified {row.statusCounts.not_verified}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No saved checks yet"
                body="Run a check and it will be stored here with the observed values."
                icon={<ShieldCheck className="size-5" aria-hidden="true" />}
              />
            )}
          </PanelBody>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Run security checks?"
        description={
          <>
            <p className="break-all">
              CyberSense will make an ordinary request to{" "}
              <span className="font-mono text-sky-200">{url.trim()}</span> and record the response headers, redirect
              behaviour and certificate evidence.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Only check hosts you own or are authorized to test. No payloads are sent and nothing is modified.
            </p>
          </>
        }
        confirmLabel="Run checks"
        onConfirm={() => {
          setConfirmOpen(false);
          run.mutate(url.trim());
        }}
      />
    </AppShell>
  );
}
