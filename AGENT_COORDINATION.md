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

[DONE] COVER-WIRE-001 — ChatGPT + Claude review — runtime route-cover wiring merged in PR #35 after clean Claude cross-review. Cards and detail use one full current-city `assignRouteCovers()` assignment; editorial/user/generated routes cannot independently reuse a hero. Detail exposes credit/licence; null-cover falls back to a placeholder without crashing. `route-covers.js` ships in build/PWA cache v26. GitHub CI green.

[DONE] COVER-WIRE-REVIEW-002 — Claude — PR #35 reviewed clean with no BLOCKER; trial merge had 83/83 tests + build green and hosted Supabase returned 27/27 unique editorial covers.

[DONE] BUILDER-SPEC-001 — Claude + ChatGPT review — implementation-ready `ROUTE_BUILDER.md` merged in PR #34: city-scoped draft contract, drag + keyboard reorder, mobile/live-lock behavior, map boundary, future walking-time provider boundary and runtime acceptance criteria.

[DONE] BUILDER-MODEL-002 — Claude + ChatGPT review — pure `route-builder-model.js` merged in PR #34 after review cycle 2/2. Deterministic/frozen operations, unique city-scoped stops, hydrate/add/remove/reorder/clear/serialize/toRoute primitives, explicit `basketsByCity` + `builderMetaByCity` persistence split and focused tests are on main.

[DONE] BUILDER-MODEL-FIX-003 — Claude + ChatGPT review — cross-city hydration blocker fixed and final re-review clean. Foreign-city drafts now hydrate to a fresh requested-city draft with no metadata leak; `moveStopToTargetIndex` semantics and insertion-line formula are documented/tested. PR #34 merged to main with green CI.

[ACK] BUILDER-RUNTIME-001 — ChatGPT — wire `route-builder-model.js` into the live app runtime on a dedicated branch. Own `app.js`, general app styles/build/SW/tests needed for persistence and builder interactions. Required: hydrate/persist draft from `basketsByCity` + `builderMetaByCity`, route all add/remove/reorder/clear/save flows through the model, preserve current live-route lock, city isolation and backwards compatibility, and keep current `state.basket` mirror working. Do not edit Claude-owned map package while active.

[OPEN] BUILDER-MAP-002 — Claude — isolated Route Builder map package. Add `setRouteStops(places)` to `map-view.js` plus focused tests and only map-specific CSS if needed. It must render numbered draft-stop markers in order plus a straight polyline between consecutive stops, clear on `[]`, coexist with normal place markers/cards/Nearby, preserve OSM attribution and mobile behavior, and never mutate/reorder the input. Do not edit `app.js`, general styles, persistence, service worker or Route Builder model. Open a PR and request ChatGPT cross-review. GREEN.

[OPEN] MAP-PROD-SMOKE-006 — ChatGPT — run after BUILDER-RUNTIME-001 and BUILDER-MAP-002 are merged so one final production pass covers map/Nearby, route-cover rendering and the manual Route Builder. Verify Warsaw and Kraków separately: map/tiles/attribution, filters/search, place detail, add-to-route, Nearby 500 m on/off and exact ordering, city switch/drafts, geolocation/RPC fallback, mobile layout, editorial hero uniqueness/credit and builder numbered route stops.

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
