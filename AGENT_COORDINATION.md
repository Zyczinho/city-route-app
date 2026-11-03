# Agent Coordination

This file is a compact async handoff board between agents. It is not a chat log.

## Rules

- Read this file at the start of a task and before finalizing a PR.
- Normal mode is `ECONOMY_MODE.md`.
- Status values: `OPEN`, `ACK`, `DONE`, `ESCALATE`.
- Only the addressed agent needs to respond to an `OPEN` item.
- Close resolved items as `DONE`; do not keep debating closed items without new evidence.
- Maximum two review cycles per PR. After that, unresolved material disagreement becomes `ESCALATE`.
- Do not edit another active package's owned files.

## Active coordination

[DONE] CORE-021 — ChatGPT — Warsaw/Kraków multi-city runtime, per-city basket, Supabase cutover and selector — merged PR #21.

[DONE] KRK-QUALITY-001 — Claude — Kraków content quality v1 — merged PR #23; 208 places, 50 curated anchors, 15 editorial routes, reproducible curation + enrichment report.

[DONE] KRK-SYNC-002 — ChatGPT — forward-only Kraków sync merged in PR #24; hosted Supabase migration 007 applied successfully by Jakub on 2026-11-03.

[DONE] MAP-DATA-001 — ChatGPT + Claude review — Nearby RPC contract + client merged in PR #25; migration 008 applied and live-validated for Warsaw/Kraków.

[DONE] MAP-UI-001 — Claude + ChatGPT review — isolated map module merged in PR #26.

[DONE] MAP-INTEGRATE-002 — ChatGPT + Claude review — map runtime integration merged in PR #28 after clean Claude cross-review. Places map, Nearby RPC/fallback, per-city basket integration and SW v25 are on main.

[DONE] NEARBY-ORDER-005 — ChatGPT + Claude review — exact-distance ordering migration 009 merged in PR #30 after clean Claude review and applied successfully to hosted Supabase by Jakub on 2026-11-03.

[DONE] ROUTE-HERO-001 — Claude + ChatGPT review — 27 unique editorial route hero images, provenance, `route-covers.js` and duplicate-prevention tests merged in PR #31.

[DONE] COVER-SYNC-002 — ChatGPT + Claude review — route cover metadata migration 010 merged in PR #32 after clean Claude review and applied successfully to hosted Supabase by Jakub on 2026-11-03.

[ACK] COVER-WIRE-001 — ChatGPT — wire `route-covers.js` into runtime cards/details after map merge. Route cover assignment must be computed over the full active route set, never independently per card; editorial covers stay unique, generated/user routes may borrow only an unused stop image and otherwise show no hero. Detail must expose image credit/licence. ChatGPT owns `app.js`, build/service-worker changes and any route-cover runtime tests for this package.

[OPEN] BUILDER-SPEC-001 — Claude — prepare the implementation-ready manual Route Builder v1 specification while ChatGPT owns COVER-WIRE-001. Product intent: routes-first workflow where a user can add places sequentially, remove them, reorder via drag-and-drop, see the ordered stops on the map, retain a city-scoped draft, and later publish/save. Define state shape, actions/events, persistence contract, edge cases, accessibility/keyboard drag-and-drop behavior, mobile behavior, and integration boundaries with existing `basketsByCity`, `map-view.js` and future routing/walking-time provider. Deliver `ROUTE_BUILDER.md` only. Do not edit `app.js`, `index.html`, CSS, map files, Supabase, service worker or route-cover files. GREEN/docs-only; commit directly to a Claude branch or PR.

[OPEN] BUILDER-MODEL-002 — Claude — after BUILDER-SPEC-001 is complete, implement the isolated pure state/model layer for Route Builder v1 on the same or follow-up Claude branch: new `route-builder-model.js` + focused Node tests only. Required primitives: create/hydrate city draft, add unique place, remove place, reorder/move place, clear draft, serialize, preserve stable stop order, reject cross-city contamination, and keep operations deterministic/idempotent where applicable. No DOM, drag library, map rendering, persistence side effects, network calls or runtime wiring. Do not edit ChatGPT-owned files. Open PR and request ChatGPT cross-review; do not merge. GREEN.

[OPEN] MAP-PROD-SMOKE-006 — ChatGPT — run after COVER-WIRE-001 reaches merge-ready so one final production pass covers both map/Nearby and route-cover rendering. Verify Warsaw and Kraków separately: map/tiles/attribution, filters/search, place detail, add-to-route, Nearby 500 m on/off and exact ordering, city switch/baskets, geolocation/RPC fallback, mobile layout, editorial hero uniqueness and visible credit/licence.

## Required database actions before live parity

- Migration 007: applied successfully.
- Migration 008: applied successfully.
- Migration 009: applied successfully.
- Migration 010: applied successfully.
- No currently pending manual database migration.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — owner — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
