# CityRoute — Route Planner v2 (product contract and technical plan)

Status: **proposal**, not a deployed algorithm. Founder approval (2026-11-07): implement tester feedback, **except** any mandatory Google review-score/review-volume filter. Owners: Product Owner for trade-offs, runtime for algorithm, QA for tests.

## Evidence and current baseline (2026-11-07)
- Production Supabase: 308 Warsaw places, of which 258 are OSM-derived. The public `catalogue_places('warsaw')` RPC returns 308 rows. Therefore new places are present and reachable by the runtime catalogue path.
- `app.js::plan` calls `generateAlternatives([...places,...forCity(state.userPlaces,city().id)], chosenPrefs)`; `places` comes from `loadCatalogueWithFallback` (Supabase-first).
- `core.js::generate` uses one-step greedy selection with straight-line distance ×1.3, smoothed external ratings (not a hard threshold), and limited category matching. Before this PR, new OSM places lacking human-written interest tags had poor interest affinity. Route `summary` includes each POI's `minutes` and estimated travel, but **not scheduled rest breaks**.
- `opening-hours.js` has an editorial pilot for a small number of entries, not exhaustive realtime hours. Other places are explicitly unknown.
- **Update 2026-11-10 (planner reliability, ADR-012):** every catalogue place is now checked against its OpenStreetMap `opening_hours` (offline subset parser; Lisbon 122/192 places carry a value). Food and nightlife without readable hours use typical category hours, flagged as unverified; an unreadable value is never treated as closed. The coffee/meal break is a soft slot and a café counts as coffee by category. `planRoutesV2` returns `reason` (`no-candidates`, `interests-closed`, `no-feasible-route`), `hints.closedInterests` (with the earliest opening) and per-route `relaxations` / `breakStopId`. Since ADR-014 the same engine also plans transit: without a supplied matrix each transit leg is a labelled estimate (`transit-estimate`: 10 min access/wait + 18 km/h, or walking when quicker); `transit-matrix-required` is no longer returned.
- `route-optimizer.js` optimizes order for **a supplied set** of stops, not which stops to choose. It uses estimated geometry, not transit timetables or a real travel-time matrix.

## Product contract (hard constraints)
1. A selected route budget (e.g., 240 min) means **the entire experience**: travel + attraction dwell + meals + explicit rests + any waits/transfer buffers. Never promise a 4-hour route that actually requires 6 hours.
2. Default UI choices already encode 1h, 2h, 4h, **6h (pół dnia)**, **8h (cały dzień)**; display those numerals instead of only ambiguous labels. Offer configurable duration in the next iteration.
3. User-selected start date and local time, location/origin, city, pace, budget, dietary/food stops, interest, visit mode and transit mode are route constraints. User may edit stop-specific dwell and remove/add/reorder stops.
4. Museum/gallery requiring an indoor visit is **excluded** in exterior-only mode unless editorial metadata explicitly certifies valuable standalone exterior/architecture. Do not assume every museum building is worth seeing from outside.
5. A venue with missing opening hours is **unknown**, not "open". Known closures prohibit arrival. Display explicit confirmation needed for unknown.
6. External ratings **never** gate candidate eligibility by rating value, review count or number of sources. No 4.1/10k filter. New/under-reviewed community gems must remain possible. If ratings are used for a soft tie-breaker, missing ratings use a neutral prior.
7. Sponsored places are separate and visibly labelled. No automatic sponsored boost before a real product policy.
8. City scopes and eligible catalogues must be explicit, with automatic tests preventing stale JSON fallback from being mistaken for full live coverage.

## Planner architecture
### A. Prepare eligible candidates
- Pull the latest published catalog from the Supabase RPC with provenance and category; merge own/local places only within the selected city.
- Exclude hotels, unsupported visit modes, unavailable/disallowed stops, duplicate POIs and impossible budget candidates. Respect user exclusions and accessibility.
- Apply **positive affinity** for named interests from both editorial tags and normalized categories. Category affinities work for OSM places without editorial tags.
- Prefer a geographically spread **candidate shortlist**, but do not clip to only high-review POIs. A route from Warsaw Praga should not be seeded purely from Śródmieście.

### B. Score candidate sets, not just the next point
Implement a bounded search (beam search, limited candidate-set enumeration or similar) optimizing:
- user fit and thematic cohesion,
- geographic efficiency and lack of backtracking,
- diversity of meaningful stop types (museum/greenery/food/viewpoint),
- editorial value and community discoveries with transparent source,
- enough dwell time to experience the chosen venues.

A curated editorial/thematic route is not synonymous with an autogenerated itinerary. Preserve authored story and order; do not silently flatten "Śladami Chopina" into generic museum + park stops.

### C. Optimize the visit order against time windows
For each candidate set, order stops and schedule departures with actual opening windows when available, dwell durations, lunch/coffee preferences and realistic pauses. Select only plans satisfying the budget; if no feasible result exists, say why and offer adjustments. `route-optimizer.js` minimizes geometric distance only and can serve as a baseline, not as a proof of shortest walking/transit time.

### D. Travel modes
- Walking/bike: route estimates must clearly say whether straight-line approximation or real road time.
- Transit: Google Maps supports transit **between two locations**, but its Directions service does **not** support transit waypoints for a multi-stop itinerary. Until per-leg planning is implemented, do not show a broken "Cała trasa komunikacją" action. Offer separate A→B transit links where supported, or an honest disabled state.
- Mixed: ask/derive the mode for each leg; don't call all legs `transit`.
- Do not introduce paid API commitments without approval.

### E. Three genuinely different route choices
Generate three alternatives whose POI *sets* and themes differ meaningfully; changing order alone does not count. Display why each was chosen and its timing breakdown. Let users fine-tune times and regenerate only the affected portions.

## Acceptance tests
1. Warsaw RPC returns the same published count used by generator: currently 308. Explicitly test candidate selection from the 258 new OSM records rather than just their listing in Places.
2. New unrated POI with normalized category competes correctly for a relevant interest. No review minimums.
3. Outside-only "Śladami Chopina" excludes the museum unless independently warranted by documented exterior metadata.
4. Four-hour route: sum(travel, visits, waits, meals, breaks) <= 240 min. A museum may have a user-adjusted 30/90/180 min dwell, and plan adapts.
5. Hours: closed means rejected, unknown means visible warning, opening waits are counted.
6. Public transit routes never emit unsupported multi-waypoint links; individual A→B links work in Safari/Android.
7. Diversity across three variants and city scoping; avoid irrelevant nightlife at 09:00.
8. Real Warsaw beta: 10 routes sampled for tourist, newcomer, local and spontaneous personas; log rejected POIs/reasons and compare predictions to human timing.
9. Regression test against user-added routes so auto-planner changes never delete or reorder a manually curated route.

## Delivery stages
- **Immediate:** normalize category affinity for OSM candidates; filter exhibition-only stops in outside mode; tests. (Initial change in this PR.)
- **Next P0:** visible 6h/8h labels, explicit transit UX fix, per-stop time categories, rest buffers and unified schedule totals.
- **Following P0:** candidate-set search with opening windows, travel-time matrix/fallback provenance and objective validation.
- **Then P1:** profile home city vs trip city, event source expansion, subjective route feedback and adaptive pace.

Related issues: #112, #114, #134, #135, #136, #137 and #122.
