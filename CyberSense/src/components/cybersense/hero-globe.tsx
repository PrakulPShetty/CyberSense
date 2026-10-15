import { Accessibility, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hero visual.
 *
 * Pure CSS + inline SVG — no external images, no 3D library — so it renders
 * identically offline during a demo. The floating cards describe what the
 * platform actually does; they carry no numbers and assert nothing about a
 * scanned site.
 */
const CAPABILITIES = [
  {
    label: "Website scanning",
    detail: "Real browser render",
    icon: ScanSearch,
    position: "left-[2%] top-[16%]",
    tone: "text-sky-300",
    delay: "0s",
  },
  {
    label: "Accessibility issues",
    detail: "axe-core rule evidence",
    icon: Accessibility,
    position: "right-[0%] top-[36%]",
    tone: "text-rose-300",
    delay: "1.4s",
  },
  {
    label: "Security checks",
    detail: "Headers and TLS observed",
    icon: ShieldCheck,
    position: "left-[0%] bottom-[20%]",
    tone: "text-cyan-300",
    delay: "2.6s",
  },
  {
    label: "AI insights",
    detail: "Plain-language fixes",
    icon: Sparkles,
    position: "right-[4%] bottom-[10%]",
    tone: "text-violet-300",
    delay: "3.8s",
  },
] as const;

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]" aria-hidden="true">
      {/* Atmospheric lighting */}
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(59,130,246,0.34),transparent_66%)] blur-3xl" />
      <div className="absolute inset-[20%] rounded-full bg-[radial-gradient(circle_at_62%_62%,rgba(139,92,246,0.3),transparent_70%)] blur-3xl" />
      <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(34,211,238,0.22),transparent_72%)] blur-2xl" />

      {/* Starfield / dot grid */}
      <div className="dot-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_70%)]" />

      {/* Globe, orbital rings and grid */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="globe-fill" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#1e3a8a" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#050b1e" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id="ring-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="ring-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
          </linearGradient>
          <clipPath id="globe-clip">
            <circle cx="200" cy="200" r="112" />
          </clipPath>
        </defs>

        {/* Globe body */}
        <circle cx="200" cy="200" r="112" fill="url(#globe-fill)" />
        <g clipPath="url(#globe-clip)" fill="none" stroke="rgba(125,211,252,0.34)" strokeWidth="0.9">
          <circle cx="200" cy="200" r="112" />
          <ellipse cx="200" cy="200" rx="76" ry="112" />
          <ellipse cx="200" cy="200" rx="38" ry="112" />
          <line x1="200" y1="88" x2="200" y2="312" />
          <ellipse cx="200" cy="200" rx="112" ry="38" />
          <ellipse cx="200" cy="200" rx="112" ry="76" />
          <line x1="88" y1="200" x2="312" y2="200" />
        </g>

        {/* Node glints on the globe */}
        <g fill="#7dd3fc">
          <circle cx="150" cy="150" r="2.4" opacity="0.9" />
          <circle cx="262" cy="176" r="2" opacity="0.8" />
          <circle cx="196" cy="262" r="2.2" opacity="0.85" />
          <circle cx="238" cy="252" r="1.6" opacity="0.7" />
        </g>

        {/* Rotating orbital rings */}
        <g className="animate-spin-slow" style={{ transformOrigin: "200px 200px" }}>
          <ellipse
            cx="200"
            cy="200"
            rx="172"
            ry="58"
            fill="none"
            stroke="url(#ring-a)"
            strokeWidth="1.4"
            transform="rotate(-20 200 200)"
          />
          <circle cx="372" cy="200" r="3.4" fill="#7dd3fc" />
        </g>
        <g className="animate-orbit-rev" style={{ transformOrigin: "200px 200px" }}>
          <ellipse
            cx="200"
            cy="200"
            rx="150"
            ry="112"
            fill="none"
            stroke="url(#ring-b)"
            strokeWidth="1"
            strokeDasharray="5 7"
            transform="rotate(28 200 200)"
          />
          <circle cx="50" cy="200" r="3" fill="#c4b5fd" />
        </g>
      </svg>

      {/* Scanning sweep across the globe */}
      <div className="pointer-events-none absolute inset-[24%] overflow-hidden rounded-full" aria-hidden="true">
        <span className="absolute inset-x-0 h-14 animate-scan bg-gradient-to-b from-transparent via-cyan-300/35 to-transparent blur-[2px]" />
      </div>

      {/* Protective shield containing the accessibility symbol */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex size-[9.5rem] items-center justify-center">
          <svg viewBox="0 0 100 122" className="absolute inset-0 size-full drop-shadow-[0_14px_36px_rgba(56,189,248,0.35)]">
            <defs>
              <linearGradient id="shield-fill" x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
                <stop offset="55%" stopColor="#2563eb" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <path
              d="M50 2 L96 20 V60 C96 88 75 107 50 120 C25 107 4 88 4 60 V20 Z"
              fill="url(#shield-fill)"
              stroke="rgba(148,197,255,0.6)"
              strokeWidth="1.5"
            />
            <path
              d="M50 10 L88 25 V60 C88 83 70 98 50 109 C30 98 12 83 12 60 V25 Z"
              fill="rgba(5,7,15,0.62)"
              stroke="rgba(148,197,255,0.35)"
              strokeWidth="0.8"
            />
          </svg>
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-sky-300/10" />
          <span className="relative flex flex-col items-center gap-1.5">
            <Accessibility className="size-12 text-sky-100" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-200/90">Accessible</span>
          </span>
        </div>
      </div>

      {/* Floating capability cards */}
      {CAPABILITIES.map((cap, index) => {
        const Icon = cap.icon;
        return (
          <div
            key={cap.label}
            className={cn(
              "glass animate-float absolute w-40 rounded-2xl px-3.5 py-3 shadow-[0_16px_40px_rgba(2,6,23,0.6)]",
              cap.position,
              index > 1 && "hidden sm:block",
            )}
            style={{ animationDelay: cap.delay }}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("size-3.5 shrink-0", cap.tone)} />
              <span className="truncate text-[11px] font-semibold text-slate-100">{cap.label}</span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-400">{cap.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
