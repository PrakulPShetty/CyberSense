import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  Info,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/cybersense/app-shell";
import { Severity } from "@/components/sentinel/severity";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Label } from "@/components/ui/input";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, StatTile } from "@/components/ui/panel";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { compareA11yScansFn, listA11yScansFn, runA11yScanFn } from "@/lib/a11y/api";

export const Route = createFileRoute("/accessibility/")({
  loader: async () => ({ scans: await listA11yScansFn() }),
  component: AccessibilityPage,
});

/** UTC formatting only — a locale-dependent date would differ between server and client. */
function stamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return `${new Date(parsed).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

/** Light client-side gate. The server remains the authority on URL validation. */
function validateUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter the page URL you want to scan.";
  if (/\s/.test(value)) return "A URL cannot contain spaces.";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Enter a full URL including the scheme, for example https://example.org/page.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http and https addresses can be scanned.";
  }
  if (!parsed.hostname.includes(".")) return "Enter a public domain, for example example.org.";
  return null;
}

function AccessibilityPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const scan = useMutation({
    mutationFn: (target: string) => runA11yScanFn({ data: { url: target } }),
    // A completed scan is persisted server-side, so the sibling lists on this route
    // (history, compare selects) must be re-read — loader data is otherwise frozen
    // at the moment of navigation and the new scan would appear to be missing.
    onSuccess: (outcome) => {
      if (outcome.ok) void router.invalidate();
    },
  });

  const outcome = scan.data;
  const history = initial.scans;
  const [baseId, setBaseId] = useState("");
  const [laterId, setLaterId] = useState("");
  const compare = useMutation({
    mutationFn: () => compareA11yScansFn({ data: { baseId, laterId } }),
  });

  function requestScan() {
    const error = validateUrl(url);
    setFieldError(error);
    if (error) return;
    setConfirmOpen(true);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Track D · automated page scan"
        title="New Scan"
        description="A real browser loads the page you name and axe-core runs its accessibility rules against the rendered DOM. Every rule, impact, selector and snippet in the result comes back from that engine — nothing is prewritten."
        actions={
          <Button asChild variant="ghostNeon">
            <Link to="/security">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Security checks
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* Scan form */}
          <Panel glow>
            <PanelHeader>
              <div>
                <PanelTitle icon={<ScanSearch className="size-4 text-sky-300" aria-hidden="true" />}>Scan a page</PanelTitle>
                <p className="mt-1 text-xs text-muted-foreground">Public http/https addresses only.</p>
              </div>
            </PanelHeader>
            <PanelBody>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestScan();
                }}
                noValidate
              >
                <Label htmlFor="a11y-url">Page URL</Label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Input
                      id="a11y-url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (fieldError) setFieldError(null);
                      }}
                      placeholder="https://example.org/page"
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? "a11y-url-error" : "a11y-url-help"}
                      className="bg-navy-950/70"
                    />
                    {fieldError ? (
                      <p id="a11y-url-error" role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-rose-300">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {fieldError}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="shrink-0"
                    disabled={scan.isPending || url.trim().length === 0}
                  >
                    {scan.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ScanSearch className="size-4" aria-hidden="true" />
                    )}
                    {scan.isPending ? "Scanning…" : "Run accessibility scan"}
                  </Button>
                </div>
                <p id="a11y-url-help" className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Private, loopback and link-local targets are refused, the scan will not follow a redirect onto another
                  host, and every request is subject to a 20 s navigation and 45 s overall budget. To scan the bundled
                  controlled fixture (a page with deliberate defects), start the app with{" "}
                  <span className="font-mono">npm run dev:a11y-demo</span>.
                </p>
              </form>
            </PanelBody>
          </Panel>

          {/* Scanning state */}
          {scan.isPending ? (
            <Panel aria-live="polite">
              <PanelBody className="py-6">
                <div className="flex items-center gap-3">
                  <span className="relative flex size-10 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-400/25">
                    <LoaderCircle className="size-5 animate-spin text-sky-300" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Scanning {url.trim()}…</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The page is being rendered in a real browser and axe-core is running its rules against the DOM.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {/* Refused / failed */}
          {outcome && !outcome.ok ? (
            <ErrorState
              title={`Scan refused or failed (${outcome.error_code})`}
              body={
                <>
                  {outcome.message}
                  <p className="mt-2 text-xs text-rose-100/70">
                    A refused target, an unavailable browser or a failed navigation is recorded as a failure and is never
                    displayed as a page that passed.
                  </p>
                </>
              }
            />
          ) : null}

          {/* Completed */}
          {outcome?.ok ? (
            <Panel aria-live="polite">
              <PanelHeader>
                <div className="min-w-0">
                  <PanelTitle icon={<CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />}>
                    {outcome.scan.page.title || outcome.scan.hostname}
                  </PanelTitle>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{outcome.scan.page.finalUrl}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Severity value={outcome.scan.status} />
                  <span className="font-mono text-[11px] text-muted-foreground">{outcome.scan.id}</span>
                </div>
              </PanelHeader>
              <PanelBody>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Failing rules" value={outcome.scan.summary.ruleCount} tone={outcome.scan.summary.ruleCount > 0 ? "critical" : "default"} />
                  <StatTile label="Failing elements" value={outcome.scan.summary.elementCount} />
                  <StatTile label="Rules passed" value={outcome.scan.summary.passCount} tone="low" />
                  <StatTile label="Undecided rules" value={outcome.scan.summary.incompleteCount} tone="high" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {(["critical", "serious", "moderate", "minor", "unknown"] as const)
                    .filter((k) => outcome.scan.summary.byImpact[k] > 0)
                    .map((k) => (
                      <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Severity value={k} />
                        {outcome.scan.summary.byImpact[k]} rule(s)
                      </span>
                    ))}
                  <span className="text-xs text-muted-foreground">Engine: {outcome.scan.engine}</span>
                </div>

                {outcome.scan.summary.ruleCount === 0 ? (
                  <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-100">
                    No rule in this tag set failed on this page, at this viewport, in this state. That is not a claim of
                    WCAG compliance — see the limitations on the findings page.
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Button asChild variant="primary" size="sm">
                    <Link to="/accessibility/$scanId" params={{ scanId: outcome.scan.id }}>
                      Open full findings
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="ghostNeon" size="sm">
                    <Link to="/reports">Download PDF report</Link>
                  </Button>
                  <Button asChild variant="ghostNeon" size="sm">
                    <Link to="/recommendations">See fix recommendations</Link>
                  </Button>
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {/* What scanning does not prove */}
          <Panel className="border-sky-400/15 bg-sky-500/5">
            <PanelBody className="pt-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-100">
                <Info className="size-4" aria-hidden="true" />
                What an automated scan does not prove
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
                <li>Automated rules detect only a subset of WCAG success criteria; a clean scan is not WCAG compliance.</li>
                <li>The page is loaded once, at one viewport, in its initial state — menus, modals and interactive states are not exercised.</li>
                <li>Authenticated pages and content behind user input are never reached.</li>
                <li>Some problems — cognitive load, reading order quality, meaningful alt text — require manual testing.</li>
              </ul>
            </PanelBody>
          </Panel>
        </div>

        {/* Right column: history + comparison */}
        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader>
              <PanelTitle icon={<History className="size-4 text-sky-300" aria-hidden="true" />}>Scan history</PanelTitle>
              <Button asChild variant="ghostNeon" size="sm">
                <Link to="/history">View all</Link>
              </Button>
            </PanelHeader>
            <PanelBody>
              {history.length > 0 ? (
                <div className="flex max-h-[24rem] flex-col gap-1.5 overflow-y-auto pr-1 scroll-thin">
                  {history.map((row) => (
                    <Link
                      key={row.id}
                      to="/accessibility/$scanId"
                      params={{ scanId: row.id }}
                      className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sky-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-200 group-hover:text-sky-100">
                          {row.hostname || row.url}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{stamp(row.scannedAt)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Severity value={row.status} />
                        <span className="font-mono text-xs tabular text-muted-foreground">{row.summary.ruleCount}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No scans recorded yet"
                  body="Run a scan above and it will be saved here with its full evidence."
                  icon={<Accessibility className="size-5" aria-hidden="true" />}
                />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle icon={<Accessibility className="size-4 text-violet-300" aria-hidden="true" />}>
                Historical comparison
              </PanelTitle>
            </PanelHeader>
            <PanelBody>
              <SectionHeading
                title="Compare two stored scans"
                description="Only scans of the same host are comparable."
                className="flex-col items-start gap-1"
              />
              <div className="mt-4 flex flex-col gap-2.5">
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Base scan
                  <select
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                    className="rounded-xl border border-border bg-navy-950/70 px-3 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <option value="">Select a base scan…</option>
                    {history.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.hostname || s.url} — {stamp(s.scannedAt)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Later scan
                  <select
                    value={laterId}
                    onChange={(e) => setLaterId(e.target.value)}
                    className="rounded-xl border border-border bg-navy-950/70 px-3 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <option value="">Select a later scan…</option>
                    {history.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.hostname || s.url} — {stamp(s.scannedAt)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  onClick={() => compare.mutate()}
                  disabled={!baseId || !laterId || compare.isPending}
                >
                  {compare.isPending ? "Comparing…" : "Compare"}
                </Button>
              </div>
              {compare.data ? (
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <p className="text-slate-300">Comparable: {String(compare.data.comparable)}</p>
                  <p>New findings: {compare.data.newRules.join(", ") || "none"}</p>
                  <p>Resolved findings: {compare.data.resolvedRules.join(", ") || "none"}</p>
                  <p>Persistent findings: {compare.data.persistentRules.join(", ") || "none"}</p>
                  <p>Changed findings: {compare.data.changedRules.join(", ") || "none"}</p>
                </div>
              ) : (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Select two scans of the same host to see which findings are new, resolved or persistent.
                </p>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle icon={<ScanSearch className="size-4 text-cyan-300" aria-hidden="true" />}>Controlled fixture</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The bundled fixture page contains deliberate accessibility defects so the scanner can be demonstrated
                against known findings.
              </p>
              <Button asChild variant="ghostNeon" size="sm" className="mt-3">
                <Link to="/a11y-demo">View the fixture page</Link>
              </Button>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Run accessibility scan?"
        description={
          <>
            <p className="break-all">
              CyberSense will load <span className="font-mono text-sky-200">{url.trim()}</span> in a real browser and run
              axe-core against the rendered page.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Only run scans against sites you own or are authorized to test. The page is loaded once, at one viewport,
              and never modified.
            </p>
          </>
        }
        confirmLabel="Run scan"
        onConfirm={() => {
          setConfirmOpen(false);
          scan.mutate(url.trim());
        }}
      />
    </AppShell>
  );
}
