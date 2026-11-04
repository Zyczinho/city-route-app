# Automatic place enrichment — beta integration (2026-11-04)

This implementation is **conditional on official licensed API access**. It cannot fabricate ratings, photos or third-party reviews when an API key, provider match, or licensing entitlement is missing.

## Cloudflare secrets and caps

Cloudflare Worker variables/secrets (never store in GitHub/frontend):
- GOOGLE_PLACES_API_KEY — enabled Google Places API (New), billing and restricted service key. Enables photo preview plus on-demand place name/coordinates/average rating/count for newly added places. Enterprise SKU applies for rating/userRatingCount, and photo delivery can have extra billing. Follow Google Maps Platform EEA terms and branding/attribution requirements.
- TRIPADVISOR_TERRA_API_KEY — an **authorized** Tripadvisor Terra partner key (not an old Content API key). Enables partner-allowlisted Location Search and current aggregate traveler rating/count, and attempts one permitted photo only when no Google photo is found.
- GOOGLE_PLACES_DAILY_CAP (default soft per-instance 300) and TRIPADVISOR_TERRA_DAILY_CAP (default soft per-instance 80) are **best-effort** per Worker instance, not global financial guarantees. Configure hard quotas/budgets at providers before enabling paid APIs.
- GOOGLE_PLACES_AUTOCOMPLETE stays off unless explicitly enabled.

Endpoint: GET /api/place-enrichment?name=...&lat=...&lng=...&city=...&cityName=...&centerLat=...&centerLng=...&r=...&googleId=...

The Worker restricts input to the requested city and uses a combination of geographic distance and normalized name tokens to prevent attaching an unrelated business's ratings/photo. It returns only **aggregate rating, total review count, official listing URL, and temporary display-only photo reference/attribution**. No review body text is copied or stored; Google Places responses are not cached in the app's persistent state. User-created place IDs can be stored locally where provider policy allows.

The mobile UI shows a separate violet **City Route 1–5 community rating** from existing Supabase RPC 016. It **does not enter** Google/Tripadvisor combined score. For places with no City Route reviews, display Brak ocen. Visitor's own rating and community aggregate are distinguishable.

In Miejsca, Zapisane appears directly after Wszystkie and saved place bookmarks persist **on this browser/device**, not across devices. Newly created local places are automatically bookmarked. This needs account-wide synchronization in a future version.

Before claiming real production provider sync, verify secrets, provider billing/access, applicable photo display rights and one actual authorized Google + Tripadvisor lookup on a real named place. If no key is configured, the Worker returns \`no-key\` and the app continues to allow saving places.

Docs: https://developers.google.com/maps/documentation/places/web-service/place-details and https://developers.google.com/maps/documentation/places/web-service/policies and https://docs.terra.tripadvisor.com/reference/locationssearch
