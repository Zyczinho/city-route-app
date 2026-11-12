# P0 #176 — Lisbon hosted catalogue audit (2026-11-09)

Read-only hosted catalogue audit, project `ycfhpvtsnsmzdmpvliif`. Actual default Places order: `compareRecommendedPlaces`, hotels excluded, no private-user entries. No stored ratings or images in this city, so this sample sorts by editorial top then Polish name order. Dynamic Google photos/ratings are not counted as permanent coverage.

| City | Public published places | Stored covers | Descriptions ≥30 characters |
|---|---:|---:|---:|
| Warsaw | 308 | 50 | 45 |
| Kraków | 208 | 0 | 99 |
| Lisbon | 192 | 0 | 23 |

First 30 Lisbon cards: **6/30 descriptions**, **0/30 stored covers**, **0/30 Google and Tripadvisor rating rows**. Live provider health: Google ratings/photos ready; Tripadvisor Content and Terra both no-key. This does not measure Google photo success or exact venue identity.

| # | Place | Description | Stored cover | Stored ratings | Catalogue ID |
|---:|---|---|---|---|---|
| 1 | Arco da Rua Augusta | Yes | Missing | Missing | `editorial-lisbon-arco-rua-augusta` |
| 2 | Mosteiro dos Jerónimos | Yes | Missing | Missing | `editorial-lisbon-jeronimos` |
| 3 | Praça do Comércio | Yes | Missing | Missing | `editorial-lisbon-praca-comercio` |
| 4 | Sé de Lisboa | Yes | Missing | Missing | `editorial-lisbon-se` |
| 5 | 100 Montaditos | Missing | Missing | Missing | `osm-node-11876777518` |
| 6 | 100 Montaditos | Missing | Missing | Missing | `osm-node-8744233326` |
| 7 | 1001 Nights | Missing | Missing | Missing | `osm-node-8321839453` |
| 8 | A Baiuca | Yes | Missing | Missing | `osm-node-4813682932` |
| 9 | A Brasileira | Missing | Missing | Missing | `osm-node-489736332` |
| 10 | A Casa do Bacalhau | Missing | Missing | Missing | `osm-node-5208009649` |
| 11 | A Cigarrinha | Missing | Missing | Missing | `osm-node-11893103024` |
| 12 | A Flor da Selva | Missing | Missing | Missing | `osm-node-10293661913` |
| 13 | A Gaúcha | Missing | Missing | Missing | `osm-node-14143368301` |
| 14 | A Tasca do Chico | Yes | Missing | Missing | `osm-node-1802158801` |
| 15 | A20 - Speaciality Coffee & Food | Missing | Missing | Missing | `osm-node-12323774404` |
| 16 | Adega das Gravatas | Missing | Missing | Missing | `osm-node-1606908881` |
| 17 | Al-Café | Missing | Missing | Missing | `osm-node-3724793425` |
| 18 | Albå | Missing | Missing | Missing | `osm-node-14136993901` |
| 19 | Alma (closed) | Missing | Missing | Missing | `osm-node-6268265385` |
| 20 | Amazonas | Missing | Missing | Missing | `osm-node-10253764125` |
| 21 | Aqueduto das Águas Livres | Missing | Missing | Missing | `osm-node-13950436040` |
| 22 | Arco de São Bento | Missing | Missing | Missing | `osm-way-995976870` |
| 23 | Arte Graça | Missing | Missing | Missing | `osm-way-454490420` |
| 24 | atelier Re.al | Missing | Missing | Missing | `osm-node-4864514661` |
| 25 | Babylon 360 | Missing | Missing | Missing | `osm-node-12849869103` |
| 26 | Baiwho Lisboa | Missing | Missing | Missing | `osm-way-1151534549` |
| 27 | Bar Na Colina | Missing | Missing | Missing | `osm-node-11350619739` |
| 28 | Barrio Latino | Missing | Missing | Missing | `osm-node-5324784522` |
| 29 | Basílica da Estrela | Missing | Missing | Missing | `osm-way-96359439` |
| 30 | Belcanto | Missing | Missing | Missing | `osm-node-11866440783` |

## Confirmed runtime defects addressed in this increment

- Place details previously only requested provider metadata for ordinary catalogue places when BOTH image and ratings were absent. A legitimate existing image could prevent missing Google ratings from ever being fetched. Fetch missing Google ratings on opening a place independent of image presence; session deduplication, existing upstream quotas and on-demand-only behavior remain.
- Google Text Search and Tripadvisor Terra hardcoded Poland. Pass the active city's country through the existing Worker city parser; use it in provider search. Polish UI language is retained.
- A provider response with no visible catalogue row used to render the entire main screen. Update only an existing row and the open detail sheet, preserving page/map state.

## Outstanding P0 work (not completed by this patch)

- Curate real exact-place licensed covers; all 30 still lack permanent covers.
- Write sourced editorial what/why descriptions for the 24 missing entries. Do not manufacture provider descriptions or reviews.
- Review candidate quality: `Alma (closed)` and the A Cigarrinha record warrant verification before promotion; this audit does not delete or relabel them.
- Review / activate Tripadvisor only with an authorized configured integration; no new key or paid switch activated here.
- Record real-device first30 photo results, attribution and repeated refresh/offline QA; do not close #176 from green code tests.

Queries: counts over public published `places` joined to `cities`; `catalogue_places('lisbon')` read and sorted with current comparator. Hosted health advisors reported no health lints. No database writes or storage migrations performed.
