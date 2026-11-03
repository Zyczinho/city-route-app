# Kraków catalogue

This dataset is the first non-Warsaw acceptance dataset for the City Route multi-city architecture.

## Sources

- Broad POI coverage is derived from OpenStreetMap data queried through Overpass.
- Curated route anchors are maintained in `anchors.json`. Anchors with explicit `lat`/`lng` keep their OpenStreetMap object in `osm` (for example `way/26195267`); the others are resolved from OpenStreetMap/Nominatim by the generator.
- Editorial decisions on the broad catalogue (removed duplicates, category, area, name, tag and description corrections) are maintained in `curation.json`.
- Areas of broad POIs come from OpenStreetMap/Nominatim reverse geocoding (quarter or neighbourhood), mapped to traveller-facing names such as Stare Miasto, Kazimierz, Stradom, Podgórze, Zabłocie or Nowa Huta.
- Editorial routes are maintained in `routes.json`.

OpenStreetMap-derived data: © OpenStreetMap contributors, available under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright.

## Workflow

`places.json` is a generated snapshot and should not be hand-edited. Edit `anchors.json` or `curation.json`, then re-apply them to the snapshot without querying OpenStreetMap:

```bash
node scripts/apply-city-curation.mjs krakow
node scripts/generate-enrichment-report.mjs krakow
npm test
npm run build
```

A full regeneration (`node scripts/generate-osm-city-dataset.mjs krakow`) re-queries Overpass and applies the same curation automatically. Review the diff afterwards: new OSM objects may appear and need curation.

Supabase: never overwrite an existing migration. Catalogue changes reach Supabase through the next numbered import migration (`node scripts/generate-city-import.mjs krakow <number>`), coordinated with the multi-city runtime workstream. The import upserts places and does not unpublish removed ones; see `curation.json` → `removed`.

## Quality model

The catalogue intentionally has two layers:

1. curated anchors used by editorial routes and primary discovery, each with a short description, a traveller-facing area and a few strong tags;
2. a broader OSM-derived discovery catalogue selected with category quotas and quality signals, cleaned by `curation.json`.

Every sight carries at least one tag the planner can match (`sightseeing`, `culture`, `nature`, `views`, `food`, `hidden`), plus a few descriptive tags (`classic`, `history`, `jewish-heritage`, `ww2`, `rainy-day`, `budget`, `nowa-huta` and so on).

`enrichment-report.json` lists which top places and route stops still lack an image, ratings, review counts, website, opening hours or a description. No ratings or images are copied from Google Maps or other protected sources.
