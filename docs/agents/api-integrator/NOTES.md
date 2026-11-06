# API Integrator — notes

Short, dated lessons this role must know on its next run. Newest first. Update in the same PR as the work.

- 2026-11-06 — SHARE-LINKS-116: URL hashes are invisible to link crawlers. Worker /r/... uses anonymous published-route Supabase RPCs to serve OG metadata, excludes archived/private routes and Google photo proxies, no new provider key; exclude /r/ from PWA index cache.

- 2026-11-05 — Google Places (New) needs both secrets `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACES_BETA_ENABLED=on` as runtime Worker secrets (not Build variables). Soft cap `GOOGLE_PLACES_DAILY_CAP` (default 300, founder set 30).
- 2026-11-05 — Google photos: use Google's first photo (the Maps cover); never store the file, show it through `/api/place-photo`.
- 2026-11-05 — Free tier per month: ~1,000 Text Search Enterprise and ~1,000 Place Details Photos; trial credit 1,186 zł for 90 days; no charge unless the account is upgraded.
- 2026-11-05 — Strava API: new apps work for one athlete until Strava approves the app. Garmin Connect API needs an approved developer programme application. GPX export works with both without approval.
