"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "../components/Logo";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { SiGithub, SiLinear } from "react-icons/si";
import { FaSlack } from "react-icons/fa";
import type { IconType } from "react-icons";

type SourceId = "slack" | "github" | "linear";
const SOURCES: { id: SourceId; label: string; icon: IconType; color: string }[] = [
  { id: "slack", label: "Slack", icon: FaSlack, color: "#4A154B" },
  { id: "github", label: "GitHub", icon: SiGithub, color: "#181717" },
  { id: "linear", label: "Linear", icon: SiLinear, color: "#5E6AD2" },
];
const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

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
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  // Set the instant a question is submitted or a name is picked — not once
  // the answer comes back — so the input disappears immediately, not after
  // the AI round trip.
  const [chatModeActive, setChatModeActive] = useState(false);
  const skipNextAutoInsight = useRef(false);

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
  // Everything backing the AI's claim about the selected person — the "see
  // evidence" toggle shows exactly the citations the answer is grounded in.
  const evidenceForSelected = people.length === 1 ? people[0].findings.flatMap((f) => f.evidence) : [];

  // Once a question's been asked, the chat is the only thing on screen — no
  // input, no toggles, no cards — until this resets back to the overview.
  // Set the instant the question is submitted (not once the answer arrives)
  // via chatModeActive, so the input disappears immediately.
  const chatMode = chatModeActive;
  const resetToOverview = () => {
    setChatModeActive(false);
    setSelected(null);
    setAiText(null);
    setLastQuestion(null);
    setShowEvidence(false);
  };

  const selectPerson = (id: string | null) => {
    if (!id) return;
    setSelected(id);
    setChatModeActive(true);
    setAiText(null);
    setLastQuestion(null);
    setShowEvidence(false);
  };

  // Exact-name match is free and instant; anything else (a real question,
  // e.g. "who's my worst performer") goes to the AI query route, which
  // resolves it against the actual team data and never invents a person.
  const handleQuery = async (query: string) => {
    const lower = query.toLowerCase();
    const match = allPeople.find((p) => p.person.display_name.toLowerCase().includes(lower));
    if (match) {
      selectPerson(match.person.display_name);
      return;
    }
    if (allPeople.length === 0) return;
    setChatModeActive(true);
    setLastQuestion(query);
    setShowEvidence(false);
    setAiText(null);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          people: allPeople.map((p) => ({
            display_name: p.person.display_name,
            visible: p.visible,
            invisible: p.invisible,
            findings: p.findings.map((f) => ({ claim: f.claim })),
          })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.person_name) {
        skipNextAutoInsight.current = true;
        setSelected(data.person_name);
        setAiText(data.answer);
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-generate the generic per-person insight whenever a single person is
  // selected by name (button or exact match) — skipped when the selection
  // just came from handleQuery, which already set a question-specific answer.
  useEffect(() => {
    if (!selected || people.length !== 1) return;
    if (skipNextAutoInsight.current) {
      skipNextAutoInsight.current = false;
      return;
    }
    const person = people[0];
    let cancelled = false;
    setLastQuestion(`Tell me about ${person.person.display_name}`);
    setShowEvidence(false);
    setAiLoading(true);
    setAiText(null);
    fetch("/api/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: person.person.display_name,
        visible: person.visible,
        invisible: person.invisible,
        findings: person.findings.map((f) => ({ claim: f.claim })),
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled && res.ok) setAiText(data.insight);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, result?.run_id]);

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          {chatMode ? (
            <button
              type="button"
              onClick={resetToOverview}
              className="flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-text"
            >
              ← Back to team overview
            </button>
          ) : (
            <a href="/" className="text-text">
              <Logo height={16} />
            </a>
          )}
          <span className="font-mono text-[11px] tracking-wide text-muted uppercase">Manager review — Q3</span>
        </div>
      </header>

      {chatMode ? (
        <main className="mx-auto mt-10 max-w-2xl px-6">
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-text px-4 py-2.5 text-[14px] text-white">
                {lastQuestion}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                W
              </span>
              <div className="min-w-0 flex-1">
                <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-2.5 text-[14px] leading-relaxed text-text shadow-[0_10px_30px_-20px_rgba(0,0,0,0.2)]">
                  {aiLoading && !aiText ? <span className="text-muted">Thinking…</span> : aiText}
                </div>

                {aiText && (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(aiText)}
                      className="text-xs text-muted transition hover:text-text"
                    >
                      Copy
                    </button>
                    {evidenceForSelected.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowEvidence((v) => !v)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {showEvidence ? "Hide evidence" : "See evidence"}
                      </button>
                    )}
                  </div>
                )}

                {aiText && showEvidence && evidenceForSelected.length > 0 && (
                  <div className="mt-2 max-w-[85%]">
                    <EvidenceBadges evidence={evidenceForSelected} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
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
              onSelectPerson={selectPerson}
              onQuery={handleQuery}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tracking-wide text-muted uppercase">Sources</span>
            {SOURCES.map((s) => {
              const on = enabled.has(s.id);
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    on ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:text-text"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {SOURCES.filter((s) => enabled.has(s.id)).map((s) => {
                const Icon = s.icon;
                return (
                  <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted">
                    <Icon className="h-3.5 w-3.5 animate-pulse" style={{ color: s.color }} />
                    Checking {s.label}
                  </span>
                );
              })}
            </div>
          )}

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
      )}
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
              <div className="mt-1.5">
                <EvidenceBadges evidence={f.evidence} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceBadges({ evidence }: { evidence: Evidence[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {evidence.map((e, j) => {
        const src = SOURCE_BY_ID[e.source];
        const Icon = src?.icon;
        const content = (
          <>
            {Icon && <Icon className="h-3 w-3" style={{ color: src.color }} />}
            {e.source}: {e.ref}
          </>
        );
        return e.url ? (
          <a
            key={j}
            href={e.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-surface-2"
          >
            {content}
          </a>
        ) : (
          <span
            key={j}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted"
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}
