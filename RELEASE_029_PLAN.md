# City Route — release 029, integracja PR #60 + #66 + #67 + #68

**Status:** Candidate / NOT LIVE. DRAFT PR #69. Branch `release/integrate-shared-community-20261104`.
**Production release gate:** Explicit product-owner approval after CI, production DB preflight and authenticated acceptance tests. **Do not merge this draft to main or run migrations against hosted Supabase merely because they passed isolated CI.**

## Cloudflare Preview diagnosis — 2026-11-04

**Confirmed: the Worker compiles.** GitHub Action [Cloudflare Worker build diagnostic](https://github.com/Zyczinho/city-route-app/actions/runs/41808900973) succeeded on PR #69 using Node 22, `npm run build`, and `npx --yes wrangler@4 deploy --dry-run --outdir /tmp/city-route-worker-build`. Wrangler **4.157.0** read **195** files from `dist/`, bundled Worker entrypoint and bound `ASSETS`. No Cloudflare credentials or actual deployment were used.

**Confirmed: Cloudflare Preview is still failing.** The latest [Workers Builds check](https://github.com/Zyczinho/city-route-app/pull/69/checks) reports FAILURE even though the dry-run and GitHub tests succeed. Previous feature PRs (#62, #63, #65–#68) likewise failed the Cloudflare non-production check, including docs-only #68, while several production `main` deployments succeeded. This strongly implicates the **Preview command/settings/permissions**, not a code compilation defect. It does **not** prove the precise platform error.

**Required before changing Cloudflare settings:** inspect the failed build's step log using the GitHub Cloudflare check's `Details → View logs` link (Cloudflare dashboard authentication required). Determine whether failure is from `npm run build`, `wrangler versions upload` vs `wrangler preview`, Wrangler minimum version (Worker Previews requires >=4.135.0), missing Preview bindings, CLI auth token, or resource configuration.

**Cloudflare UI controls (not changed here):**
1. Worker `city-route-app` → `Settings > Build` → confirm production branch = `main`, build command = `npm run build`; do **not** replace production deploy command `npx wrangler deploy`.
2. `Branch control`: verify whether Preview Builds are enabled and which preview model is active.
3. When Worker Previews is already active, Preview command should ordinarily be `npx wrangler preview` and the installed Wrangler version >=4.135.0. Preview-specific resources may need separate bindings/secrets. Cloudflare documents that switching a legacy Worker to Worker Previews is **irreversible**, so do not perform the switch without inspecting the build error and reviewing the preview environment.
4. Retry **only the failed Preview build** after correcting the confirmed setting. Verify a real preview URL and its requests; never infer preview success from a GitHub unit-test green check.

No production Cloudflare or Supabase changes were made for this diagnosis.

## Integrated features

| Origin | Code | Server dependency | Release notes |
|---|---|---|---|
| #60 | public place proposals, moderation, duplication guard, no per-user/day submission limits; unlimited private places | 014, shared places / request RPC | All public proposals pending until administrator action; publishing route rejects unapproved local stops |
| #66 | Community > Znajomi, case-insensitive unique nicknames, private mutual invitations | 015, `friend_connections`, nickname index | Preserve group chats and 5-item bottom navigation; 5 internal community tabs |
| #67 | independent City Route place rating and sorting, creator-only route feedback; source-adapter for authorised Google/Tripadvisor metadata | 016, place reviews + route feedback RPCs | **No** automatic Google/Tripadvisor API ingestion; no fake external or verified scores |
| #68 | four auditor persona Markdown files, versioned learning log, draft ranking model | none | **Documentation only**, no change to current recommendation engine |
| Existing main | onboarding, three proposed routes, saved routes, manual builder, live stop rating, finished-route sharing | existing API | Must not regress |

## Production preflight — read-only observations (2026-11-04)

- Connected Supabase project: `ycfhpvtsnsmzdmpvliif` (City Route), verified from current `supabase-config.js` previously.
- `public.place_submissions`, `public.friend_connections`, `public.place_reviews` **do not yet exist** (not migrated).
- `public.profiles`, `public.places`, `public.routes`, `public.route_ratings`, `public.catalogue_requests`, `public.cities`, `public.app_admins` exist with needed source columns.
- Existing profiles: **1**; case-insensitive trimmed nickname collision groups: **0** on preflight.
- Supabase MCP `list_migrations` returned **empty history** while existing schema has migrations 001–013-era tables. This likely reflects manual/SQL-editor application. **Do not assume no schema is installed or replay migrations 001–013.** Compare current schema and function signatures to SQL files before migrating and record deployment provenance separately.
- Supabase security advisor found pre-existing warnings (e.g. function `set_updated_at` with mutable search_path; some exposed SECURITY DEFINER functions). Review separately and do not assume release fixes them.
- No production schema mutation, data write, credentials update or PWA deployment performed while preparing this branch.

## Required acceptance before release

1. **Code integration:** CI test/build, 375px Playwright PWA upgrade and route-publishing smoke, isolated DB tests for `014`, `015`, `016`, plus the new cross-feature integration tests. Confirm exact commit SHA, no conflicting PR merges after checkpoint.
2. **DB preflight and backup:** Export schema, back up `profiles`, `route_ratings`, `routes`, `places`, `catalogue_requests`; inspect function signatures & PG grants; confirm storage bucket/policies and admin identity. Review irreversible nickname changes, even when collision count is currently zero. Record backup timestamps and recovery owner.
3. **Migration dry run:** Apply `014`→`015`→`016` in a safe clone of the production schema, **not just minimal fixtures**, without overwriting migration history. Check idempotency and the expected grants/RLS. Prepare SQL rollback or safe feature flag disable plan.
4. **Product-owner approval:** Ask explicitly to apply the three new SQL files to the hosted Supabase project. Never claim deployment before this approval.
5. **Hosted database migration:** In a short release window, apply each SQL in order. After each, verify prerequisite objects, guards and grants with SELECT-only probes and Supabase security advisor. Stop on any error; don't continue to next migration. Save migration version/hash and outcome because Supabase's `list_migrations` is not a reliable record here.
6. **Authenticated acceptance:** Test two separate real accounts and one unrelated account: submit same public place twice, verify duplicate warning and pending visibility; moderator approval and canonical listing; private duplicate allowed; add/remove friend, incoming invite visible only to recipient; unique casefold nick; own City Route rating independent of external score; private route feedback visible to creator only; session finish publish with approved stops, no unapproved local stops in social route.
7. **App rollout:** Only after DB and accepted smoke, merge consolidated PR #69 to `main` (do not independently merge #60/#66/#67/#68 afterward); verify Cloudflare production deploy, real production asset version, service worker `city-route-v41`, browser and mobile session continuity.
8. **Post-release:** Check error rates, logs, moderation queue/RLS, social route write/read and alternate device; observe first 24 hours; maintain rollback instructions. If any key flow fails, stop/disable relevant UI and revert app, not destructive schema dropping.

## Branch and agent coordination

- **Integration branch is authoritative** for this release. Keep #60/#66/#67/#68 as historical drafts until a clean consolidated merge is complete, then close each with a pointer to #69. Avoid cherry-picking stale `app.js` or `service-worker.js` again.
- No new global ranking implemented; #68 is spec-only and does not authorise `core.js` changes.
- Any other agent must read `AGENT_COORDINATION.md`, current PR #69 and latest CI before editing overlapping files.
- Deployment approval, credentials, migration application and Cloudflare merge are human-gated. The previous release stays live while integration tests run.

## Known external work

Authorised Google Places/Tripadvisor API fetch, source licensing/attribution, imported provider ratings, true visit verification and automated four-auditor execution are **not part of this release**. They remain explicit roadmap items.
