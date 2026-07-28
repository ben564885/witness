"use client";

import { useEffect, useState } from "react";
import { Logo } from "../components/Logo";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";

type SourceId = "slack" | "github" | "linear";
const SOURCES: { id: SourceId; label: string }[] = [
  { id: "slack", label: "Slack" },
  { id: "github", label: "GitHub" },
  { id: "linear", label: "Linear" },
];

interface Evidence {
  source: string;
  ref: string;
  url: string | null;
  note: string;
}
interface Finding {
  claim: string;
  rule: string;
  evidence: Evidence[];
}
interface PersonResult {
  person: { id: string; display_name: string };
  visible: { prs: number; tickets_closed: number; commits: number };
  invisible: { confirmed_unblocks: number; reviews: number; triage: number };
  findings: Finding[];
}
interface RunResult {
  run_id: string;
  enabled_sources: string[];
  degraded: { rules_available: string[]; rules_unavailable: string[]; note: string | null };
  people: PersonResult[];
}

export default function DemoPage() {
  const [enabled, setEnabled] = useState<Set<SourceId>>(new Set(["slack", "github", "linear"]));
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const sources = Array.from(enabled);
    if (sources.length === 0) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "request failed");
        if (!cancelled) setResult(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const toggle = (id: SourceId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Most surprising first: highest confirmed ghost work leads, the visibly
  // "safe" people (nothing hidden) trail — the reveal reads top to bottom.
  const allPeople = [...(result?.people ?? [])].sort(
    (a, b) => b.invisible.confirmed_unblocks - a.invisible.confirmed_unblocks,
  );
  const people = selected ? allPeople.filter((p) => p.person.display_name === selected) : allPeople;
  const shortcuts = allPeople.map((p) => ({ id: p.person.display_name, name: p.person.display_name }));

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <a href="/" className="text-text">
            <Logo height={16} />
          </a>
          <span className="font-mono text-[11px] tracking-wide text-muted uppercase">Manager review — Q3</span>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-4xl px-6">
        <h1 className="font-display text-4xl leading-[1.1] text-text sm:text-[42px]">
          Team performance, this quarter
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Pull up a report, or review the whole team at once.
        </p>

        <div className="mt-6">
          <AnimatedAIChat
            people={shortcuts}
            selectedId={selected}
            loading={loading}
            onSelectPerson={(id) => setSelected((prev) => (prev === id ? null : id))}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-wide text-muted uppercase">Sources</span>
          {SOURCES.map((s) => {
            const on = enabled.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  on ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:text-text"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {result?.degraded.note && (
          <div className="mt-5 rounded-lg border border-[#b8842c]/30 bg-[#b8842c]/10 px-4 py-3 text-[13px] leading-relaxed text-[#8a6420]">
            {result.degraded.note}
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-5">
          {people.length === 0 && !loading && !error && (
            <p className="text-sm text-muted">No sources enabled — nothing to review.</p>
          )}
          {people.map((p) => (
            <PersonCard key={p.person.id} person={p} />
          ))}
        </div>
      </main>
    </div>
  );
}

function PersonCard({ person }: { person: PersonResult }) {
  const initials = person.person.display_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hasGhostWork = person.findings.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_20px_50px_-30px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-text">
            {initials}
          </span>
          <p className="text-[15px] font-medium text-text">{person.person.display_name}</p>
        </div>
        {hasGhostWork ? (
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
            {person.findings.length} confirmed finding{person.findings.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
            Nothing beyond the dashboard
          </span>
        )}
      </div>

      <div className="grid gap-6 px-6 py-5 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">What the dashboard says</p>
          <dl className="mt-2 space-y-1 text-[14px] text-text">
            <div className="flex justify-between">
              <dt className="text-muted">Tickets closed</dt>
              <dd className="font-medium">{person.visible.tickets_closed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Commits</dt>
              <dd className="font-medium">{person.visible.commits}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">PRs</dt>
              <dd className="font-medium">{person.visible.prs}</dd>
            </div>
          </dl>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">What Witness found</p>
          <dl className="mt-2 space-y-1 text-[14px] text-text">
            <div className="flex justify-between">
              <dt className="text-muted">Confirmed unblocks</dt>
              <dd className="font-medium">{person.invisible.confirmed_unblocks}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Reviews</dt>
              <dd className="font-medium">{person.invisible.reviews}</dd>
            </div>
          </dl>
        </div>
      </div>

      {hasGhostWork && (
        <div className="space-y-3 border-t border-border bg-surface-2/50 px-6 py-5">
          {person.findings.map((f, i) => (
            <div key={i} className="text-[14px] leading-relaxed text-text">
              <p>{f.claim}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {f.evidence.map((e, j) =>
                  e.url ? (
                    <a
                      key={j}
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-surface-2"
                    >
                      {e.source}: {e.ref}
                    </a>
                  ) : (
                    <span
                      key={j}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted"
                    >
                      {e.source}: {e.ref}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
