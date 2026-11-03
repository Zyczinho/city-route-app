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

[DONE] SOCIAL-SPEC-001 — ChatGPT — `SOCIAL_ROUTES.md` contract merged in PR #39. Scope: publish community routes, city-scoped feed, save, fork with provenance, 1–5 rating, public author profile, ownership/archive/delete, deterministic popular sorting and two-account production acceptance test.

[DONE] SOCIAL-SPEC-REVIEW-002 — Claude — PR #39 reviewed clean with no BLOCKER. Review identified seven implementation details for 011: keep `catalogue_routes` editorial-only, anonymous author/profile reads via narrow RPCs, direct-link unlisted route RPC, atomic publish/edit RPC, stable route UUID contract, owner-only save/rating RLS with no self-rating, and fork provenance with `on delete set null`.

[DONE] SOCIAL-DATA-003 — Claude + ChatGPT review — migration 011, `social-routes-client.js`, Postgres/PGlite harness, tests and `SOCIAL_ROUTES_DATA.md` merged in PR #40 after review cycle 2/2. Final fixes prevent unlisted/archived fork-source provenance from leaking through public cards/`route_ref`, while preserving provenance for both editorial and public community forks via server-side reference resolution. Hosted migration 011 applied successfully by Jakub on 2026-11-03.

[ACK] SOCIAL-RUNTIME-004 — ChatGPT — branch `work/social-runtime-004` active. Integrate Social Routes into runtime UI using merged `social-routes-client.js`: publish from Route Builder, city-scoped Community feed, save/unsave, fork with draft-replacement confirmation, 1–5 rating, author profile, owned route archive/delete/edit, analytics, build inclusion and PWA cache bump. Preserve editorial routes and ADR-010 cover semantics. Also make `Moja trasa` materially more prominent on mobile navigation; founder feedback indicates current five-tab density makes the core route destination too easy to lose. Open PR and request one Claude cross-review before merge.

[DONE] REQUESTS-SPEC-001 — ChatGPT — `REQUESTS.md` added to main. Requests are catalogue-demand signals, not generic support tickets: support both specific missing places and category gaps (e.g. more kebabs/bars/clubs), city-scoped, ranked by unique signed-in supporters, with a founder-facing top-demand view. Requests live under Places/Discover rather than adding a sixth bottom-nav tab.

[OPEN] REQUESTS-DATA-002 — Claude — build the isolated Requests data package from `REQUESTS.md`. Own forward-only migration 012, `requests-client.js`, focused tests and DB/read-contract docs. Do not edit `app.js`, general styles, navigation, Social Routes runtime or service worker. Required: `catalogue_requests`, `catalogue_request_supports`, city scoping, request kinds `place|category_gap`, open/planned/added/declined lifecycle, safe public aggregate read, signed-in create/support/unsupport, no supporter identity exposure, likely-duplicate lookup, no hard-coded admin UUID, and no mutable support counters unless measured need appears. Migration 012 is YELLOW: open a PR and request ChatGPT cross-review; do not apply to hosted Supabase before merge/review.

## Required database actions before live parity

- Migration 007: applied successfully.
- Migration 008: applied successfully.
- Migration 009: applied successfully.
- Migration 010: applied successfully.
- Migration 011: applied successfully by Jakub on 2026-11-03.
- Migration 012: not yet implemented; do not apply until REQUESTS-DATA-002 is reviewed and merged.

[OPEN] REQ-SPEC-001 — ChatGPT — review `PLACE_REQUESTS.md` (product owner request 2026-11-03): place/category requests with one-vote-per-user ranking, isolated admin ranking page gated by `app_admins`, privacy/abuse limits, and the "Moja trasa" mobile-nav proposal. Docs only.

[OPEN] REQ-DATA-002 — Claude — after REQ-SPEC-001 review: forward-only migration (number after 011) + RLS/RPCs + `place-requests-client.js` + PGlite harness. YELLOW.

[OPEN] REQ-UI-003 — ChatGPT — after REQ-DATA-002: request entry points (search with few results, category list end, user-place sheet), form with "+1" suggestions, Profil → Twoje prośby. YELLOW.

[OPEN] REQ-ADMIN-004 — Claude — after REQ-DATA-002: isolated admin ranking page (new files only, no `app.js`). YELLOW.

[OPEN] NAV-MYROUTE-001 — ChatGPT — product owner decision (Jakub, 2026-11-03): **option A+B** from `PLACE_REQUESTS.md` Part 2. A: order Ułóż trasę · Trasy · **Moja trasa** · Miejsca; Moja trasa is the raised centre tab (filled cyan, always visible) with a stop-count badge; existing chosen/live states kept; add toast "Dodano jako N. przystanek · Zobacz trasę". B: move Zarezerwuj from the bottom bar to the header menu next to Profil, leaving 4 bottom tabs. Acceptance in Part 2. Independent of the requests packages; can start now.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — owner — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
