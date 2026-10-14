import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  ArrowRight,
  BrainCircuit,
  Building2,
  Code2,
  FileText,
  History,
  Radar,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { AppNav } from "@/components/cybersense/app-nav";
import { HeroGlobe } from "@/components/cybersense/hero-globe";
import { Button } from "@/components/ui/button";
import { CardNeon } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: Accessibility,
    title: "Accessibility scanning",
    body: "A real browser renders your page and axe-core reports the WCAG rules it actually fails — with selectors, HTML snippets, and impact levels.",
    tone: "text-cyan-300 ring-cyan-400/30 bg-cyan-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Security checks",
    body: "Low-impact configuration checks for HTTPS, security headers, cookie attributes, and TLS evidence — observed, never exploited.",
    tone: "text-sky-300 ring-sky-400/30 bg-sky-500/10",
  },
  {
    icon: BrainCircuit,
    title: "AI explanations",
    body: "Findings are explained in plain language: what the problem is, why it matters, who is affected, and how to verify a fix.",
    tone: "text-violet-300 ring-violet-400/30 bg-violet-500/10",
  },
  {
    icon: SlidersHorizontal,
    title: "Recommendations",
    body: "Advisory remediation guidance derived from your stored findings. CyberSense never modifies your site automatically.",
    tone: "text-indigo-300 ring-indigo-400/30 bg-indigo-500/10",
  },
  {
    icon: History,
    title: "Scan history",
    body: "Every scan is stored with its full evidence. Compare compatible scans over time to see what improved and what regressed.",
    tone: "text-sky-300 ring-sky-400/30 bg-sky-500/10",
  },
  {
    icon: FileText,
    title: "PDF reports",
    body: "Generate a downloadable PDF report for any saved scan — evidence, counts, and limitations in one document.",
    tone: "text-cyan-300 ring-cyan-400/30 bg-cyan-500/10",
  },
] as const;

const BENEFICIARIES = [
  {
    icon: Code2,
    title: "Developers",
    body: "Catch accessibility regressions and weak security headers before they ship, with exact selectors and failure summaries.",
  },
  {
    icon: Building2,
    title: "Businesses",
    body: "Understand exposure with evidence-backed findings instead of marketing claims, and prioritize fixes that matter.",
  },
  {
    icon: Users,
    title: "Organizations",
    body: "Track accessibility posture across pages and time, and produce reports stakeholders can act on.",
  },
  {
    icon: Accessibility,
    title: "Everyone",
    body: "A more accessible and secure web benefits every visitor — including people using assistive technology.",
  },
] as const;

const STEPS = [
  { n: "01", title: "Enter a website", body: "Provide a public URL you are authorized to scan." },
  { n: "02", title: "Run a scan", body: "A real browser renders the page and axe-core checks the rendered DOM." },
  { n: "03", title: "Review findings", body: "Inspect violations, evidence, affected elements, and severity." },
  { n: "04", title: "Understand issues", body: "The AI assistant explains each finding in plain language." },
  { n: "05", title: "Apply recommendations", body: "Follow advisory remediation steps and re-scan to verify." },
] as const;

const UNIQUE = [
  {
    title: "Evidence-backed findings",
    body: "Every result records what was actually observed — selectors, HTML snippets, header values — never a score without proof.",
  },
  {
    title: "Understandable explanations",
    body: "Technical findings are translated into plain-language explanations anyone can act on.",
  },
  {
    title: "Accessibility and security together",
    body: "Where supported, page accessibility and low-impact security configuration are checked side by side from one workflow.",
  },
] as const;

function LandingPage() {
  return (
    <div className="min-h-dvh bg-navy-950 text-slate-100">
      <AppNav />

      {/* Hero */}
      <section className="hero-aurora relative overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:pb-28 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-medium tracking-wide text-sky-300">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Evidence-backed scanning platform
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              A More <span className="text-gradient">Accessible</span> and <span className="text-gradient">Secure</span> Web for Everyone
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              CyberSense renders your page in a real browser, checks it with axe-core, verifies security configuration,
              and explains every finding in plain language — so you can fix what matters with confidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
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
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-sky-400/10 pt-8">
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">Real browser</dt>
                <dd className="mt-1 font-mono text-xl text-sky-300">axe-core</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">Security</dt>
                <dd className="mt-1 font-mono text-xl text-violet-300">Low-impact</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">Reports</dt>
                <dd className="mt-1 font-mono text-xl text-cyan-300">PDF</dd>
              </div>
            </dl>
          </div>
          <HeroGlobe />
        </div>
        <div className="divider-neon relative mx-auto max-w-7xl" aria-hidden="true" />
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">About CyberSense</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Purpose and mission
            </h2>
          </div>
          <div className="space-y-5 text-base leading-relaxed text-slate-400">
            <p>
              CyberSense exists to make the web easier to build for everyone. Accessibility problems and weak security
              configuration are two of the most common — and most fixable — reasons people are excluded from or put at
              risk on websites.
            </p>
            <p>
              Our mission is to give developers, businesses, and organizations honest, evidence-backed answers: what is
              wrong, why it matters, and what to do about it. Every finding is grounded in something a real browser
              actually observed, and every explanation is written to be understood — not just generated.
            </p>
          </div>
        </div>
      </section>

      {/* Key features */}
      <section id="features" className="relative scroll-mt-24 border-y border-sky-400/10 bg-navy-900/60 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">Key Features</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to find, understand, and fix issues
            </h2>
            <p className="mt-4 text-slate-400">
              Six capabilities that work together — from the first scan to the verified fix.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <CardNeon key={f.title} className="p-6">
                <span className={`inline-flex size-11 items-center justify-center rounded-xl ring-1 ${f.tone}`}>
                  <f.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </CardNeon>
            ))}
          </div>
        </div>
      </section>

      {/* Who benefits */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">Who Benefits</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the people who build the web — and everyone who uses it
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIARIES.map((b) => (
            <CardNeon key={b.title} className="p-6">
              <b.icon className="size-6 text-sky-300" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-100">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{b.body}</p>
            </CardNeon>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 border-y border-sky-400/10 bg-navy-900/60 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">How It Works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              From URL to verified fix in five steps
            </h2>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3 lg:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="card-neon relative rounded-2xl p-6">
                <span className="font-mono text-sm text-sky-400/80">{s.n}</span>
                <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Button asChild variant="primary" size="lg">
              <Link to="/accessibility">
                <Radar className="size-4" aria-hidden="true" />
                Start with a scan
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What makes it unique */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">What Makes CyberSense Unique</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Honest evidence, not scores without proof
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {UNIQUE.map((u) => (
            <CardNeon key={u.title} className="p-6">
              <h3 className="text-lg font-semibold tracking-tight text-slate-100">{u.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{u.body}</p>
            </CardNeon>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-sky-400/10 py-24">
        <div className="hero-aurora absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Ready to make the web <span className="text-gradient">more accessible and secure</span>?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-slate-400">
            Run your first scan in seconds. No installation on your target, no code changes — just evidence.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
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

      <footer className="border-t border-sky-400/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="size-4 text-sky-400" aria-hidden="true" />
            CyberSense — evidence before interpretation.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-5 text-xs uppercase tracking-wider text-slate-500">
            <Link to="/accessibility" className="hover:text-sky-300">Scanner</Link>
            <Link to="/security" className="hover:text-sky-300">Security</Link>
            <Link to="/reports" className="hover:text-sky-300">Reports</Link>
            <Link to="/history" className="hover:text-sky-300">History</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
