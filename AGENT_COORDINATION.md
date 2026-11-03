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

[DONE] KRK-REVIEW-003 — Claude — PR #24 reviewed clean with no blocker; one non-blocking generator-generalisation note recorded.

[DONE] MAP-DATA-001 — ChatGPT + Claude review — stable Nearby RPC contract + `nearby-client.js` + tests merged in PR #25 after clean Claude cross-review. Migration 008 applied successfully to hosted Supabase by Jakub on 2026-11-03.

[DONE] MAP-DATA-REVIEW-002 — Claude — PR #25 reviewed clean, no BLOCKER. Integration note: normalize `distanceMeters` to map-view `distanceM` and merge nearby rows by public `id` with full catalogue objects before planner/basket use.

[DONE] MAP-UI-001 — Claude + ChatGPT review — isolated map module merged in PR #26 after ChatGPT cross-review; `map-view.js`, `map.css`, tests and integration notes are on main. Public OSM tiles are MVP-only and require provider hardening before heavy traffic.

[ACK] MAP-INTEGRATE-002 — ChatGPT — integration implemented on `work/map-integrate-002`, PR #28 open; latest CI green. Map is mounted in Places, Nearby RPC rows merge by public ID with full catalogue objects, `distanceMeters` is normalized to `distanceM`, RPC failure falls back client-side, SW bumped to v25. Live 008 validation found a harmless 0.40 m KNN/exact-distance ordering inversion in Kraków; PR #28 now defensively sorts Nearby rows by exact client distance. Waiting for Claude cross-review before merge.

[DONE] MAP-INTEGRATE-REVIEW-003 — Claude — PR #28 reviewed clean, no BLOCKER (https://github.com/Zyczinho/city-route-app/pull/28#issuecomment-6599761846). NON-BLOCKER: guard in-flight Nearby RPC with a request counter; avoid map rebuild per search keystroke.

[DONE] COVER-SYNC-REVIEW-002 — Claude — PR #32 / migration 010 reviewed clean, no BLOCKER (https://github.com/Zyczinho/city-route-app/pull/32#issuecomment-6599781591). NON-BLOCKER: take the migration number as an argument in generate-route-cover-sync.mjs.

[OPEN] ROUTE-HERO-001 — Claude — route/image quality work with ADR-010 as a hard requirement. Every editorial route must receive a first-class hero image that is unique across routes; no hero asset/URL may repeat even when routes share stops. Prefer visually strong, high-resolution, legally usable sources and preserve credit/licence/source metadata. Add automated validation that fails on duplicate route hero images and stop deriving route covers from the first POI image. Keep this package isolated from ChatGPT's active map-integration branch; if runtime rendering changes are needed, make them in a separate Claude branch/PR and call out any schema/migration requirement explicitly.

[ACK] NEARBY-LIVE-004 — ChatGPT — hosted migration 008 smoke-tested against Warsaw centre and Kraków Rynek. Both cities return valid public IDs within 500 m; Warsaw returned 3 results and Kraków 50. One sub-metre ordering inversion (314.67 m then 314.27 m) confirmed the KNN-vs-spheroid nuance; temporary validation PR #29 closed without merge.

[ACK] NEARBY-ORDER-005 — ChatGPT — Claude review of PR #30 / migration 009 clean, no BLOCKER (https://github.com/Zyczinho/city-route-app/pull/30#issuecomment-6599793655); ready to merge and apply. Original: forward-only migration 009 prepared in PR #30 to order `catalogue_nearby_places` by the exact `ST_Distance` returned as `dist_meters`. Severity low because PR #28 already sorts client-side. Claude cross-review required before merge; do not interrupt an active route-image package solely for this review.

[OPEN] MAP-PROD-SMOKE-006 — ChatGPT — run immediately after PR #28 is reviewed, merged and production deploy is confirmed. Verify Warsaw and Kraków separately: Places opens map, tiles/attribution render, filters/search update markers, place card opens details, Add to route updates the correct city basket, Nearby 500 m returns locally sorted results, Nearby off restores the filtered catalogue, city switch resets map state without mixing baskets, denied/unavailable location or RPC failure leaves the list usable, and mobile layout does not cover OSM attribution. Do not claim production success until the deployed app is checked.

[OPEN] COVER-WIRE-001 — ChatGPT — wire `route-covers.js` into `app.js` (routeCard + route detail: use `assignRouteCovers` over the routes shown, instead of `ps.find(p=>p.image)`), and include route `image`/`imageCaption`/`imageCredit` in the next forward Supabase sync for Warsaw and Kraków routes. Product-owner rule: route main photos must never repeat. Data + module + tests from Claude on `claude/route-covers-v1`.
 before live parity

- Migration 007: applied successfully to hosted Supabase.
- Migration 008: applied successfully to hosted Supabase; live RPC validated for Warsaw and Kraków.
- Migration 009: PR #30 open; apply only after merge. This is a precision/contract cleanup, not a blocker for client-side Nearby correctness.

## Handoff / checkpoint rule

If a session/credit limit may interrupt an `OPEN` task, push the branch and add one compact line here:
`[ACK] <ID> — owner — checkpoint <commit/PR> — completed: ... — next: ... — blocked: yes/no`

Another agent may take over only after checking ownership, risk and checkpoint state.

## Escalation template

`[ESCALATE] <ID> — owner — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
