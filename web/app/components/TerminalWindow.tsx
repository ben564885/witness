export function TerminalWindow({ lines }: { lines: { prompt?: boolean; text: string; dim?: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-[#0d0e11] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      <div className="px-4 py-4 font-mono text-[13px] leading-relaxed whitespace-pre">
        {lines.map((line, i) => (
          <div key={i} className="text-[#d8d9dc]">
            {line.prompt !== false && <span className="text-accent">$ </span>}
            {line.text}
            {line.dim && <span className="text-[#5b5d63]">{line.dim}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
