import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  ArrowRight,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Code2,
  FileText,
  GaugeCircle,
  History,
  Lock,
  Radar,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { AppNav } from "@/components/cybersense/app-nav";
import { HeroVisual } from "@/components/cybersense/hero-globe";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/page-header";
import { Severity } from "@/components/sentinel/severity";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const HERO_CAPABILITIES = [
  { icon: Accessibility, label: "Accessibility scanning" },
  { icon: ShieldCheck, label: "Security checks" },
  { icon: Sparkles, label: "Grounded explanations" },
  { icon: FileText, label: "PDF reports" },
] as const;

const FEATURES = [
  {
    icon: Accessibility,
    title: "Accessibility scanning",
    body:
      "A real browser loads the page and axe-core runs against the rendered DOM. Every rule, impact, selector and HTML snippet shown comes back from that engine.",
    tone: "text-cyan-300 ring-cyan-400/25 bg-cyan-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Security checks",
    body:
      "Low-impact observations of HTTPS availability, the HTTP→HTTPS redirect, TLS certificate evidence, security headers and cookie attributes — never exploitation.",
    tone: "text-sky-300 ring-sky-400/25 bg-sky-500/10",
  },
  {
    icon: BrainCircuit,
    title: "Explainable insights",
    body:
      "Each finding is explained in plain language: what the problem is, why it matters, who it affects, and how to verify a fix — grounded in the stored evidence.",
    tone: "text-violet-300 ring-violet-400/25 bg-violet-500/10",
  },
  {
    icon: SlidersHorizontal,
    title: "Actionable recommendations",
    body:
      "Advisory remediation steps derived from your saved findings, with the reference link for the rule. CyberSense never modifies your site.",
    tone: "text-indigo-300 ring-indigo-400/25 bg-indigo-500/10",
  },
  {
    icon: History,
    title: "Scan history & comparison",
    body:
      "Every scan is stored with its evidence, so you can compare two scans of the same host and see which findings are new, persistent or resolved.",
    tone: "text-sky-300 ring-sky-400/25 bg-sky-500/10",
  },
  {
    icon: FileText,
    title: "Detailed PDF reports",
    body:
      "A branded report with the executive summary, severity totals, findings with evidence, remediation guidance and the scan's own limitations.",
    tone: "text-cyan-300 ring-cyan-400/25 bg-cyan-500/10",
  },
] as const;

const STEPS = [
  { n: "01", title: "Enter a website URL", body: "Provide a public http/https address you are authorized to scan." },
  { n: "02", title: "Run the scan", body: "The page is rendered in a real browser; axe-core checks the rendered DOM." },
  { n: "03", title: "Review the findings", body: "Inspect rule identifiers, impact, affected selectors and evidence." },
  { n: "04", title: "Understand and fix", body: "Read the plain-language explanation and the advisory remediation steps." },
  { n: "05", title: "Report and improve", body: "Download a PDF report, then re-scan to confirm what changed." },
] as const;

const BENEFICIARIES = [
  {
    icon: Code2,
    title: "Developers",
    body: "Catch accessibility regressions and weak security configuration during development, with the exact selector and rule that failed.",
  },
  {
    icon: Building2,
    title: "Businesses",
    body: "Understand exposure with evidence-backed observations instead of marketing claims, and prioritise the fixes that matter most.",
  },
  {
    icon: Users,
    title: "Organizations",
    body: "Track accessibility posture over time across saved scans and produce reports stakeholders can act on.",
  },
  {
    icon: Accessibility,
    title: "People using the web",
    body: "A more accessible and better-configured web benefits every visitor, including people using assistive technology.",
  },
] as const;

const UNIQUE = [
  {
    icon: GaugeCircle,
    title: "Findings carry their evidence",
    body: "Selectors, HTML snippets, observed header values and rule identifiers are stored with the finding — not summarised away.",
  },
  {
    icon: ShieldCheck,
    title: "Observed, never exploited",
    body: "Security checks only look at what a normal request already returns. Nothing is fuzzed, injected or brute-forced.",
  },
  {
    icon: Lock,
    title: "Guarded against misuse",
    body: "URL validation, private-address and metadata-address blocking, redirect restriction, timeouts and resource limits on every scan.",
  },
  {
    icon: CheckCircle2,
    title: "Limitations stated on screen",
    body: "Automated rules cover a subset of WCAG. The product says so on the results page, in the report, and in the stored record.",
  },
] as const;

function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-navy-950 text-slate-100">
      <AppNav />

      {/* ---------------- Hero ---------------- */}
      <section className="hero-aurora relative overflow-hidden">
        <div className="dot-grid grid-mask absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-medium tracking-wide text-sky-300">
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI-Powered Web Accessibility &amp; Security Scanner
            </p>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              A More <span className="text-gradient">Accessible</span> and{" "}
              <span className="text-gradient">Secure</span> Web for Everyone
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              CyberSense renders your page in a real browser, reports the accessibility rules it actually fails, and
              checks supported website security configuration — then explains every finding in plain language so you can
              fix what matters with confidence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Button asChild variant="primary" size="lg">
                <Link to="/accessibility">
                  <ScanSearch className="size-4" aria-hidden="true" />
                  Start Scanning
                </Link>
              </Button>
              <Button asChild variant="ghostNeon" size="lg">
                <Link to="/dashboard">
                  Explore CyberSense
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-sky-400/10 pt-7">
              {HERO_CAPABILITIES.map((cap) => (
                <li key={cap.label} className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/20">
                    <cap.icon className="size-3.5" aria-hidden="true" />
                  </span>
                  {cap.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <HeroVisual />
          </div>
        </div>
        <div className="divider-neon relative mx-auto max-w-7xl" aria-hidden="true" />
      </section>

      {/* ---------------- About ---------------- */}
      <section id="about" className="relative scroll-mt-24 overflow-hidden py-20 lg:py-28">
        <div className="aurora-soft absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <p className="eyebrow">About CyberSense</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Purpose-built to find what actually breaks
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-400">
              <p>
                Accessibility barriers and weak security configuration are two of the most common — and most fixable —
                reasons people are excluded from, or put at risk on, a website.
              </p>
              <p>
                CyberSense gives developers, businesses and organizations honest answers: what was observed, where, and
                what to do about it. Accessibility findings come from a real browser run; security checks report only
                what a normal request already returns.
              </p>
              <p>
                Nothing is invented. If a scan cannot reach the page, or a check could not be verified, the product says
                so instead of showing a reassuring number.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link to="/accessibility">Start with a scan</Link>
              </Button>
              <Button asChild variant="ghostNeon">
                <Link to="/security">See security checks</Link>
              </Button>
            </div>
          </div>

          {/* Interface illustration — example rule identifiers, not a real scan */}
          <Panel className="relative overflow-hidden p-0" glow>
            <div className="flex items-center justify-between gap-3 border-b border-sky-400/10 px-5 py-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Radar className="size-4 text-sky-300" aria-hidden="true" />
                Findings preview
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">illustration</span>
            </div>
            <div className="space-y-3 px-5 py-5">
              {[
                { id: "image-alt", impact: "critical", help: "Images must have alternative text" },
                { id: "color-contrast", impact: "serious", help: "Elements must meet minimum colour contrast" },
                { id: "label", impact: "moderate", help: "Form elements must have labels" },
              ].map((row) => (
                <div key={row.id} className="panel-flat rounded-xl px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-sky-300">{row.id}</span>
                    <Severity value={row.impact} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{row.help}</p>
                  <div className="mt-2 rounded-lg border border-sky-400/10 bg-navy-950/60 px-2.5 py-2 font-mono text-[10px] text-slate-400">
                    evidence: selector + HTML snippet stored with the finding
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-slate-500">
                Example rule identifiers and impact values from the axe-core rule set. The panel shows the layout of a real
                findings record; no scan result is implied.
              </p>
            </div>
          </Panel>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="relative scroll-mt-24 border-y border-sky-400/10 bg-navy-900/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            title="Everything you need to find, understand and fix issues"
            description="Six capabilities that work together, from the first scan to the verified fix."
            className="flex-col items-start gap-0"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Panel key={feature.title} interactive glow className="h-full p-6">
                <span className={`inline-flex size-11 items-center justify-center rounded-xl ring-1 ${feature.tone}`}>
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-semibold tracking-tight text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.body}</p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how-it-works" className="relative scroll-mt-24 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            title="From URL to verified fix in five steps"
            description="A single workflow: scan, understand, act, and prove the improvement with a re-scan."
            className="flex-col items-start gap-0"
          />

          <ol className="relative mt-12 grid gap-5 md:grid-cols-3 lg:grid-cols-5">
            {/* progression line */}
            <span
              className="absolute left-0 right-0 top-[2.1rem] hidden h-px bg-gradient-to-r from-sky-400/10 via-sky-400/40 to-violet-400/30 lg:block"
              aria-hidden="true"
            />
            {STEPS.map((step) => (
              <li key={step.n} className="panel relative rounded-2xl p-5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-navy-950/80 font-mono text-xs text-sky-300 ring-1 ring-sky-400/25">
                  {step.n}
                </span>
                <h3 className="mt-4 text-sm font-semibold tracking-tight text-slate-100">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Who benefits ---------------- */}
      <section className="relative border-y border-sky-400/10 bg-navy-900/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            title="Built for the people who build the web — and everyone who uses it"
            description="The same evidence is useful whether you are shipping code, running a business, or reading a page."
            className="flex-col items-start gap-0"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIARIES.map((item) => (
              <Panel key={item.title} interactive className="h-full p-6">
                <item.icon className="size-6 text-sky-300" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Unique ---------------- */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            title="Honest evidence, not scores without proof"
            description="What makes CyberSense different is what it refuses to claim."
            className="flex-col items-start gap-0"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {UNIQUE.map((item) => (
              <Panel key={item.title} className="flex gap-4 p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/25">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-slate-100">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="relative overflow-hidden border-t border-sky-400/10 py-20 lg:py-24">
        <div className="hero-aurora absolute inset-0" aria-hidden="true" />
        <div className="dot-grid grid-mask absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="eyebrow">Get started</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Scan Your Website <span className="text-gradient">Today</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400">
            Run your first scan in seconds. No installation on your target, no code changes — just evidence you can act
            on, with a report you can share.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Button asChild variant="primary" size="lg">
              <Link to="/accessibility">
                <ScanSearch className="size-4" aria-hidden="true" />
                Start Scanning
              </Link>
            </Button>
            <Button asChild variant="ghostNeon" size="lg">
              <Link to="/dashboard">View Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-sky-400/10 bg-navy-950/80 py-12">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ShieldCheck className="size-4 text-sky-400" aria-hidden="true" />
              Cyber<span className="text-gradient">Sense</span>
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-500">
              Evidence-backed accessibility and security scanning. Accessibility findings come from a real browser run;
              security checks report observed configuration only.
            </p>
          </div>
          <nav aria-label="Product" className="text-xs">
            <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Product</p>
            <ul className="mt-3 space-y-2">
              <li><Link to="/accessibility" className="text-slate-400 transition-colors hover:text-sky-300">New Scan</Link></li>
              <li><Link to="/dashboard" className="text-slate-400 transition-colors hover:text-sky-300">Dashboard</Link></li>
              <li><Link to="/results" className="text-slate-400 transition-colors hover:text-sky-300">Scan Results</Link></li>
              <li><Link to="/reports" className="text-slate-400 transition-colors hover:text-sky-300">Reports</Link></li>
            </ul>
          </nav>
          <nav aria-label="Platform" className="text-xs">
            <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Platform</p>
            <ul className="mt-3 space-y-2">
              <li><Link to="/history" className="text-slate-400 transition-colors hover:text-sky-300">Scan History</Link></li>
              <li><Link to="/recommendations" className="text-slate-400 transition-colors hover:text-sky-300">Fix Recommendations</Link></li>
              <li><Link to="/assistant" className="text-slate-400 transition-colors hover:text-sky-300">AI Assistant</Link></li>
              <li><Link to="/security" className="text-slate-400 transition-colors hover:text-sky-300">Security Checks</Link></li>
            </ul>
          </nav>
        </div>
        <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
          <div className="divider-neon" aria-hidden="true" />
          <p className="mt-5 text-[11px] text-slate-600">
            CyberSense — evidence before interpretation. Automated accessibility rules cover a subset of WCAG; a clean
            scan is not a claim of compliance.
          </p>
        </div>
      </footer>
    </div>
  );
}
