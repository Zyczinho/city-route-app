# Warsaw OpenStreetMap layer

Warsaw has two layers:

1. **Editorial catalogue** in `data/places.json`: 50 hand-checked places with descriptions, photos and manually read ratings. It reached Supabase through migration 004.
2. **OpenStreetMap discovery layer** in this folder (`places.json`, #112): bars, pubs, clubs, cafés, restaurants, museums, galleries, parks and Wikidata-linked sights. It reaches Supabase through additive migration 019.

OpenStreetMap-derived data: © OpenStreetMap contributors, available under the Open Database License (ODbL). See https://www.openstreetmap.org/copyright.

## Quality rules (`source-config.json`)

- Inside the Warsaw city boundary (OSM relation 336075) only.
- Each record needs a name and coordinates. Food and nightlife also need a website, opening hours or a social profile; landmarks, churches, museums and parks need a Wikidata link.
- Chains are skipped (OSM `brand` tags plus a name list), and so are offices, embassies, faculties, stations and cemeteries.
- Duplicates are skipped against the editorial catalogue, the four staged nightlife seeds and each other: the same name within 120 m (an identical name within 1 km), or any name within 25 m.
- The area is the district (`admin_level=9`) that contains the point.
- No ratings, photos or descriptions are stored. Ratings and the main photo come from Google through the Worker at display time and are not saved.

Editorial removals live in `curation.json` → `removed`. They are skipped before selection, so the quota backfills with the next candidate.

## Workflow

```bash
node scripts/generate-osm-city-dataset.mjs warsaw              # re-query OSM, apply curation
node scripts/generate-city-import.mjs warsaw <next-number> --additive
npm test
```

Never rewrite migration 019 once it has been applied. Ship a regenerated layer as the next numbered `--additive` migration. The additive upsert only updates OpenStreetMap records, and a slug owned by any other Warsaw place aborts the migration.
