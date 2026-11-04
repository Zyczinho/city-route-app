# Agent Coordination — canonical control plane

This file is the **single source of truth for agent coordination** in City Route App.

Chat messages, old prompts and session memory are advisory only. Before doing implementation or review work, ChatGPT and Claude must reconcile them with the current `main`, this board, open PRs, reviews and CI. If an old instruction conflicts with the current board or a merged dependency, the current repository state wins.

The purpose of this file is to let agents coordinate directly through GitHub so Jakub does not have to act as a message router between them.

## COORDINATION BASELINE — 2026-11-03, `main` @ `0d23fb9`

A full synchronization audit (Claude, 2026-11-03) reconciled this board with GitHub. At `0d23fb9`:

- `npm test` passed 122/122.
- `npm run build` was OK.
- The PGlite harnesses for 011 and 012 passed.

**From this baseline on, no earlier chat message, prompt or agent memory can reactivate a task by itself.** Before any work, every agent reconciles with this board, current `main`, and the open PRs, reviews and CI on GitHub. Older instructions are historical context only.

## Mandatory sync before any work

Before starting, resuming or reviewing a task, every agent must:

1. Sync/read current `main`.
2. Read this file from `main`.
3. Check open PRs, their current heads, latest review comments and CI state.
4. Check the task's dependencies and owned files/scope.
5. Reconcile stale board facts with GitHub. Mechanical GitHub facts (merged/open/head/CI) override stale text here; product decisions/spec requirements in the current board/specs override old chat prompts.
6. Only then decide whether to continue, review, start, block, supersede or close work.

**No agent may start coding solely because an earlier chat message said to do so.** The task must still be actionable according to this board.

## Status vocabulary

Use only these task statuses:

- `BACKLOG` — known work, not yet actionable or prioritized.
- `READY` — dependencies satisfied; may be claimed.
- `IN_PROGRESS` — one agent owns active implementation.
- `BLOCKED` — cannot proceed until the listed dependency/decision is resolved.
- `REVIEW` — implementation complete; waiting for the named reviewer or required verification gate.
- `CHANGES_REQUESTED` — review found blockers; ownership returns to the implementation owner.
- `MERGE_READY` — required review is clean and CI is green; waiting only for merge/approved release action.
- `DONE` — merged/completed and no further action remains.
- `SUPERSEDED` — no longer needed because another change/decision replaced it.
- `ESCALATE` — genuine product/architecture decision required from Jakub.

## Task selection order

When an agent is asked to continue or take the next task, use this priority order:

1. `CHANGES_REQUESTED` tasks owned by that agent.
2. `REVIEW` tasks where that agent is the reviewer.
3. Existing `IN_PROGRESS` tasks owned by that agent.
4. Highest-priority `READY` task assigned to that agent or currently unowned.
5. Only then consider `BACKLOG`.

Never start a `BLOCKED`, `DONE` or `SUPERSEDED` task.

## Claiming and ownership

- One implementation task has one implementation owner at a time.
- A separate reviewer may be named.
- Before writing code for a `READY` task, update this board to `IN_PROGRESS` with owner, branch and `last_update`.
- Do not edit files owned by another active package unless the board explicitly allows shared ownership.
- Two tasks may run in parallel only when dependencies allow it **and** their implementation scopes do not conflict.
- If two tasks become overlapping after new information, the later/lower-priority task becomes `BLOCKED` or `SUPERSEDED` before more code is written.

## Handoff and stale-work rule

An `IN_PROGRESS` task must leave a recoverable GitHub checkpoint: branch, commit or PR plus a clear `next_action`.

A second agent may take over only after checking the branch/PR activity and updating the board with the takeover reason. Do not infer abandonment from an ended chat session alone.

Checkpoint format when a session/credit limit may interrupt work:

`CHECKPOINT — <ID> — owner — branch/PR — completed: ... — next: ... — blocker: ... — last_update: YYYY-MM-DD HH:MM UTC`

## Review protocol

- Maximum two full cross-review cycles per package unless new code materially changes the reviewed scope.
- A targeted retest after a mechanical fix does not require a new full review cycle unless it exposes a new material issue.
- Reviewer findings move the task to `CHANGES_REQUESTED` and name the exact owner/next action.
- A clean required review plus green CI moves the task to `MERGE_READY`.
- After another PR merges into `main`, any still-open PR must re-check mergeability/CI and sync if necessary before merge.

## User decision boundary

Agents should make ordinary implementation decisions autonomously. Use `ESCALATE` only for a real product choice, materially different architecture, destructive/irreversible action, credentials/secrets, production DNS, or hosted database migration/deployment that requires explicit approval.

Template:

`[ESCALATE] <ID> — decision needed — Option A / Option B — recommendation — why Jakub must decide`

## Active board

Code status and hosted-database status are tracked as **separate rows**: "migration merged" never means "migration applied".

| Priority | ID | Status | Owner | Reviewer | Depends on | Branch / PR | Next action | Last update |
| P0 | COMMUNITY-DETAIL-FREEZE-044 | DONE | ChatGPT | GitHub CI + mobile regression smoke | Supabase HTTP 200; isolated infinite MutationObserver loop; Workers production build success, mobile Playwright route interaction passed | PR #80 (app fix), #81 (test harness), #82 (cache assertions) | PWA v48 and UX script v3 deployed; full mobile smoke includes route detail and back navigation. Verify on real iPhone after refresh. No DB changes or route deletion. | 2026-11-04 |
|---|---|---|---|---|---|---|---|---|
| P0 | BETA-HOURS-AUTH-046 | REVIEW | ChatGPT (code complete) | Jakub — real-device beta + Google OAuth provider activation | PR #84 squash merged `362088c4c` to `main` on 2026-11-04; `npm test`, build, P0 375px browser smoke, Cloudflare Workers Build and production-assets all SUCCESS | PR #84, `main` @ `362088c4c` | Pilot date/start-time hours checked for five curated 2026 venues; unknown hours explicitly flagged; guest-first onboarding and Google OAuth frontend deployed, legacy password auth preserved. Remaining: real handset walkthrough, optional ongoing official-hours verification; Google Cloud OAuth client + Supabase provider credentials/redirect must be configured by owner before any real Google sign-in is possible. No paid API or DB migration applied. | 2026-11-04 |
| P0 | RELEASE-INTEGRATION-029 | REVIEW | ChatGPT | Jakub + first external testers | PR #69 **MERGED** squash `f3970ea` into `main` on 2026-11-04; migrations 014/015/016 manually applied in hosted Supabase | `main` @ `f3970ea`, PR #69 | Production Supabase verified: 275 places, 27 routes, 1 profile, 1 auth user, 1 admin unchanged; new `place_submissions`, `friend_connections`, `place_reviews` with RLS on (1/1/4 policies). Cloudflare Workers Builds **SUCCESS**, GitHub CI **SUCCESS**, Production rollout verification **SUCCESS** on `f3970ea`. Pending: REAL 2-account E2E beta testing of moderation, friends and reviews on hosted app; no off-device backup by founder choice; SQL Editor changes not recorded in Supabase CLI migration ledger (list_migrations empty). Release code is live, **do not re-run migrations or re-merge child PRs**. | 2026-11-04 |
| P0 | PLACE-COMMUNITY-019 | REVIEW | ChatGPT | Jakub + two testers | Shared submissions/moderation and no quota included through #69 | `main`, PR #69 merged | Migration 014 live; CI & isolated PostGIS/RLS PASS. Pending real hosted user A/user B submission owner privacy + admin approval + duplicate handling. Original #60 is historical; do not merge separately. | 2026-11-04 |
| P0 | INTEGRATION-018 | DONE | ChatGPT | GitHub CI + Chromium Playwright (without Claude) | 174/174 tests, build, mobile 375px, all 5 tabs, nearby B→B1, add place + rating, offline PWA and v33→v35 upgrade, fresh production smoke; Cloudflare main build SUCCESS | PR #59 squash merged to `main` at `57c2b3a` | All integrated code and product specs in main; no more PR #57/#58/#55 work. Production asset version check tracked by new GH workflow. Paid Google autocomplete stays disabled. | 2026-11-03 |
| P0 | ROUTE-OPT-016 | DONE | ChatGPT | GitHub CI + Chromium Playwright | PR #59 browser-tested at 375px; original PR #57 superseded/closed | PR #59 merged `57c2b3a` | Exact shortest estimated-distance ordering <=12 stops; heuristic >12; nearby insert-after. True road-time routing is separate P1 ROUTING-TIME-020. | 2026-11-03 |
| P0 | CLAUDE-PLACE-017 | DONE | Claude (implementation only) | ChatGPT + GitHub CI | PR #58 stale-coordinate issue fixed; integration 174/174 + browser passed; issue #56 closed | PR #59 merged `57c2b3a`; #58 closed | Feature done; no additional Claude calls needed. Community-shared contributions still require P0 PLACE-COMMUNITY-019. | 2026-11-03 |
| P0 | PWA-RECOVERY-009 | DONE | ChatGPT | GitHub CI + browser | PR #54 merged, live pre-release fresh mobile startup and all five tabs verified; simulated installed SW cache v33→v35 passed; Cloudflare main release check successful | PR #54, final regression in PR #59 | Recovery complete in automated QA. Founder can still report device-specific caching issues if seen. | 2026-11-03 |
| P0 | NAV-HOTFIX-008 | DONE | ChatGPT | GitHub CI + browser | PR #53 merged, subsequent PWA recovery PR #54, fresh 5-tab startup verified at 375px | PR #53 + #54 + #59 | No further nav work; monitor regressions via permanent browser QA. | 2026-11-03 |
| P1 | ONBOARDING-021 | DONE | ChatGPT | GitHub CI + 375px Playwright | Existing `#about` screen and UX-CLEANUP-007 on `main` | PR #61 squash merged at `055b171` | `#about` now acts as concise clickable guide; entry visible above planner and from Profile. 174/174 tests, build, 375px mobile browser smoke, offline PWA upgrade, GitHub production-assets and Cloudflare Workers production build all GREEN. No more ONBOARDING-021 work. | 2026-11-03 |
| P1 | ROUTE-CHOICES-022 | DONE | ChatGPT | GitHub CI + 375px browser QA | ONBOARDING-021 DONE; local deterministic generator | PR #62 squash merged `fae36a3` | Three selectable diverse options, reroll with same constraints, no change to manual basket or Supabase. `npm test`, `npm run build`, 375px Playwright (select/refresh/manual), Cloudflare main production build and production-assets verification all GREEN on 2026-11-03. No further code work. | 2026-11-03 |
| P1 | COMMUNITY-HUB-023 | DONE | ChatGPT | GitHub CI + 375px Playwright | Existing group chat schema + authenticated membership; no DB migration | PR #63 squash merged `23c1202` | Four Community subtabs: Trasy, Grupy, Czaty (joined-group conversations), Zapisane. Reuses prior group/chat backend, legacy Profile deep links remain. 179/179 tests, build, 375px mobile browser, production Cloudflare build and `production-assets` all GREEN on 2026-11-04. Authenticated two-account chat exchange still belongs to SOCIAL-PROD-SMOKE-005 acceptance, not falsely marked complete here. | 2026-11-04 |
| P1 | LIVE-ROUTE-025 | DONE | ChatGPT | GitHub CI + 375px Playwright | Existing local placeReviews, route ratings and publish RPC | PR #65 merged `41e1ed0` | Optional local place rating after every arrival, skip rating, reviewed route author CTA, prominent publication of exact completed session stops without replacing basket. 181/181 unit tests, browser smoke, production Cloudflare and production-assets GREEN. Future global City Route place ratings require own DB schema and arrival validation. | 2026-11-04 |
| P1 | FRIENDS-026 | REVIEW | ChatGPT | Jakub + two testers | Friend invites and unique nicknames included via #69 | `main`, PR #69 merged | Migration 015 live; RLS enabled. Pending real two-account invite/accept/remove + unique casefold nick acceptance. Original #66 is historical; do not merge separately. | 2026-11-04 |
| P1 | REVIEWS-027 | REVIEW | ChatGPT | Jakub + two testers | Independent City Route scores/private route feedback included via #69 | `main`, PR #69 merged | Migration 016 live, RLS enabled; real two-account private feedback acceptance pending. Google/Tripadvisor auto import is NOT implemented (issue #70). Original #67 is historical; do not merge separately. | 2026-11-04 |
| P0 | MAP-SCROLL-037 | DONE | ChatGPT | GitHub CI + 375px Playwright + Cloudflare production-assets | PR #74 deployed; touch-scroll UX issue reported 2026-11-04 | PR #75 squash merged `ca38fbd` to `main` | Mobile map max 410px, 16px inset, page-scroll-first/touch pan toggle; Leaflet z-index isolated below fixed nav; PWA v43. PR CI and full 375px browser smoke green; main CI and production rollout verification SUCCESS 2026-11-04. Optional real-phone UX confirmation, no remaining code blocker. | 2026-11-04 |
| P0 | PLACES-UX-038 | DONE | ChatGPT | GitHub CI + 375px Playwright + Cloudflare production-assets | PR #75 DONE; founder mobile UX audit | PR #76 squash merged `9028d79` to `main` | Mobile UX consolidated: clickable My Places stat, own unbookmarked places retrievable, separate Community Saved Places, nightlife/activity category picker, smart local suggestions, licensed seed/provider photo previews, single primary add CTA, gentle bookmark/route icons, smaller map popup; PWA v44. PR CI and 375px browser smoke SUCCESS. Main CI and Cloudflare rollout verification SUCCESS 2026-11-04. Full catalog photo coverage tracked separately in PHOTO-COVERAGE-039. | 2026-11-04 |
| P0 | PHOTO-COVERAGE-039 | READY | Unassigned | Jakub + ChatGPT — photo licensing and accurate place identity | PR #76 DONE; 50 curated static places (up to 45 reuse-eligible via Commons/Pexels) | new scoped branch, not started | Audit missing images among live 275 Warsaw places, prioritize highly viewed restaurants/bars/clubs and user suggestions, match exact place+location, acquire licensed/permissioned photos with credits or real authorized provider previews. Never substitute unrelated stock and do not store provider images against terms; report actual coverage. | 2026-11-04 |
| P1 | COMMUNITY-SAVED-NAV-040 | DONE | ChatGPT | GitHub CI + 320/375px Chromium Playwright + production rollout verification | PR #76 DONE; founder 2026-11-04 feedback | PR #77 squash merged `88a0d56` to `main` | Community main nav has 5 tabs (Trasy, Grupy, Czaty, Znajomi, Zapisane); Saved opens local Miejsca by default, nested Trasy/Miejsca switch preserves legacy links, routes remain auth-gated. PWA cache v45. Unit CI, 320/375px browser smoke, main CI and Cloudflare production assets verification all SUCCESS on 2026-11-04. No rating/card redesign in this scope. | 2026-11-04 |
| P0 | CUSTOMER-AUDIT-FIX-041 | REVIEW | ChatGPT | Jakub — visual QA; founder review before hosted nightlife import | Audit 18/18; hosted Supabase verified Warsaw 50 (10 hotels) + Krakow 225 = 275, no data loss | PR #78 squash merged `7ea37fd` to `main` | Mobile 320px top avatar overflow fixed; 330–460px map with scroll-first gesture; Google/Tripadvisor micro-sources in cards and City Route when rated; best aspect/resolution Google photo among official candidates; rights-verified attributed website/social candidate support; official page/Instagram/Facebook URL field for moderated contributions; no scraping; four real Warsaw nightlife venues staged in `scripts/seed-warsaw-nightlife-20261104.sql`, NOT applied to hosted DB. CI, 320/375px Chromium smoke, Cloudflare Worker diagnostic, main CI and production rollout verification all SUCCESS 2026-11-04. Remaining: publish validated nightlife rows separately, user-facing actual-photo approval/coverage, real provider keys and two-account beta smoke. | 2026-11-04 |
| P1 | EVENTS-DISCOVERY-042 | DONE | ChatGPT | GitHub CI, 375px/320px Playwright, main production asset verification | Founder 2026-11-04; PR #77 saved-grid and #78 audit changes deployed | PR #79 squash merged `9e0f7ec` to `main` | Community now exposes a prominent Events and group walks shortcut outside five-tab grid; `#events` Globalne/Społecznościowe works, current social event functions correctly labeled not yet live, Polish Warsaw/Krakow locative fixed; PWA v47. Unit CI, mobile smoke, main CI and production rollout verification SUCCESS 2026-11-04. No hosted schema updates. | 2026-11-04 |
| P0 | EVENTS-SOCIAL-MVP-043 | READY | Unassigned | ChatGPT + Jakub — two-account acceptance and admin moderation | Founder 2026-11-04 requirement: member-led live walks, meetups, parties and authentic interest/likes/recommend counters; visible navigation PR #79 DONE | `COMMUNITY_EVENTS_MVP.md`; implementation branch TBD | Build forward-only 017 events/RSVP/reactions schema with RLS and moderation; create/list/detail, interested and going exclusive per user, unique likes and recommendations, organizer-started live linked walk (no implicit location tracking); ensure 320px UI, cancelled-event semantics, two-account production smoke. Separate from Ticketmaster public feed. Do not claim live until hosted migration, tests and two real accounts pass. | 2026-11-04 |
| P0 | FRIEND-BETA-SMOKE-030 | READY | Jakub + ChatGPT | First 5–8 testers | PR #69 production release successful | no implementation branch | Test signup from external device, onboarding, route planning, Friends invite/accept, shared place submission, 2-account privacy/moderation, place/route feedback. Capture screenshot/repro of failures; use GitHub issues. **Do not spin new features before beta feedback**. | 2026-11-04 |
| P1 | PROVIDER-RATINGS-SYNC-031 | REVIEW | ChatGPT | Jakub — Google Places billing/key, Tripadvisor Terra partner credential | official paid API access; provider contract, hard quotas | PR #73 MERGED `ee77f06`; issue #70 | Live endpoint + UI supports on-demand official Google/Tripadvisor ratings/number of opinions plus optional text snippets with attribution; API integration code tested. **Actual provider API connection in production NOT VERIFIED**; Google paid key and Tripadvisor partner key must be configured in Cloudflare. Text review flags default OFF. Google/TA ratings separate from City Route violet score. | 2026-11-04 |
| P1 | PLACE-AUTO-PHOTO-032 | REVIEW | ChatGPT | Jakub — verify live authorized photos and licensing | provider keys and permissions | PR #73 MERGED `ee77f06`; issue #71 | Newly added local and newly approved shared places lazily fetch matching provider images with attribution when official API credentials are enabled; user-owned photo preferred; placeholder otherwise. Real production provider image test still pending credentials and terms. | 2026-11-04 |
| P1 | PLACES-SAVED-033 | DONE | ChatGPT | GitHub CI/mobile smoke | PR #73 MERGED `ee77f06` | `main`, issue #72 | Miejsca now shows Zapisane directly after Wszystkie; bookmark/unbookmark list/detail and auto-saved newly added place; saved IDs local to current browser/city; 375px Playwright acceptance, PWA and CI green. Cross-device sync is not implemented. | 2026-11-04 |
| P0 | RELEASE-PLACES-035 | REVIEW | ChatGPT | Jakub — live provider API credentials and visual acceptance | PR #73 merged, no database migrations | `main` @ `ee77f06` | Production Cloudflare Workers Builds/Production rollout verification and GitHub CI succeeded 2026-11-04. Implemented Saved tab, purple independent City Route score, on-demand provider ratings+photos, opt-in Google/Terra textual reviews. All code tests and 375px browser smoke passed. Need real authorized API integration test, Google Enterprise billing, Tripadvisor Terra partnership, and enable optional review snippet flags if desired. No raw provider reviews persisted. | 2026-11-04 |
| P0 | PROVIDER-BETA-ACTIVATION-036 | IN_PROGRESS | ChatGPT | Jakub — own Google Cloud and Tripadvisor accounts | PR #73 live; APIs require external access | `work/provider-activation-content-api-20261104` | Add Tripadvisor self-serve Content API alongside licensed Terra; verify mock end-to-end local place → source ratings/photo → bookmark; tighten Worker default off/quotas and document admin steps. No credential or cloud billing access through connectors; **cannot claim real API live until account owner configures keys and upstream caps**. | 2026-11-04 |
| P1 | SUPABASE-MIGRATION-LEDGER-034 | BACKLOG | Unassigned | ChatGPT + Jakub | Decide CLI managed strategy after beta | `main`, manual SQL 014–016 | The three hosted migrations were run through SQL Editor and are NOT in the Supabase migration ledger; reconcile before any CLI db push to avoid replay. No hosted schema changes for this task until scoped. | 2026-11-04 |
| P1 | ROUTING-TIME-020 | BACKLOG | unassigned | ChatGPT | ROUTE-OPT-016 DONE; evaluate real pedestrian/transport time matrices, pricing, opening-hours constraints | no branch | Optional future: replace straight-line estimates with real network travel-time optimization; validate cost and data attribution before provider setup. | 2026-11-03 |
| P1 | UX-CLEANUP-007 | REVIEW | ChatGPT | Jakub (visual) | PLAN-UI-MOBILE-006 DONE; SOCIAL-RUNTIME-004 DONE | PR #50 merged to `main` at `da82633` | Code merged 2026-11-03 16:30 UTC; founder to verify actual production deploy and visual UX on desktop/mobile. Mark DONE after that acceptance. | 2026-11-03 |
| P1 | REQ-ADMIN-004 | DONE | Claude | ChatGPT | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE | PR #44 + fix PR #48, merged to `main` at `d9eb8e8` | No code action. Hosted migration is tracked separately below. | 2026-11-03 |
| P1 | REQ-UI-003 | DONE | ChatGPT | Claude | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE; SOCIAL-RUNTIME-004 DONE | PR #47 merged to `main` at `58694df` | Claude targeted re-review was CLEAN; no further code action. | 2026-11-03 |
| P1 | PLAN-UI-MOBILE-006 | DONE | ChatGPT | Claude | REQ-UI-003 DONE | PR #49 merged to `main` at `c9d2681` | No code action. Claude review CLEAN; post-sync cache hardening and GitHub CI #143 were green before merge. | 2026-11-03 |
| P1 | SOCIAL-PROD-SMOKE-005 | READY | ChatGPT + Jakub | Claude | SOCIAL-RUNTIME-004 DONE; production deploy of `09dad87` confirmed | no branch | Two-account production smoke: publish → feed → author → save → saved list → mobile nav. | 2026-11-03 |
| P2 | MIGRATION-013-HOSTED | DONE | Jakub | — | REQ-ADMIN-004 DONE | merged PR #48 + hosted Supabase | Migration 013 applied to hosted Supabase and founder admin allow-list entry confirmed in SQL Editor. No further migration action. | 2026-11-03 |
| P3 | INFRA-CF-PREVIEW-001 | BACKLOG | Jakub | — | Cloudflare dashboard access | — | Workers preview builds fail on PR branches while `main` builds succeed. Treat GitHub `test` as required CI until preview configuration is fixed. | 2026-11-03 |

## Current package facts

### CLAUDE-PLACE-017 — draft PR #58 — REVIEW (ChatGPT)

`CHECKPOINT — CLAUDE-PLACE-017 — Claude — claude/place-composer-017 / PR #58 — completed: composer UI + model, city-aware geocode/maps-preview/enhancements, Worker suggest/details, Photon lang fix, Google photo copy removed, 164/164 tests, build OK, 375 px browser check Warsaw + Kraków — next: ChatGPT review; ChatGPT integration items in PLACE_COMPOSER.md (app.js rating, post-save CTA, SW precache) — blocker: none for review; merge waits for PWA production smoke; Google Autocomplete needs Jakub's paid-usage approval — last_update: 2026-11-03 19:20 UTC`

### PWA-RECOVERY-009 — PR #54 CI #160 green, merge ready, production confirmation pending

- Founder screenshot still shows `Wczytujemy miasto…` and only Community on existing browser; #53 changed nav code but did not bump SW cache v32 / nav URL v2.
- Browser may continue to use the cached, pre-hotfix navigation module and HTML; underlying issue requires independent early SW update + new cache + URL version, while preserving localStorage and routes.
- Network-first navigation so future HTML updates do not remain stuck on old app shell.
- Production validation and old-installed-PWA update test required to call DONE. No new migrations or catalogue edits.



### NAV-HOTFIX-008 — PR #53 merged; production smoke failed and follow-up PR #54 required

- Founder screenshot following Cloudflare Ready: initial loading screen never resolves and bottom nav only shows Społeczność.
- Root cause isolated in `nav-enhancements.js`: MutationObserver calls `enforceBottomNav`, which appends the same links unconditionally and queues itself indefinitely. `navSyncing` is reset before callbacks run, so guard is ineffective against microtask re-entry.
- Fix only that module and a focused runtime regression test; release must be visually smoke-tested on production before marking DONE. Supabase unaffected. Separate P0 catalogue branch remains independent.



### UX-CLEANUP-007 — PR #50 — merged, visual production acceptance pending

- Founder feedback from production screenshots: add a dedicated **Społeczność** tab, reduce the oversized/raised `Moja trasa` treatment and make the planner substantially calmer than PR #49 achieved visually.
- Bottom navigation now has five entries: Ułóż trasę, Trasy, Moja trasa, Społeczność, Miejsca. Społeczność reuses the existing Social Routes feed instead of duplicating backend/data logic.
- `Moja trasa` remains visually central but uses a smaller negative margin, thinner border and smaller shadow so it stays inside the navigation composition.
- Planner first view is intentionally minimal: time, collapsed `Klimat trasy`, collapsed `Więcej ustawień`, one `Ułóż trasę` CTA, then two small alternative links. Existing form names/defaults and generator semantics are preserved.
- Visible cleanup copy avoids the founder-disliked long AI-style dash punctuation.
- Delivery is explicit through `ux-cleanup.js?v=1`, `ux-cleanup.css?v=1`, `nav-enhancements.js?v=2` and service-worker cache v32.
- GitHub CI #147 passed `npm test` and `npm run build` on head `20fcf42` before this board-only commit. Next gate is founder visual acceptance, not another Claude review.

### REQ-ADMIN-004 — PR #44 + fix PR #48 — DONE

- #44 merged to `main` at `47d48a5` before its cycle-1 blocker was fixed.
- PR #48 fixed `added` without a linked place and merged at `d9eb8e8`.
- Migration 013 is safe in code and has now been applied to hosted Supabase; founder admin access was confirmed manually in the SQL Editor.

### REQ-UI-003 — PR #47 — DONE

- Claude cycle 1 found one blocker in `maybeOpenResolvedPlace()`.
- ChatGPT fixed it as one-shot and city-scoped, with no repeated Places filter reset when the place is missing.
- Claude's targeted low-credit re-review was CLEAN.
- PR #47 merged to `main` at `58694df`.

### PLAN-UI-MOBILE-006 — PR #49 — DONE

- Product direction: **simple by default, powerful when expanded**.
- Time + interests stay primary; transport, food, start, budget, sightseeing style and partner offers move behind `Dopasuj szczegóły` with a compact selected-values summary.
- No generator/backend/Supabase/request/social contract changes.
- Claude review was CLEAN for semantics, idempotence, value preservation and progressive disclosure.
- After #47 merged, #49 was synchronized with current `main`.
- Delivery hardening is explicit: `enhancements.js?v=22` and service-worker cache v31, so installed clients refresh the shell rather than depending on Cloudflare/browser revalidation behavior.
- Five legacy cache-version assertions were mechanically updated from v30 to v31. GitHub CI #142 and final board-only CI #143 were green.
- PR #49 merged at `c9d2681`.

## Database / hosted state

| Migration | Code on `main` | Applied to hosted Supabase | Evidence |
|---|---|---|---|
| 007–010 | yes | yes | earlier board records |
| 011 | yes | yes, 2026-11-03 | social RPCs answer on hosted |
| 012 | yes (PR #43) | yes, 2026-11-03 | hosted read-only request RPC check succeeded |
| 013 | **yes, fixed on `main` via PR #48** | **yes, 2026-11-03** | Jakub ran 013 in hosted Supabase and confirmed the founder row in `public.app_admins` via SQL Editor |

## Recently completed

- `MIGRATION-013-HOSTED` — DONE — migration 013 applied to hosted Supabase on 2026-11-03; founder admin row confirmed in SQL Editor.
- `PLAN-UI-MOBILE-006` — DONE — PR #49 merged at `c9d2681`; Claude review CLEAN; cache delivery hardened to v22/v31.
- `REQ-UI-003` — DONE — PR #47 merged at `58694df`; Claude targeted re-review CLEAN.
- `REQ-ADMIN-004` — DONE — PR #44 + fix PR #48; final blocker fixed and merged at `d9eb8e8`.
- `SOCIAL-RUNTIME-004 + NAV-MYROUTE-001` — DONE — PR #42 merged at `09dad87`; production smoke remains separate.
- `COORDINATION-RESET` — DONE — PR #45 baseline `0d23fb9`.
- `REQ-DATA-002` — DONE — PR #43; migration 012 hosted DONE.
- `REQ-SPEC-001` — DONE — PR #41.
- `SOCIAL-DATA-003` — DONE — PR #40; migration 011 applied.
- `SOCIAL-SPEC-001` — DONE — PR #39.
- `MAP-PROD-SMOKE-006` — DONE.
- Route Builder / map / covers packages through PR #38 — DONE.

Historical closed/superseded branches and PRs stay as history unless a current task explicitly needs cleanup.

## End-of-task update requirement

Before an agent reports completion to Jakub, it must update this board if the task state changed. At minimum update status, owner, reviewer when applicable, branch/PR, next action, last update and dependency changes. If work is no longer needed, mark `SUPERSEDED` with the reason instead of silently abandoning it.
