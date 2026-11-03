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

[DONE] KRK-REVIEW-003 — Claude — PR #24 reviewed clean with no blocker; one non-blocking generator-generalisation note recorded.

[DONE] MAP-DATA-001 — ChatGPT + Claude review — stable Nearby RPC contract + `nearby-client.js` + tests merged in PR #25 after clean Claude cross-review. Migration 008 is on main and still requires manual application to hosted Supabase.

[DONE] MAP-DATA-REVIEW-002 — Claude — PR #25 reviewed clean, no BLOCKER. Integration note: normalize `distanceMeters` to map-view `distanceM` and merge nearby rows by public `id` with full catalogue objects before planner/basket use.

[DONE] MAP-UI-001 — Claude + ChatGPT review — isolated map module merged in PR #26 after ChatGPT cross-review; `map-view.js`, `map.css`, tests and integration notes are on main. Public OSM tiles are MVP-only and require provider hardening before heavy traffic.

[OPEN] MAP-INTEGRATE-002 — ChatGPT — integrate reviewed map UI + Nearby client into Places/runtime, build pipeline and service-worker cache. Preserve list fallback, city switching and route state. Normalize Nearby distance naming and merge partial nearby rows by public ID with full catalogue records. Runtime must degrade gracefully if RPC is unavailable until migration 008 is applied. YELLOW: Claude cross-review before merge.

## Required database actions before live parity

- Migration 007: applied successfully to hosted Supabase.
- Migration 008: merged to `main`; Jakub should apply `008_nearby_read_api.sql` before expecting server-backed Nearby in production.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — owner — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
