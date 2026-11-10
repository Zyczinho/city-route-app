# Photo library for catalogue places (#176) — 2026-11-10

## Measured before the change (production, `main` @ `b0d4595`)

| City | Places | Permanent cover | Depend on a live Google thumbnail |
|---|---|---|---|
| Warszawa | 308 | 50 | 258 |
| Kraków | 208 | 0 | 208 |
| Lizbona | 192 | 8 | 184 |

For 650 of 708 places every list view asked `/api/place-thumb` (one paid Place Photo call per row, no stored result).
A sample of 30 cover-less places per city against production returned `302` for 64 and `404 no-match` for 26 (29%).
The misses included Padrão dos Descobrimentos, Panteão Nacional, Barbakan Krakowski and Muzeum Powstania Warszawskiego.

Cause of the misses: the place check compared the catalogue name (local language, from OSM) with Place Details
requested without `languageCode`, which answers in English, and always sent `regionCode: PL`, also for Lisbon.

## What changed

1. **Permanent library** — `data/photo-library/<city>.json`, built by `scripts/build-photo-library.mjs`:
   OSM `wikidata` tag of the same element → Wikidata P18 → Wikimedia Commons file → existing licence/size/credit gate.
   The app applies an entry only to the same catalogue id with the same name within 180 m, and only when the place has
   no cover of its own. List rows use the 330 px rendition, the place card the 960 px one; author, licence and source
   are shown as for every other Commons photo. No provider lookup happens for these places.
2. **Fallback chain** — a library file that fails to load is dropped for the visit and the place continues to the
   Google thumbnail and then the category tile, as before.
3. **Google match** — `/api/place-thumb` receives the city language and country and asks Place Details for the name
   in that language.

| City | Permanent cover before | After |
|---|---|---|
| Warszawa | 50 | 112 |
| Kraków | 0 | 87 |
| Lizbona | 8 | 87 |
| Total | 58 / 708 | 286 / 708 |

## Not solved here

- 422 places (mostly restaurants, bars, cafés, hotels) have no free licensed photo and stay on the live Google path.
  Google photos may not be stored; only the place id may. Storing confirmed place ids in the catalogue
  (`metadata.googlePlaceId`, already read by the app) would remove the per-view lookup; it needs a hosted data write.
- The effect of the language fix on the 29% miss rate is **not measured yet**: previews run with Google off, so it can
  only be measured on production after deploy by repeating the same 30-per-city sample.
- A geotagged-Commons name match was tried as a second library source and rejected (7 hits in 650, one wrong address).
- Images are served from Wikimedia, not from own storage. Moving the same files to R2 later changes only the URLs.
- Not tested on a real iPhone.

## Rebuild

`node scripts/build-photo-library.mjs --city <id>` (free APIs only; run one city at a time, Commons rate-limits bursts).
