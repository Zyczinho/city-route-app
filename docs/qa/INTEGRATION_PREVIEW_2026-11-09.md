# City Route integration preview — 2026-11-09

**Target branch:** `work/integrated-cityroute-preview-20261109`, PR #177 (draft). Not production and not an approved release.

## Combined sources

1. Source branch #154 already descends from #151; no duplicate cherry-picks.
2. Planner V2 #143: `route-planner-v2.js`, `core.js` changes, runtime generator adapter, tests, evaluation script, build and SW cache. V2 and #151/#154 share/GPX were hand-reconciled in `app.js`, preserving both.
3. Variant D #173: five lower tabs (Start, Trasy, Miejsca, Społeczność, Profil), one contextual My Route bar, one profile collections hub, 3 priority actions on current route, secondary optimize/GPX/Maps/Clear disclosure. Existing Places map and 30/item pagination preserved.
4. Current main since the integration branch's 2026-11-07 fork: real one-to-one direct messages, notifications, live activity, provider capability flag and public/private place sharing. Missing added modules and migration history copied; imported modules, Worker routes, index scripts, bundle and service-worker cache wired. No database migrations executed here.
5. Purple route/Place sharing preserves `--cr-community:#6D28D9`; save/archiving remain blue.

## Important open integration gates

- GitHub CI all modules and build.
- Browser smoke `p0-browser-smoke.mjs`, `planner-v2-browser-smoke.mjs`, `places-pagination-browser-smoke.mjs`, `dm-notifications-browser-smoke.mjs`, `place-share-browser-smoke.mjs`, `integrations-browser-smoke.mjs`.
- Actual Cloudflare Preview URL must appear in PR and respond to iPhone Safari: 320/375/390 widths, safe-area and fixed contextual routebar.
- Five-tab navigation, no duplicate own routes in Discover; Profile → My Collections → own / social saved / favorite places; place rating sources and map remain.
- Start→V2 generated options→save/edit→GPX/share; transit A→B links; manual basket ordering; 30-item paging, search and photo fallback.
- Two signed-in accounts, DM and notification deep-link, place-share deep link and privacy checks. 
- Validate latest main parity before any release. Branch is based on preproduction #154, GitHub `mergeable=false` vs main may require additional conflict resolution. Never force-merge or hide blockers.

## Rollback

Only preview and this PR branch are affected; reverting a future merge will return previous five/six-tab navigation without schema modification. No product data cleanup and no new provider credentials. Negative preference hard exclusions (#172) are separate and **not** included.
