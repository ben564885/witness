type Line = { text: string; tone?: "ok" | "warn" | "muted" };

const TONE_CLASS: Record<NonNullable<Line["tone"]>, string> = {
  ok: "text-[#3fb37f]",
  warn: "text-[#e0b341]",
  muted: "text-[#5b5d63]",
};

/**
 * A response/query panel — what this product actually produces (an API
 * response, a SQL join), not a shell session. No window chrome, no prompt
 * glyph: those read as "this is a CLI," and this product has no CLI.
 */
export function CodePanel({
  title,
  badge,
  lines,
}: {
  title: string;
  badge?: string;
  lines: Line[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0d0e11] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="font-mono text-[12px] text-[#8b8d92]">{title}</span>
        {badge && (
          <span className="rounded-full bg-[#3fb37f]/15 px-2 py-0.5 font-mono text-[10px] tracking-wide text-[#3fb37f] uppercase">
            {badge}
          </span>
        )}
      </div>
      <div className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed whitespace-pre">
        {lines.map((line, i) => (
          <div key={i} className={line.tone ? TONE_CLASS[line.tone] : "text-[#d8d9dc]"}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
