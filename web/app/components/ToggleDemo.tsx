"use client";

import { useState } from "react";

type SourceId = "slack" | "github" | "linear" | "gmail";

const SOURCES: { id: SourceId; label: string }[] = [
  { id: "slack", label: "Slack" },
  { id: "github", label: "GitHub" },
  { id: "linear", label: "Linear" },
  { id: "gmail", label: "Gmail" },
];

/**
 * Mirrors public.run_degradation() in
 * migrations/20260728182007_source-scoped-views.sql exactly: rule (a) needs
 * slack plus a ticket source, rule (b) needs github. This run's one seeded
 * finding (Maria → ENG-412) only ever resolves through rule (a).
 */
function ruleAAvailable(enabled: Set<SourceId>) {
  return enabled.has("slack") && (enabled.has("linear") || enabled.has("github"));
}
function ruleBAvailable(enabled: Set<SourceId>) {
  return enabled.has("github");
}

export function ToggleDemo() {
  const [enabled, setEnabled] = useState<Set<SourceId>>(
    new Set(["slack", "github", "linear", "gmail"]),
  );

  const toggle = (id: SourceId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const aAvailable = ruleAAvailable(enabled);
  const bAvailable = ruleBAvailable(enabled);
  const confirmed = aAvailable && enabled.has("linear");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SOURCES.map((s) => {
          const on = enabled.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={on}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-muted hover:text-text"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center font-mono text-xs text-muted">
        this is the real source toggle — same run id, same seeded fixture, no redeploy between clicks
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-[#0d0e11] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${confirmed ? "bg-[#3fb37f]" : "bg-[#e0b341]"}`}
          />
          <span className="ml-1 truncate font-mono text-[12px] text-[#8b8d92]">
            run 91e78ad5 · Maria Okonkwo
          </span>
        </div>

        <div className="p-5 sm:p-6">
          {confirmed ? (
            <>
              <p className="font-mono text-[13px] text-[#3fb37f]">confirmed · rule a</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#d8d9dc]">
                Unblocked Chen on <span className="font-mono text-white">ENG-412</span> — the
                Slack message referencing it landed 2h14m before the ticket, assigned to Chen,
                closed.
              </p>
              <div className="mt-4 space-y-1.5 font-mono text-[12px] text-[#8b8d92]">
                <p>→ slack · 1721847293.004200</p>
                <p>→ linear · ENG-412 · assignee: Chen · closed +2h14m</p>
              </div>
            </>
          ) : (
            <>
              <p className="font-mono text-[13px] text-[#e0b341]">unconfirmed · degraded</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#d8d9dc]">
                {aAvailable
                  ? "Linear is off — there is no ticket left to confirm against, not a branch that decided to skip it."
                  : "No ticket or commit source is enabled at all."}{" "}
                A single-connector tool would now describe Maria as a low contributor.
              </p>
              <p className="mt-4 font-mono text-[12px] text-[#8b8d92]">
                → 0 confirmed attributions (was 1)
              </p>
            </>
          )}

          <div className="mt-5 rounded-lg bg-white/[0.04] p-3 font-mono text-[11px] leading-relaxed text-[#8b8d92]">
            <span className="text-[#5b5d63]">degraded: </span>
            {"{"} rule_a: {aAvailable ? "true" : "false"}, rule_b: {bAvailable ? "true" : "false"} {"}"}
          </div>
        </div>
      </div>
    </div>
  );
}
