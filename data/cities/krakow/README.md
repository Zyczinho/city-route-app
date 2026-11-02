# Kraków catalogue v1

This dataset is the first non-Warsaw acceptance dataset for the City Route multi-city architecture.

## Sources

- Broad POI coverage is derived from OpenStreetMap data queried through Overpass.
- Curated route anchors are maintained in `anchors.json`; coordinates are resolved from OpenStreetMap/Nominatim where possible, with explicit coordinates allowed for ambiguous POIs.
- Editorial routes are maintained in `routes.json`.

OpenStreetMap-derived data: © OpenStreetMap contributors, available under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright.

## Generation

```bash
node scripts/generate-osm-city-dataset.mjs krakow
node scripts/generate-city-import.mjs krakow 006
npm test
npm run build
```

`places.json` is a generated snapshot and should not be hand-edited. Curated changes belong in `anchors.json` / `source-config.json`, followed by regeneration.

## Quality model

The catalogue intentionally has two layers:

1. curated anchors used by editorial routes and primary discovery;
2. a broader OSM-derived discovery catalogue selected with category quotas and quality signals.

The v1 dataset is structurally ready for Supabase import, but broad POIs still need later enrichment (ratings, richer descriptions and imagery) before Kraków is promoted as a polished public city.
