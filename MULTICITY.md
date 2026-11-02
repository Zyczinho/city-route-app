# City Route multi-city contract

## Product rule
City Route Core must not know that Warsaw is special. Warsaw is the first city dataset, not a separate product implementation.

## Definition of done for a new city
A new city can launch without editing `app.js`, route-generation algorithms or shared UI components. Launching a city should require only:
1. a `cities` record/config,
2. imported/curated places,
3. editorial/community routes,
4. optional city-specific collections/tags,
5. QA and activation of the city status.

Any new `if (city === 'krakow')` in shared product logic needs explicit justification.

## Layers
- **City**: locale, currency, timezone, map centre, safe operating radius, rollout status.
- **Place category**: global definition of what a place is (`restaurant`, `museum`, `club`, `hotel`).
- **Tags/facets**: attributes such as `italian`, `cheap`, `date-night`, `vegan-friendly`, `techno`.
- **Collection/route**: city-specific editorial context such as `Nad Wisłą`, `Kazimierz wieczorem`, `Pierwszy raz w Krakowie`.
- **Route**: ordered place sequence. Editorial and community routes share one base model; authorship/type differ.

## Polish rollout
1. Warsaw — launch dataset and migration source.
2. Kraków — `next`; acceptance test that Core is truly city-agnostic.
3. Gdańsk — planned; later extend the model to destination/metro regions for Trójmiasto.
4. Wrocław — planned.
5. Poznań — planned.
6. Łódź — planned.
7. Toruń — planned; speed-of-launch test for a smaller city.

## Data migration strategy
The current JSON data remains the production source during Sprint 1 so the live Warsaw app stays stable. The Supabase schema is introduced in parallel.

Migration sequence:
1. Create multi-city schema + PostGIS (migration 003).
2. Validate every Warsaw place maps to the global taxonomy.
3. Generate/import Warsaw records into Supabase (migration/import 004).
4. Add a repository data adapter that can read Supabase and fall back to JSON during transition.
5. Switch Warsaw reads to Supabase after parity tests.
6. Add Kraków data without changing shared Core code.

## Geography
PostGIS stores city centres and place locations as geography points. `nearby_places()` is the primitive for future `500 m / 1 km / map viewport` discovery. Map UI is not part of migration 003.

## Provider data
Provider licensing/storage rules remain separate from our canonical place records. Canonical City Route places should own stable identity, category, coordinates, tags and editorial/community metadata; provider IDs and refreshable signals live in `place_sources`.

## Sprint 1 safety rule
Do not delete or rewrite working Warsaw JSON until database parity is proven. Main must remain deployable after every merge.
