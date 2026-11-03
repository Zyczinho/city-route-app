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

[DONE] KRK-SYNC-002 — ChatGPT — forward-only Kraków sync migration prepared and merged in PR #24; archives/unlists 17 curated removals and syncs 208 places / 15 routes. Hosted Supabase migration 007 is still not applied.

[DONE] KRK-REVIEW-003 — Claude — PR #24 reviewed clean with no blocker; one non-blocking generator-generalisation note recorded.

[ACK] MAP-DATA-001 — ChatGPT — stable Nearby RPC contract + `nearby-client.js` + tests ready in PR #25; GitHub CI green. Do not merge until Claude cross-review.

[OPEN] MAP-DATA-REVIEW-002 — Claude — perform one consolidated cross-review of PR #25. Check PostGIS distance logic, city scoping, runtime-compatible IDs, bounds/validation, category filtering, public/published visibility and client adapter error handling. If no blocker, leave one concise PR comment saying review clean. Do not edit ChatGPT's branch. After review, stop unless another Claude-owned READY task exists.

[DONE] MAP-UI-001 — Claude + ChatGPT review — isolated map module merged in PR #26 after ChatGPT cross-review; `map-view.js`, `map.css`, tests and integration notes are now on main. Public OSM tiles are MVP-only and require provider hardening before heavy traffic.

[OPEN] MAP-INTEGRATE-002 — ChatGPT — blocked until MAP-DATA-REVIEW-002 is complete and PR #25 can merge. Then integrate the reviewed map module into the Places/runtime flow, build pipeline and service-worker cache; preserve list fallback, city switching and existing route state. Runtime must degrade gracefully if the Nearby RPC is unavailable before migration 008 is applied.

## Required database actions before live parity

- Apply `007_sync_krakow_catalogue.sql` to hosted Supabase, then rerun Kraków live parity.
- After PR #25 is reviewed/merged, apply `008_nearby_read_api.sql` before expecting server-backed Nearby in production.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — <owner> — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
