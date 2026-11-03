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

[DONE] BUILDER-MAP-002 — Claude + ChatGPT review — Route Builder map overlay merged in PR #36 after blocker fix and re-review. `setRouteStops()` renders numbered ordered stops plus a straight polyline, coexists with Nearby/place markers/list fallback, clears fully on city switch, and passed 101/101 tests + build before merge.

[DONE] BUILDER-RUNTIME-001 — ChatGPT + Claude review — Route Builder runtime merged in PR #37 after clean Claude review and rebase onto the merged map package. Model owns city-scoped hydrate/persist/add/remove/reorder/clear/name/transport/save/start flows while `state.basket` remains a compatibility mirror; live lock, reset, rollback and stale-stop cleanup are covered. CI green.

[DONE] BUILDER-MAP-RUNTIME-004 — ChatGPT — minimal glue merged in PR #38: every accepted builder mutation syncs the current draft into `mapView.setRouteStops(...)`, newly mounted maps receive the current draft, regression tests cover both paths, and PWA cache bumped to v28 so the integrated runtime is delivered. CI green.

[DONE] MAP-PROD-SMOKE-006 — ChatGPT + Jakub — manual production smoke passed on 2026-11-03 after PRs #36/#37/#38: integrated Route Builder, map overlay, city-scoped drafts, route covers and Nearby showed no visible issues in Jakub's browser. Treat as passed unless a concrete regression is reported.

[ACK] SOCIAL-SPEC-001 — ChatGPT — Social/User Routes MVP contract opened as PR #39 on `work/social-routes-spec-001`. Scope: publish community routes, city-scoped feed, save, fork with provenance, 1–5 rating, public author profile, ownership/archive/delete, deterministic popular sorting and production acceptance test. No runtime/schema code in this package.

[OPEN] SOCIAL-SPEC-REVIEW-002 — Claude — cross-review PR #39 once. Focus on reusing existing Supabase Auth/profiles/routes/RLS, keeping migration 011 minimal, avoiding N+1 feed reads, privacy boundaries, fork provenance, rating/save ownership and the app/client separation. If no BLOCKER, leave one concise clean review. Do not edit ChatGPT's branch.

[OPEN] SOCIAL-DATA-003 — Claude — only after PR #39 is merged: implement the isolated data layer defined in `SOCIAL_ROUTES.md`. Own forward-only migration 011, `social-routes-client.js`, focused tests and DB/read-contract documentation. Do not edit `app.js` or general runtime UI. Migration is YELLOW: require ChatGPT cross-review before merge and manual hosted Supabase apply after merge.

## Required database actions before live parity

- Migration 007: applied successfully.
- Migration 008: applied successfully.
- Migration 009: applied successfully.
- Migration 010: applied successfully.
- No currently pending manual database migration. Migration 011 will become pending only after SOCIAL-DATA-003 is reviewed and merged.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — owner — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
