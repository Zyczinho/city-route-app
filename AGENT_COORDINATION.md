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

[ACK] SOCIAL-RUNTIME-004 — ChatGPT — PR #42 router blocker fixed at `0d34d71`; Claude targeted browser retest (community route, author profile, saved) is clear: CLEAR TO MERGE. After merge run MAP-PROD-SMOKE-006, incl. the signed-in saved list.

[DONE] REQ-SPEC-001 — Claude + ChatGPT review — `PLACE_REQUESTS.md` merged in PR #41 and reconciled with the earlier `REQUESTS.md`. Canonical product contract: city-scoped specific-place and category-gap requests, duplicate/+1 flow, one supporter per account, private notes/links, founder demand ranking, lifecycle, and no sixth bottom-nav tab. Category-gap free-text intent such as “więcej kebabów” must be preserved even when mapped to a broader taxonomy category.

[ACK] REQ-DATA-002 — ChatGPT — PR #43 final cross-review cycle 2/2: CLEAR TO MERGE at head `0db5ed2`. Claude cannot merge in its environment: please merge #43, then apply 012 to hosted Supabase **from merged main** (not the branch).

[OPEN] REQ-UI-003 — ChatGPT — start only after REQ-DATA-002 is clean, merged and migration 012 is available on hosted Supabase. Implement request entry points (search gap, category end, user-place sheet), request form with likely-duplicate/+1 suggestions, ranked active requests, support/unsupport and Profil → Twoje prośby. Do not add another permanent bottom-nav tab.

[ACK] REQ-ADMIN-004 — Claude → ChatGPT review (YELLOW) — PR on `claude/req-admin-004` (stacked on #43): migration 013 `app_admins` allow-list (no policies, no UUID, first admin added by founder SQL) + admin RPCs that check it, isolated `admin/` page (not linked, noindex, no app.js) with ranking, filters, status/place link, CSV export; private note/link for admins only, never identities. Apply 013 only after 012 and after review/merge. Duplicate merging deferred (needs a 012 schema change).

[ACK] NAV-MYROUTE-001 — ChatGPT — A+B verified by Claude at 375 px in PR #42 (4 tabs, centred Moja trasa, Zarezerwuj in header, no overflow). Ships with #42.

## Required database actions before live parity

- Migration 007: applied successfully.
- Migration 008: applied successfully.
- Migration 009: applied successfully.
- Migration 010: applied successfully.
- Migration 011: applied successfully by Jakub on 2026-11-03.
- Migration 012: implemented in PR #43 but **NOT approved/merged/applied**; do not apply until REQ-DATA-002 review cycle 2/2 is clean.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — owner — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
