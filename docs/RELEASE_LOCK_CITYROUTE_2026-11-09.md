# City Route — verified production baseline + next-chat handoff

**As of 2026-11-09 — LIVE RELEASE DELIVERED.** Recheck GitHub `main` and deployment before subsequent modifications. This document is the canonical *handoff*, not a replacement for live source, permissions or build verification.

## Definitive deployed baseline

- One release: [PR #184](https://github.com/Zyczinho/city-route-app/pull/184), squash-merged to `main` at **`52fabc07e44a1124dfdd5d5770e762b8b7c57a1a`**.
- Exact-head CI including `npm test` and `npm run build`: SUCCESS on release candidate SHA `8d3d813` and on merged `main`.
- Release candidate P0 browser smoke (375px, planner/sharing/map/pagination/PWA): SUCCESS. Worker build and no-paid-provider diagnostics: SUCCESS.
- GitHub **Production rollout verification** workflow run **#42633744254**: SUCCESS, including "Verify production app.js has exact SHA-256 of this Git commit" and "Verify app shell and other critical public modules". This proves matching served code/assets, not every optional provider or real-device behavior.
- One previous competing release draft #182 was closed, not merged. Other overlapping source PRs #125/#143/#151/#154/#164/#166/#171/#173/#175/#177/#180/#181 were closed SUPERSEDED after production verification; their changes were integrated into #184.
- [PR #179](https://github.com/Zyczinho/city-route-app/pull/179) illustrative generic-photo fallback CLOSED WITHOUT MERGE because it cannot satisfy exact real-photo requirements.
- **No destructive data cleanup**, paid API activation, production Google/Tripadvisor credentials change, or Web Push release in this integration.

## What is actually delivered in the live code

1. Five navigation destinations: Start / Trasy / Miejsca / Społeczność / Profil, plus contextual Moja trasa bar, Profile collections and preserved route history (#173).
2. Planner V2, estimates and transit-leg workaround (#143).
3. Place catalogue pagination 30/page, GPX export, Google Saved/Takeout import, route-share across route states and channel modal (#151/#154); founder-purple share controls, blue save controls.
4. Safe automatic Add Place photo proposal/default selection, with licensing safeguards (#166); this is **not** bulk real-photo catalogue coverage.
5. Consistent Lucide community-tab icons (#171); improved iPhone touch dimensions (#164); single-finger map panning with 20px outside scroll gutters (#175).
6. Event/Ticketmaster placeholder-copy fix (#125).
7. Three **editorial, desk-researched** Lisbon routes and 23 curated route stops (#181), with distinct credited Wikimedia Commons route hero photos; not user-authored or field-tested. Four editorial landmarks + 19 enriched OSM records.

## Hosted Lisbon data — applied and confirmed

**Project:** Supabase `City Route App` / ID `ycfhpvtsnsmzdmpvliif`.

- SQL file in main: `supabase/migrations/027_seed_lisbon_editorial_routes.sql`.
- **APPLIED ONCE to hosted Supabase via SQL execution after PR #184 merge**; SQL is idempotent and additive.
- Verified post-write counts: Lisbon **192** published places, **3** published editorial routes; Warsaw **308 / 12**, Kraków **208 / 16**, unchanged.
- Route stop counts `6 / 9 / 8`; public `catalogue_routes('lisbon')` returns all three with correct names/IDs.
- **Important migration ledger distinction:** the standalone data seed was run by SQL, *not* via Supabase migration-tracking endpoint. As of 2026-11-09 `list_migrations` still ends at 026; do not infer seed is missing from that. Check actual rows first. Do not blindly reapply to rewrite future curated metadata.
- **Collision discovered:** open draft [PR #183](https://github.com/Zyczinho/city-route-app/pull/183) also defines a DIFFERENT `027_accepted_commons_photo_bank.sql`. It MUST be renamed to a later, unique forward migration number, based on newest `main`, and independently security-reviewed. Blocking comment was posted; **never apply its current 027**.

## Not done (DO NOT call shipped)

1. [Issue #115](https://github.com/Zyczinho/city-route-app/issues/115): complete redesigned Start screen with three engaging route cards, personalized filters, and one-click start. Five-tab nav is not the full new Start.
2. [Issue #176](https://github.com/Zyczinho/city-route-app/issues/176): accurate real photos for each actual venue, honest provider ratings/attribution, reliable coverage on Lisbon/Kraków. Route hero images exist; individual place photos are not systematically filled.
3. [PR #183](https://github.com/Zyczinho/city-route-app/pull/183): real community CC Wikimedia photo banking; DRAFT, unmerged, migration prefix collision, RLS/security + moderation + real device QA pending.
4. [PR #163](https://github.com/Zyczinho/city-route-app/pull/163): closed-iPhone Web Push; DRAFT, unmerged, VAPID/HMAC and installed-PWA real delivery unverified. Backend pieces 025/026 already exist, but this does not prove notifications arrive.
5. [Issue #172](https://github.com/Zyczinho/city-route-app/issues/172): hard negative filters in Planner V2 not integrated.
6. Genuine community-created routes and verified field testing of Lisbon editorial routes: outstanding.
7. **Real iPhone 13 Pro Safari/PWA user journey and 2-account privacy/moderation smoke:** not executed in this release conversation. Automated browser tests passed, which is not a substitute.

## Freeze, ownership and next-step protocol

- **Production is the baseline**. All agents start from latest `origin/main`, never from the old integrated #177/#180 branches or independently merging old feature PRs.
- Founder asked to finish, test and reduce backlog before starting further speculative work. Until new explicit prioritization, at most **one implementation branch** changing shared runtime modules (`app.js`, `index.html`, `scripts/build.mjs`, `service-worker.js`, `share-links.js`, `styles.css`). Other work may be QA/review/documentation or isolated lawful photo curation.
- Work in an issue-scoped branch, one writer per shared file, green CI/smoke, explicit reviewer and rollback, then PR→main→production SHA/source/behavior verification. No speculative bulk merges.
- Next chat **FIRST** inspect live `main`, all open PRs, this file, `AGENT_COORDINATION.md` and real deployment. Have tester check iPhone 13 Pro after a fresh PWA load: city selector Lisbon, three editorial routes, route start/save/resume, purple share, Places 30/page, photo proposal, map scroll. File precise issues for failures.
- Then pick **one** outstanding P0: I recommend the real venue photo-first coverage #176 versus new Start route cards #115, based on founder product priorities. Resolve PR #183 migration naming separately before any photo-bank release.
