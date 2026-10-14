export function SentinelMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 3 L27 8 V16.5 C27 22.5 22.4 27.2 16 29 C9.6 27.2 5 22.5 5 16.5 V8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M11 12 L21 20 M21 12 L11 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-foreground">
      <SentinelMark className="size-6" />
      <div className="leading-none">
        <div className="text-sm font-medium tracking-[0.14em]">CyberSense</div>
        {!compact && <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Exposure twin</div>}
      </div>
    </div>
  );
}
