# Warsaw Route Planner V2 — 10-scenario automated benchmark

Last verified: **2026-11-07**, code branch `work/planner-v2-beam-benchmark-20261107`.
Input: actual checked-in Warsaw datasets: **50 editorial + 258 OSM**, all with names/coordinates, no review threshold.
Mode: deterministic *offline approximation*, **not** provider-certified real-world street times. No paid API was called.

## First-choice routes after geographic and meal-window fixes

| Scenario | Requested | Planned estimate | Variants | Explored extensions | OSM stops in first choice | Relevance signal | Travel share |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 Starówka | 120m | 120m | 3 | 14,850 | 2 | 100% | 8% |
| 02 Zieleń | 240m | 216m | 3 | 18,000 | 1 | 80% | 21% |
| 03 Muzea | 240m | 237m | 3 | 16,470 | 2 | 100% | 20% |
| 04 Historia bez muzeów | 180m | 177m | 3 | 16,830 | 1 | 100% | 18% |
| 05 Widoki nad Wisłą | 240m | 209m | 3 | 14,916 | 0 | 100% | 33% |
| 06 Nieoczywista Praga | 240m | 192m | 3 | 889 | 0 | 75% | 30% |
| 07 Must-see | 360m | 342m | 3 | 28,440 | 0 | 100% | 27% |
| 08 Lokalny spacer | 480m | 405m | 3 | 28,440 | 0 | 88% | 33% |
| 09 Kultura i kawa | 240m | 240m | 3 | 16,290 | 1 | 100% | 19% |
| 10 Zwiedzanie z obiadem | 360m | 359m | 3 | 28,440 | 5 | 100% | 21% |

**Total:** 183,565 evaluated route extensions across 10 scenarios, 30 generated alternatives, 12 new OSM POIs appearing in the **ten primary routes**. Exploration count refers to search-node extensions, not 183k complete unique routes.

## Validation and quality dimensions

The test suite checks:
- **Time accounting:** every route's travel + dwell + waiting + rest sums exactly to its duration and is below its selected limit (1, 2, 3, 4, 6 or 8 hours depending on the scenario).
- **Thematic matching:** selected POIs match user interests through normalized category and/or tags; report `interestFitPercent` rather than treating external rating count as a proxy for quality.
- **Diversity:** variants must differ by POI *sets*, not only the order of identical stops. The benchmark reports maximum pairwise POI-set overlap, with a 70% threshold.
- **Geography:** Praga scenario is constrained to appropriate declared Praga district values and within 2.5 km of the pilot starting point.
- **Museums:** outside-only excludes museum/gallery exhibitions unless separately verified as an independent exterior attraction; known closed venues are excluded.
- **Meal timing:** requested coffee or lunch cannot be the first or final stop, and Saturday lunch falls in the declared 11:30–15:00 window.
- **Data freshness:** imports from the 258-record OSM fixture enter the candidate pool. No minimum review count, rating value or number of review sources.
- **Timing evidence:** travel without a real matrix is explicitly flagged `straight-line-estimate`; transit without a provider matrix refuses to claim a feasible itinerary.

### Important open limitations

1. **Travel durations are still approximate** (great-circle distance ×1.3 divided by assumed speed). Bridges, crossings, sidewalks, closure and footpath access are not verified. All ten benchmark routes need real walking-time QA before release; never show them as confirmed ETAs.
2. Opening-hour pilot covers only a few curated museums. Food/nightlife sources and unknown museum hours are marked as uncertain; ongoing venue verification remains required.
3. The heuristic thematic relevance metric is only an objective diagnostic based on tags/category; it does not determine the true cultural interest or accessibility of a place.
4. No automated measurement of arrival punctuality from actual user walks yet. Add opt-in beta measurements and compare observed time to predicted time.
5. The benchmark works against checked-in datasets, not a verified live snapshot in every CI run. Production catalogue must be separately validated before enabling V2.
6. Local Praga currently has relatively sparse non-food/non-nightlife catalogue entries; it produces a shorter route rather than inventing filler locations.
7. A full multi-stop transit itinerary requires time-sensitive transit legs. A static matrix is only a test mechanism, not a GTFS-based production transit planner.
8. The new engine is a standalone module, **not yet wired into production UI** pending reconciliation of PR #139 (`core.js`) and PR #125 (`app.js`).

## Reproduce

```bash
npm test
npm run build
node scripts/evaluate-planner-v2.mjs
```

The script prints a machine-readable JSON report including every selected POI ID, estimated durations, quality alerts, score, alternative overlap and the number of explored combinations. No credentials or external requests are needed.

Related docs: `docs/ROUTING_PROVIDER_STRATEGY.md` and (in PR #139) `docs/ROUTE_PLANNER_V2.md`.
Related tasks: #134, #135, #136, #138, #140.
