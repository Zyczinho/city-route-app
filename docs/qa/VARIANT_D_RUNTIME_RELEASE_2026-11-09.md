# City Route — Variant D migration handoff (2026-11-09)

**Scope:** founder-approved product/navigation direction; real runtime code, NOT a self-contained mock. Branch `work/real-variant-d-navigation-20261109` based on current GitHub `main`; do not merge until CI and independent review, combined integration with #151/#154/#143 and real iPhone acceptance.

## Single, clear job for each bottom destination

1. `#plan` => **Start**, route preferences and generator; direct links to ready routes and place explorer remain available.
2. `#routes` => **Trasy**, editorial route discovery and route detail; community published routes still discoverable via their own existing social feed and deep links.
3. `#places` => **Miejsca**, map + categories + sorting + filters + place comparisons/add/save. Existing blank map until explicit category selection is **preserved**.
4. `#routes/community` => **Społeczność**, existing group routes, friends, follows, messaging, groups and social events.
5. `#profile` => **Profil**, personal settings/counters and **Moje kolekcje**; legacy `#about`, `#sources`, booking and other settings retain working navigation.

## Where existing functionality moved

- `#my-route` persists as a deep link for draft builder and live session; remove from permanent bottom bar, expose a contextual accessible **Moja trasa · N przystanków** bar only when a draft/live/completed route exists, not on the active route screen itself. Existing add-place toast continues to link there.
- `#book` is still available from the existing ticket shortcut in the header and book views. It is **not** removed.
- `#events` remains available from Miejsca and the existing community event shortcut (do not pretend future community-hosted events are already live).
- `#about` guide and `#sources` stay under Profile's **Więcej**, plus the starter guide link. Full 34-topic guide remains available.
- Profile adds a single **Moje kolekcje** doorway leading to own locally saved routes, current draft, saved social routes and saved places. No data migration and no reinterpretation of social saved-route storage. Do not claim cross-device sync of private local routes.
- My Route retains **all actions**, but exposes three first: Start, Save, Share (purple). Optimize, external Maps and Clear live in a **Więcej opcji** disclosure. Drag and manual reordering remain in the stop list.

## Boundaries and dependencies

- **Not included:** new negative preference exclusions, optimization algorithm or filter semantics (Issue #172, coordinate with PR #143 Planner V2); new place-detail score redesign (Issue #169); backend photo fixes (PR #166); notification routing (Issue #168). These require separate tested changes.
- Existing positive interests are brought to the front of the Start form, not silently changed in the generator.
- Other open branches #151/#154/#143 edit `app.js`; after their release the integration owner must port this small UX patch onto their final changes rather than replacing their runtime. This branch intentionally avoids `index.html`, `scripts/build.mjs`, `service-worker.js`, Supabase and provider code.
- Existing navigation state is re-rendered from `app.js`; `nav-enhancements.js` remains the accessibility, header-ticket and routebar synchronizer. Both must use the same five destination order. PWA cache is content-hash based in `scripts/build.mjs`.

## Release gates

1. CI `npm test` and `npm run build` plus P0 mobile smoke.
2. Real phone 320/375/390px: exactly five tabs; no overlap of routebar + navbar; Start generator works; inside `#places` map loads after selecting a category.
3. New draft + active navigation: routebar appears when draft is nonempty, disappears on `#my-route`, can reach Start/Save/Purple Share/More, all existing optimize + Maps + Clear buttons still usable.
4. Own routes, saved social routes, saved places and Guide accessible from Profile; anonymous/auth flows and guest reset behavior unchanged; cross-city basket remains city-scoped.
5. Deep links `#about`, `#book`, `#events`, `#social-saved-places`, `#community-route/<id>` still resolve.
6. Rebase/reconcile with #151/#154/#143 after code ownership handoff. Independent review must explicitly approve collisions, no blind merge.

## Rollback

Revert this PR to restore the legacy 6-tab surface. All storage data and hashes are unchanged, and no migrations run. The standalone UI experiments remain in separate PR #167.
