# City Route — canonical release handoff after consolidation (2026-11-09)

**Read first in the next ChatGPT/Claude session.** This is a snapshot. GitHub `main`, current PR state, Cloudflare release checks and live Supabase remain authoritative. Product Owner instruction: **finish, verify and close current P0s before opening more feature branches.**

## 1. Consolidation finished — actual shipped code

- **Integrated release PR [#184](https://github.com/Zyczinho/city-route-app/pull/184)** — MERGED, squash `52fabc07e44a1124dfdd5d5770e762b8b7c57a1a`. It consolidates prior #151/#154/#143/#173/#166/#171/#164/#175/#125 and Lisbon data work from #181.
- **Lisbon content PR [#181](https://github.com/Zyczinho/city-route-app/pull/181)** — MERGED independently, squash `a737d971f3158114a90d04935ac9571869a3a8a4`. The source data and tests may overlap #184's included content; avoid duplicating imports or reverting the second squash.
- Latest confirmed application `main` SHA before updating this handoff: **`a737d971f3158114a90d04935ac9571869a3a8a4`**.
- GitHub Actions at both squash merge SHAs: **CI SUCCESS** and **Production rollout verification SUCCESS** (on #184: runs 42633744186 and 42633744254; on #181: 42634092269 and 42634091863).
- Previously overlapping or stale PRs #125, #143, #151, #154, #164, #166, #171, #173, #175, #177, #179, #180 are closed without individual merges. They are **superseded by #184** and should not be reopened or re-merged from stale heads. #182 was likewise a redundant release candidate.
- **Only two PRs remain open at this checkpoint:** #183 and #163.

## 2. Live hosted data — independently verified 2026-11-09

Read-only SQL on the connected **City Route App** Supabase project `ycfhpvtsnsmzdmpvliif` confirmed:
- Lisbon: **192 public place records and 3 published editorial routes**.
- Lisbon editorial stop counts: **6** / **9** / **8**:
  - `Lizbona po zmroku: bary, fado i klub` — 6.
  - `Lizbona pierwszy raz: klasyki w jeden dzień` — 9.
  - `Lizbona smakuje najlepiej z góry` — 8.
- These are City Route editorial / desk-researched routes, **not** community-authored and **not** field-tested. Never fabricate route ratings, visits, or social proof.
- Hosted presence is verified at database level. Real iPhone end-to-end route cards and navigation remain an independent acceptance test.

## 3. What is now included in production code

- Five-tab navigation (Variant D): Start / Trasy / Miejsca / Społeczność / Profil, contextual route bar.
- Planner V2 integration (do not confuse with separate hard exclusions).
- Places pagination (30/page).
- Route and place sharing, GPX/Strava export and Google Saved/Takeout import. Founder purple for share actions, blue for Save.
- Existing private/friend direct messages and in-app notifications preserved.
- Add Place automatic safe photo proposal; **exact-match photo coverage is still limited**.
- Lucide community icons, mobile touch improvements, one-finger map panning.
- Three editorial Lisbon routes and relevant catalogue updates.
- Corrected event/ticket placeholder handling.

**Do not claim each capability was manually verified end-to-end on real iPhone solely from green CI.**

## 4. Outstanding work (strict backlog and gates)

| Priority | Issue / PR | Actual status | Next required verification |
| --- | --- | --- | --- |
| P0 | [#176](https://github.com/Zyczinho/city-route-app/issues/176) — true place photography, descriptions, ratings | **OPEN**. Cover images and safe Add Place proposal are not full place-photo coverage | Audit Lisbon curated first 30 real place photos (identity/rights/credit); reliable persistence and fresh/reload, honest source ratings; no generic fake venue imagery |
| P0 | [#115](https://github.com/Zyczinho/city-route-app/issues/115) — routes-first Start page | **OPEN**. Five-tab navigation is shipped but does not equal the agreed Lisbon Start recommendation screen | After photo and route QA: visible 3 editorial routes, accurate cards/authors, Start → route detail → Start route, 320/375/390px/iPhone |
| P0 QA | Real iPhone Safari/PWA | **NOT YET VERIFIED** | Cold load, cache refresh, change city, route save, route start/continue, map gesture, share purple, profile collection, sign-in/DM; record evidence |
| P1 | [#172](https://github.com/Zyczinho/city-route-app/issues/172) — negative preferences | **OPEN**, not shipped in Planner V2 | Implement after runtime stable with exact hard exclusions, tests |
| Independent | [#183](https://github.com/Zyczinho/city-route-app/pull/183) — accepted Commons photo bank | **OPEN DRAFT**; CI green but security/RLS + real contributor/moderator test required | Do not merge until independent RLS review, real photo rights + storage persistence verification; DB migration 027 conflicts numbering with existing Lisbon editorial seed numbering and must be reconciled |
| Independent | [#163](https://github.com/Zyczinho/city-route-app/pull/163) — real closed-app Web Push | **OPEN**; not verified on actual closed iPhone | VAPID/HMAC, RLS/security, real opt-in and delivery acceptance before merge |

## 5. New work policy — prevent multi-branch chaos

1. **No new feature branch while an in-progress P0 has no accepted result**. New ideas go to one prioritized Issue backlog.
2. **One main runtime writer** for `app.js`, `styles.css`, `scripts/build.mjs`, `service-worker.js` and core nav/planner. Parallel research or content tasks must be file-isolated.
3. **Issue first**, clear acceptance and owner; one feature = one short-lived PR against latest `main` (no nested stacked PRs).
4. Do not merge a draft or a PR with unresolved BLOCKER. On exact head: tests, build, relevant browser mobile smoke, rights/security gate. Record regression findings in PR once, not in chat-only notes.
5. Merge **one PR at a time**, verify `main` CI / Cloudflare production, do a device/hosted data smoke, then mark the Issue DONE with links and observed result.
6. Distinguish **implemented**, **merged**, **deployed**, **tested on device**, **data published** and **user validated**.
7. No destructive DB action and no paid provider flag without explicit owner approval. Keep migrations additive. Preserve existing user state and separate private/public place photos.
8. A next agent must query current GitHub and current Supabase before taking a stale action in this document.

## 6. Instructions for the next conversation

> We have completed the 2026-11-09 City Route PR consolidation. Start from `Zyczinho/city-route-app` latest `main`, read `docs/RELEASE_LOCK_CITYROUTE_2026-11-09.md`, `AGENTS.md`, `DECISIONS.md`, `AGENT_COORDINATION.md`; verify current open PRs/CI/Cloudflare and hosted Supabase. **Do not restart PR #151/#154/#143/#173/ #181**. First finish real iPhone/PWA release QA and the highest-priority P0 (#176 exact place photography); then #115 routes-first Start. Keep #163 Web Push and #183 photo bank separate until independent security/real-device checks. Use one owner/one branch/one deployable increment and always update GitHub handoff. Do not say DONE without real verification.

## Canonical production URL

https://city-route-app.jakublojek.workers.dev

**Interpretation:** this release consolidation is complete, but the City Route MVP as a product still has open P0 acceptance gates (photo-first catalog and routes-first Start). Do not blur those statuses.
