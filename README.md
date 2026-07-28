# Witness

Managers evaluate engineers on what the system of record credits them for — commits, PRs authored, tickets closed. The highest-leverage work (unblocking a teammate, catching a bug in review, triaging an incident) happens in Slack and gets credited to whoever closed the ticket afterward. It's invisible to every dashboard, and invisible at review time.

Witness finds that work. For each engineer, it surfaces things they did that helped tickets or PRs credited to **someone else**, and returns cited artifacts — never a score. Every finding is confirmed against a second source: a Slack message alone isn't evidence, but a Slack message referencing a ticket that's assigned to someone else and closed two hours later is.

Restrict the tool to one connector and the point of the whole project is that the output doesn't go blank — it becomes a confident, wrong performance review. See [PIVOT.md](PIVOT.md) for why that has to be provable, not just claimed, and [PRD.md](PRD.md) for the full spec (API contract, data model, ranking, demo script).

## How it works

Attribution is a temporal join, not an LLM call: *"this Slack message referenced ENG-412, ENG-412 is assigned to someone else, and it closed within the confirmation window"* is a SQL predicate. That join runs entirely inside Postgres, and every read in the attribution path goes through a view/function gated on the run's `enabled_sources`. Disable a source and there's nothing to join against — not because a code branch skipped it, but because the row is structurally absent from the query. Access control works the same way: an engineer sees their own findings, a manager sees their direct reports, nobody sees the org, enforced by RLS rather than by UI convention.

```
POST /run { sources, window_days, confirm_window_hours }
        → orchestration + LLM classification fan-out
        → InsForge: confirm_attributions() over source-scoped views
        → cited findings, keyed to a run
```

## Repo layout

| Path | What |
|---|---|
| `migrations/` | InsForge/Postgres schema — core tables, source-scoped views, the attribution engine, RLS policies, realtime run stream, pgvector reference resolution |
| `functions/report.ts` | Public read-only edge function: `GET /functions/report?run_id=<uuid>` returns a run's degradation status and RLS-scoped findings, independent of the orchestration pipeline being awake |
| `functions/run.ts` | Pipeline-internal: creates a run, or clones a prior run's harvested data forward (the fast re-run path for the source-toggle demo) |
| `functions/ingest.ts` | Pipeline-internal: identity resolution, reference extraction, and normalized writes — the one place harvested data becomes `source_event`/`ticket_state`/`identity_claim` rows |
| `functions/confirm.ts` | Pipeline-internal: calls `confirm_attributions()`, assembles the cited response in the PRD §7 shape |
| `hydradb/` | HydraDB REST client (live-verified against the real API — see `hydradb/client.ts`'s header for two wrong turns worth not repeating) and the harvest logic: Slack/GitHub/Linear are all pulled directly from their own APIs, with Slack additionally mirrored into HydraDB as searchable knowledge |
| `rocketride/` | The public `POST /run` pipeline — thin by design; see `rocketride/README.md` for what's confirmed vs. still needs verification against a live account |
| `web/` | Next.js landing page for the project |
| `PRD.md` | MVP scope, API contract, data model, ranking formula, build schedule, demo script |
| `PIVOT.md` | The design rationale — why attribution and access control had to move into the database |
| `AGENTS.md` | InsForge backend setup notes for coding agents |

## Running the pipeline end to end

```bash
cd hydradb
npm install
npm run bootstrap          # once per workspace — provisions the HydraDB database
npm run sync -- --sources=slack,github,linear
```

`sync.ts` is a complete, RocketRide-independent run of the pipeline — useful
for testing the harvest → ingest → confirm flow before RocketRide is wired
up. `npm run serve` runs the same logic as an HTTP server that RocketRide's
`run.pipe` fronts publicly; see `rocketride/README.md` for deployment.

## Backend (InsForge)

Backend project `agents-love-you` (API base `https://sjcd8q6t.us-east.insforge.app`), Postgres-based BaaS providing the database, RLS, edge functions, and realtime used here.

Migrations apply in filename order via the `insforge` CLI:

```
migrations/
  20260728182006_core-schema.sql          -- person, identity_claim, source_event, ticket_state, run
  20260728182007_source-scoped-views.sql  -- the degradation guarantee
  20260728182009_attribution-engine.sql   -- confirm_attributions()
  20260728182010_rls-access-control.sql   -- own-data / manager-of-reports visibility
  20260728182011_realtime-run-stream.sql  -- live per-run stage progress
  20260728182013_vector-references.sql    -- fuzzy reference resolution via pgvector
```

`functions/report.ts` reads run metadata and degradation status with the admin key, then reads findings through the caller's own token so RLS — not the function — decides what's visible.

## Web (landing page)

```
cd web
npm install
npm run dev
```

Next.js 16 / React 19 / Tailwind 4, with GSAP + Lenis for scroll/animation.
