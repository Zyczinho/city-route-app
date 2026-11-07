# Lisbon pilot — City Route (#146)

## Scope
Lizbona (Lisboa), Portugal, is a **limited pilot** for Przemek from Monday, 2026-11-09.
The city selector uses `status: next` because the current runtime accepts only `launch` and `next`.
The display name is Polish (`Lizbona`) while the local timezone and currency are `Europe/Lisbon` / EUR.

City configuration: `data/cities.json`; database registry:
`supabase/migrations/020_register_lisbon_pilot.sql`.
City centroid: 38.7223, -9.1393; radius 25 km. Location acceptance is radial, not municipal-boundary precise.

## Release order and required gates
1. Merge reviewed PR after green CI (`npm test`, `npm run build`). Confirm new JSON assets ship in `dist/data/cities/lisbon/`. Built service worker cache is content-hashed; do not manually bump source cache version.
2. With founder approval, apply **only** migration 020 to hosted Supabase through the controlled migration process. Do not edit migrations already applied.
3. Verify `select slug,name,currency,timezone,status from public.cities where slug='lisbon';` -> exactly one row with `next`, EUR, Europe/Lisbon. Verify previously launched cities unchanged.
4. Verify Supabase RPC `catalogue_places('lisbon')` and `catalogue_routes('lisbon')` return empty arrays until real content exists; empty output is intentional, not seed content.
5. Verify Cloudflare deployment and the city selector in production on phone and desktop, including reload, GPS/geocoding inside and outside the 25 km radius, and no Warsaw/Krakow cross-city basket contamination.
6. E2E user acceptance with **two real accounts**: sign in as Przemek -> add local place -> choose `Zaproponuj społeczności` -> pending server record -> admin approves -> refresh on second account -> approved Lisbon place appears in `catalogue_places('lisbon')`. Test own photos separately with verified image rights. An unsubmitted private place remains browser-local.
7. Validate photo proposal/loading failure fallback and PWA offline behaviour on iOS. No paid API or service guarantees are introduced by this PR.

## Not included in this PR
No real Lisbon places, editorial routes, ratings, images or provider keys are added. No UI/planner/worker/route generation code is modified, so active PRs touching `app.js` and `service-worker.js` remain independent. Curation is a separate step before meaningful route-quality beta.

## Rollback
If production navigation is defective, revert the PR and redeploy; to temporarily disable Lisbon in the database, set `public.cities.status='hidden'` with a controlled forward change, **not** a row deletion. Do not delete `cities` or `places`: user contributions may already reference the city UUID.
