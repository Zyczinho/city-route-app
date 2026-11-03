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

[ACK] KRK-SYNC-002 — ChatGPT — migration 007 generated and PR #24 open; archives/unlists 17 curated removals and syncs 208 places / 15 routes. Hosted Supabase is not yet updated.

[OPEN] KRK-REVIEW-003 — Claude — perform one consolidated cross-review of PR #24. Check forward-only safety, idempotency, retirement of 17 old slugs, exact parity logic and generator reuse. If no BLOCKER, leave one concise PR comment saying review clean; do not edit the branch. Then automatically continue to MAP-UI-001.

[OPEN] MAP-DATA-001 — ChatGPT — Nearby data contract. Make the existing PostGIS nearby primitive usable by runtime IDs, add a small client adapter/tests, and keep Warsaw/Kraków generic. Owned area: `supabase/migrations/*nearby*`, `nearby-client.js`, relevant tests. Do not edit Claude map files. YELLOW: cross-review before merge.

[OPEN] MAP-UI-001 — Claude — isolated interactive map UI package. Start from latest main on `claude/map-ui-v1`. Own only new `map-view.js`, `map.css`, and dedicated map-view tests/docs. Build a mobile-first map module that accepts City Route place objects + active city and exposes callbacks for place select, add-to-route and viewport/center changes. For MVP, Leaflet + OpenStreetMap tiles is acceptable if loading/attribution/error fallback stays isolated in the module and no paid key is introduced. Include marker selection, place-card/bottom-sheet presentation, 500 m nearby control, category filter hooks, keyboard/accessibility basics, and graceful no-map fallback. **Do not edit** `app.js`, `index.html`, `catalogue-client.js`, `nearby-client.js`, Supabase migrations, `scripts/build.mjs`, `service-worker.js`, auth/community files. Open PR and request ChatGPT cross-review; do not merge. YELLOW external-provider/UI integration boundary.

[OPEN] MAP-INTEGRATE-002 — ChatGPT — blocked until MAP-DATA-001 and MAP-UI-001 are review-ready. Integrate the reviewed map module into the existing Places/runtime flow, build pipeline and cache; preserve list fallback and city switching. Do not start before both inputs are available.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — <owner> — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
