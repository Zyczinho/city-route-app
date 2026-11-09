# City Route — release freeze and next-conversation handoff (2026-11-09)

**Authoritative:** latest GitHub `main`, open PR state, CI, deployed Cloudflare version and hosted Supabase. Do not treat this document or prior conversations as a substitute for live verification. This document records the Product Owner's instruction: **finish and integrate existing work before starting new features**.

## One release candidate

**PR #184:** https://github.com/Zyczinho/city-route-app/pull/184  
**Branch:** `work/cityroute-release-clean-20261109` based on the actual current main. It is the **single release train**. Original implementation branches must not be separately merged until #184 has been reviewed and successfully released. Preview-only PR #177 / #180 and redundant #182 are not release paths.

Integrated on the release candidate, each previously passing independently:
- #151 + #154: GPX, approved sharing paths, Google Saved/Takeout CSV import, 30 Places per page, route sharing in all states.
- #143: Planner V2 and transit leg workaround.
- #173: five navigation destinations **Start / Trasy / Miejsca / Społeczność / Profil**, contextual Moja trasa bar and Profile collections.
- #166: safe automatic default photo proposal in Add Place.
- #171: Lucide tabs in Community (retains `send` in icon allowlist).
- #164: iPhone native-sized touch targets.
- #175: one-finger map interaction with 20px page-scroll gutters; old tests reconciled.
- #181: three **editorial, desk-researched** Lisbon routes: nightlife, first-time classics, food/viewpoints; 23 route-stops, 4 editorial essential places, 19 enriched existing stops and 3 credited Commons covers.
- #125: event/Ticketmaster placeholder text fixed.
- Founder-purple (`--cr-community`) **Share** controls; blue remains for Save.
- Forward-only, idempotent data seed: `supabase/migrations/027_seed_lisbon_editorial_routes.sql`. Read-only/rollback dry-run on hosted City Route Supabase resulted in **3** Lisbon public editorial routes and **192** places **inside the test transaction**, with a verification query confirming hosted data stayed at **0** Lisbon editorial routes afterward. It has **not** yet been applied.

## Exclusions / not resolved by this release

- #163 real Web Push on a closed iPhone: backend portions previously staged, **real VAPID/HMAC and delivery not verified**. Do not merge with #184.
- #179 illustrative photo fallback: draft; cannot substitute for correct real venue photography. Issue #176 still owns real place-photo coverage, real descriptions and provider ratings.
- #172 planner hard category exclusions are not included; depend on stable Planner V2.
- #115 new Start screen showing personalized community/editorial route cards is a **future P0**; five-tab navigation alone does **not** implement the full redesigned Start.
- Social routes require real community authors. The three Lisbon routes must be clearly labeled *City Route editorial*, never as user-tested or community-created.
- Real iPhone Safari/PWA smoke remains separate from Chromium automation; do not call it completed without evidence.
- Real hosted Google/Tripadvisor ratings and photographs require rights, source checks and credentials; no paid API is switched on.

## Release gate / the only authorized workstream

1. On the exact head of #184: `npm test`, `npm run build`, P0 browser/mobile smoke, Cloudflare Worker diagnostic and no-paid-provider diagnostic **all green**. Resolve real blockers, do not weaken important checks.
2. Independent review security + state restoration: login, DMs, sharing of public/private places, archived routes, provider flags, Save purple/blue distinction, cache/route resume.
3. Confirm preview on 320/375/390 px and real iPhone Safari or record untested risk honestly.
4. Merge #184 (one merge, not child PRs) to `main` with SHA guard. Verify Cloudflare production deploy SHA, PWA assets and smoke.
5. Apply migration 027 **only after** PR is approved/merged and source review; verify 3 editorial Lisbon routes, 192 places, exact 6/9/8 stop counts and public RPC visibility. **No cleanup or deletion of user data.**
6. Close overlapping source PRs as `SUPERSEDED` with the released PR link **only after** production verification. Do not close still-unreleased #163/other genuinely independent work as 'done'.
7. Update this document to show release SHA, production deploy result, hosted seed result and open blockers.

## Freeze policy for following agent and chats

- Start by reading `AGENTS.md`, `DECISIONS.md`, this handoff, `AGENT_COORDINATION.md` and current PR/CI/production evidence.
- **One runtime writer:** release integrator owns `app.js`, `index.html`, `scripts/build.mjs`, `service-worker.js`, `share-links.js`, `styles.css` until release is complete.
- No new UX redesign, monetization, social expansion or external integration branch until #184 release is resolved. Restrict parallel effort to review/QA and licensed place-photo/content curation in isolated files.
- Do not assume 'CI green' means deployed, and do not assume 'merged SQL' means applied to hosted Supabase.
- Next conversational goal: **stabilize and verify the release**, then choose exactly one new P0 issue.

## Concrete baseline prior to merge

As checked during consolidation:
- Current `main` source commit before this release: `225e55f03d58be503d59f1e1860de4a5e73828da`.
- Hosted City Route Supabase before 027: Lisbon 188 public places and 0 public routes, Warsaw 308 public places/12 editorial routes, Kraków 208 places/16 routes.
- Browser preview/Cloudflare deployment of #184 must be rechecked after its final commit. Never claim live rollout from a branch preview alone.
