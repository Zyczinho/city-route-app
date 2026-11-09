# CityRoute V2 — source-of-truth for travel-time routing and costs

**Status:** design and pure matrix adapter in PR #141. **No remote routing provider is enabled.** Google Maps billing and self-hosted OSRM/Valhalla require separate product-owner signoff.

## Architecture: cheap first, real verification second

1. Query the existing city catalogue once (current Warsaw example: 308 POIs). All entries, including unrated recent OSM additions, compete on relevance and location; no `min_rating` or `min_review_count` gates.
2. Run the local beam-search engine with a capped candidate pool and estimated walking/bike times. This explores thousands of stop-set/order combinations without an external API call.
3. **After** local shortlist, send only a small number of candidates/legs to a licensed, actual road/walking/transit routing provider. Use an appropriately sized real travel-time matrix; include an explicit origin and, for transit, desired departure time.
4. Re-run the same planner with `opts.matrix` (directed leg estimates keyed `fromId>toId`), including availability windows, waits, rest and food. A matrix is not symmetric (one-way streets, bus routes).
5. Confirm and display the final route and the time-quality label. A route with `timingQuality: 'approximate'` is not verified against real streets. Never describe it as an exact ETA.

## Current options, November 2026

| Option | Value | Limitations | Recommendation |
| --- | --- | --- | --- |
| Local geodesic fallback | 0 API elements, 0 cost, works offline | Straight-line ×1.3, no real crossings, traffic or transit schedule | Existing + V2 shortlist stage; UI must label approximate |
| OSRM self-hosted, with OSM walking/bike profiles | Street-network route and matrix, no per-call external vendor fee | Requires maintained Warsaw/EU routing graph, server, monitoring, map update and ODbL attribution | Best future walking/biking matrix where infrastructure budget allows |
| Valhalla self-hosted | Walking, bike and possible multimodal/transit support | More operational complexity, GTFS availability/quality varies | Evaluate for actual mixed/transit modes after GTFS source checks |
| Google Routes API | High-quality route and matrix availability; transit supported as a matrix/per-leg | Billing enabled, pay per matrix element, API key, attribution/terms; multi-point Google Maps transit URL is **not** supported | Optional fallback/validation behind strict daily quotas, not enabled today |
| Public OSRM demo | Easy experiment without API key | Not production SLA or unlimited commercial backend | **Never** depend on for production |

## Billing controls

Official Routes API Essentials public list (as checked 2026-11-07): `Compute Route Matrix` first **10,000 elements per month at zero charge**, then **$5 per 1,000 elements** for the first paid volume tier. It is calculated **origins × destinations**, not by the number of HTTP requests. Example: 15 × 15 = **225 billable elements**. A matrix of all 308 Warsaw locations would have 94,864 origin-destination elements (before other constraints), which is unnecessary and wasteful. See:
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/documentation/routes/usage-and-billing

Do not enable billing, buy a subscription, or provision a VM automatically. If approved later, server-side API key only, provider usage budgets, rate limiting, short route matrix, explicit error fallback, daily quotas + alerts. Enforce that the provider is called **after** local narrowing (e.g. <= 12–15 candidate sites), not once for every beam-search expansion.

## Data handling/licences

- Do **not** construct a persistent shared cross-user database of Google route-time outputs by default. Google Maps service terms restrict caching/storage and use with non-Google maps. Confirm the intended UI/display/retention use before enabling Google route outputs:
  - https://cloud.google.com/maps-platform/terms/maps-service-terms
  - https://developers.google.com/maps/faq
- If using an independently hosted OSM routing engine, follow OSM/ODbL attribution and database-sharing requirements and keep graph updated:
  - https://www.openstreetmap.org/copyright
  - https://github.com/Project-OSRM/osrm-backend
- Public OSRM demo is intended for demonstration, not a free production routing backend:
  - https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy

## Product-specific cases

- Walk/bike: approximate locally; road-network verification later.
- Public transit: refuse fallback if no real matrix. Two-endpoint travel can be looked up for each leg. Google Directions' transit mode cannot export a multi-waypoint URL as one journey. For time-dependent bus/tram planning, calculate the actual departure at each step (and include transfers/walking); a timeless matrix is not enough for production.
- Unknown venue opening hours: return an explicit warning and require review for time-sensitive venues; no assumption of "open now".
- Curated routes ("Śladami Chopina") preserve editorial story and sequence, while an autogenerated route may optimize its own candidate set and order.
- Nearby/new community gems get equal opportunity to enter the candidate pool regardless of number of ratings.

## Milestones / release gates

1. PR #141: pure V2 search + adapter + offline 10-scenario benchmark, no UI/DB/provider change.
2. PR #139 integrated, PR #125 app.js ownership released.
3. Pilot behind feature flag and compare V1/V2 for the same 10 requests; capture route duration and provenance.
4. Choose provider (PO approval for paid external service or hosted VM), validate *actual* travel times from Warsaw streets and walking routes.
5. Browser smoke iPhone 13 Pro and budget/time confidence UI; only then consider production default.

Related: #134, #135, #136, #138, #140.
