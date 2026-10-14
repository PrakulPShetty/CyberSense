import { Accessibility, BrainCircuit, Radar, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Pure CSS/SVG hero visual: a glowing digital globe wrapped in orbital rings,
 * a protective accessibility shield, and four floating capability cards.
 * No 3D library — layered gradients, transforms and keyframe animations only.
 */
export function HeroGlobe() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" role="img" aria-label="Glowing digital globe protected by an accessibility shield, with orbital rings and floating capability cards">
      {/* Ambient glow */}
      <div className="absolute inset-[8%] rounded-full bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-violet-500/25 blur-3xl animate-pulse-glow" aria-hidden="true" />

      {/* Orbital rings */}
      <div className="absolute inset-0 animate-spin-slow" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[92%] w-[92%] -translate-x-1/2 -translate-y-1/2">
          <div className="h-full w-full rounded-full border border-sky-400/25 [transform:rotateX(72deg)]" />
        </div>
      </div>
      <div className="absolute inset-0" aria-hidden="true">
        <div
          className="h-full w-full rounded-full border border-violet-400/20 [transform:rotateX(72deg)_rotateY(38deg)]"
          style={{ animation: "orbit-rev 26s linear infinite" }}
        />
      </div>

      {/* Globe */}
      <div className="absolute inset-[14%] overflow-hidden rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(125,211,252,0.5),rgba(37,99,235,0.38)_38%,rgba(49,46,129,0.55)_68%,rgba(10,15,36,0.95))] shadow-[0_0_80px_rgba(56,189,248,0.35),inset_0_0_60px_rgba(2,6,23,0.8)] ring-1 ring-sky-300/30">
        {/* Latitude/longitude grid */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-50" aria-hidden="true">
          <defs>
            <radialGradient id="globe-fade" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="rgba(186,230,253,0.35)" />
              <stop offset="100%" stopColor="rgba(2,6,23,0)" />
            </radialGradient>
          </defs>
          <rect width="200" height="200" fill="url(#globe-fade)" />
          <g stroke="rgba(125,211,252,0.4)" strokeWidth="0.7" fill="none">
            <ellipse cx="100" cy="100" rx="96" ry="34" />
            <ellipse cx="100" cy="100" rx="96" ry="68" />
            <ellipse cx="100" cy="100" rx="96" ry="96" />
            <ellipse cx="100" cy="100" rx="34" ry="96" />
            <ellipse cx="100" cy="100" rx="68" ry="96" />
            <ellipse cx="100" cy="100" rx="14" ry="96" />
            <ellipse cx="100" cy="100" rx="14" ry="96" transform="rotate(60 100 100)" />
            <ellipse cx="100" cy="100" rx="14" ry="96" transform="rotate(120 100 100)" />
            <line x1="4" y1="100" x2="196" y2="100" />
            <line x1="100" y1="4" x2="100" y2="196" />
          </g>
          {/* Continent-ish landmasses */}
          <g fill="rgba(34,211,238,0.28)" stroke="rgba(125,211,252,0.35)" strokeWidth="0.6">
            <path d="M52 62 Q70 48 88 60 Q96 74 84 88 Q64 96 52 84 Q44 72 52 62 Z" />
            <path d="M118 52 Q138 46 150 60 Q154 76 138 84 Q120 86 114 72 Q112 60 118 52 Z" />
            <path d="M64 118 Q84 108 98 120 Q104 136 88 148 Q68 152 58 138 Q54 126 64 118 Z" />
            <path d="M130 116 Q146 110 154 124 Q156 140 140 146 Q126 146 122 132 Q122 122 130 116 Z" />
            <path d="M96 150 Q112 146 120 156 Q122 170 106 176 Q92 174 88 162 Q90 154 96 150 Z" />
          </g>
        </svg>
        {/* Specular highlight */}
        <div className="absolute left-[18%] top-[10%] h-[30%] w-[42%] rounded-full bg-gradient-to-br from-white/25 to-transparent blur-md" aria-hidden="true" />
      </div>

      {/* Protective shield */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-violet-500 shadow-[0_0_50px_rgba(56,189,248,0.55)] ring-1 ring-sky-200/50 sm:size-24">
          <ShieldCheck className="size-10 text-white drop-shadow-[0_2px_8px_rgba(2,6,23,0.6)] sm:size-12" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-cyan-300 ring-2 ring-navy-950">
            <Accessibility className="size-3 text-navy-950" aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* Floating capability cards */}
      <FloatingCard className="left-0 top-[16%] animate-float" icon={<Radar className="size-4 text-sky-300" aria-hidden="true" />} label="Website Scanning" tone="sky" />
      <FloatingCard className="right-0 top-[30%] animate-float-slow" icon={<Accessibility className="size-4 text-cyan-300" aria-hidden="true" />} label="Accessibility" tone="cyan" delay="0.8s" />
      <FloatingCard className="bottom-[24%] left-[4%] animate-float-slow" icon={<ShieldCheck className="size-4 text-violet-300" aria-hidden="true" />} label="Security" tone="violet" delay="1.6s" />
      <FloatingCard className="bottom-[12%] right-[6%] animate-float" icon={<BrainCircuit className="size-4 text-indigo-300" aria-hidden="true" />} label="AI Insights" tone="indigo" delay="0.4s" />

      {/* Sparkles */}
      <Sparkles className="absolute right-[18%] top-[8%] size-4 text-cyan-300/70 animate-pulse-glow" aria-hidden="true" />
      <Sparkles className="absolute bottom-[16%] left-[22%] size-3 text-violet-300/70 animate-pulse-glow [animation-delay:1.2s]" aria-hidden="true" />
    </div>
  );
}

const TONES: Record<string, string> = {
  sky: "text-sky-300 ring-sky-400/30 bg-sky-500/10",
  cyan: "text-cyan-300 ring-cyan-400/30 bg-cyan-500/10",
  violet: "text-violet-300 ring-violet-400/30 bg-violet-500/10",
  indigo: "text-indigo-300 ring-indigo-400/30 bg-indigo-500/10",
};

function FloatingCard({
  className,
  icon,
  label,
  tone,
  delay,
}: {
  className?: string;
  icon: React.ReactNode;
  label: string;
  tone: keyof typeof TONES;
  delay?: string;
}) {
  return (
    <div
      className={`glass absolute flex items-center gap-2 rounded-xl px-3 py-2 shadow-[0_10px_30px_rgba(2,6,23,0.5)] ${className ?? ""}`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      <span className={`flex size-7 items-center justify-center rounded-lg ring-1 ${TONES[tone]}`}>{icon}</span>
      <span className="whitespace-nowrap text-xs font-medium tracking-wide text-slate-200">{label}</span>
    </div>
  );
}
