# P0 Lisbon pilot: three genuinely different editorial routes

**Status:** draft PR / desk-researched content, **NOT field-tested**, 2026-11-09.  
**Source:** `data/cities/lisbon/routes.json` and catalogue `data/cities/lisbon/places.json`.  
**Author:** City Route editorial; **not** community submissions or user ratings.

## What ships with this content package

- 3 original, distinct routes (6+9+8 stops), all references pointing to actual catalogue place IDs.
- Four essential places missing in the 188 OSM import, added as independently sourced editorial entries (Jerónimos, Praça do Comércio, Arco da Rua Augusta, Sé), preserving the exact 188-source OSM provenance and original SQL import.
- 19 existing stops enriched with short factual descriptions, real neighbourhood labels and adjusted approximate visit times.
- Three different authentic, rights-cleared Wikimedia Commons covers with author, license and source metadata. **These are route covers only; individual stop-photo coverage is still pending issue #176.**
- No fake community authors, reviews, user counts, venue photos, visit verification, pricing, or paid API calls.

## Route 1: Lizbona po zmroku — bary, fado i klub

**Intended:** adults, Fri/Sat, approx. 19:00–03:00, walking with optional short late-night ride.

| Order | Stop | Experience |
| --- | --- | --- |
| 1 | Foxtrot | Old-school cocktails and relaxed start in Príncipe Real |
| 2 | A Tasca do Chico | Small Bairro Alto fado venue; check that night's show |
| 3 | Maria Caxuxa | Social bar atmosphere in Bairro Alto |
| 4 | British Bar | Historic pub stop near Cais do Sodré |
| 5 | O'Gilins | Pub and potential live music; confirm programme |
| 6 | Finalmente Clube | Late-night dancing and drag performance |

**Operational caveats:** Foxtrot official hours differ between some sections of its own site (listed as Mon–Sat 18:00–02:00; FAQ states Fri/Sat through 03:00). Avoid a fixed final time until checked. Finalmente operates its discoteca in late-night hours (about 01:00–06:00). Schedule the final return from Cais do Sodré to Príncipe Real separately. Fado/music schedules and admission may change.

Sources: https://www.barfoxtrot.pt/en/contactos ; https://www.finalmenteclub.com/contactos/ ; venue OSM identities in curated catalogue.

Cover: Bairro Alto nightlife photograph by Jorge Franganillo, CC BY 2.0; https://commons.wikimedia.org/wiki/File:Lisboa_Bairro_Alto_(53893930842).jpg .

## Route 2: Lizbona pierwszy raz — klasyki w jeden dzień

**Intended:** Wed–Sun, about 09:30–18:30, walking + transit between Belém and Baixa.

| Order | Stop | Experience |
| --- | --- | --- |
| 1 | Mosteiro dos Jerónimos | Iconic UNESCO monastery |
| 2 | Torre de Belém | Waterside fortress |
| 3 | Padrão dos Descobrimentos | Monument to maritime exploration |
| 4 | MAAT | Contemporary architecture and optional exhibition |
| 5 | Praça do Comércio | Monumental square facing the Tagus |
| 6 | Arco da Rua Augusta | Ceremonial gateway into Baixa |
| 7 | Sé de Lisboa | Cathedral on the way up to the old quarter |
| 8 | Castelo de São Jorge | Castle with panoramic grounds |
| 9 | Miradouro de Santa Luzia | Viewpoint overlooking Alfama |

**Operational caveats:** Jerónimos and Belém Tower are closed on Mondays; MAAT closes Tuesdays, so use Wed–Sun for all interiors. The castle closes at 18:00 in November–February with last entrance at 17:30 — arrive with enough time and be ready to skip an interior visit if delayed. Venue tickets and entry time may increase the total beyond nine hours; listed timings are editorial estimates, not live routing.

Sources: https://mosteirojeronimos.torrebelem.gov.pt/pt/visitar ; https://maat.pt/en/plan-a-visit ; https://castelodesaojorge.pt/en/plan-your-visit/schedules/ .

Cover: Belém Tower by Lisbon Photoshoots, CC BY-SA 4.0; https://commons.wikimedia.org/wiki/File:Bel%C3%A9m_Tower_in_Lisbon.jpg .

## Route 3: Lizbona smakuje najlepiej z góry

**Intended:** Mon–Sat, roughly 12:00–21:00, walking, substantial climbs.

| Order | Stop | Experience |
| --- | --- | --- |
| 1 | Confeitaria Nacional | Historic patisserie, coffee and pastry |
| 2 | Miradouro de São Pedro de Alcântara | First citywide panorama |
| 3 | Miradouro do Torel | Quieter hillside view |
| 4 | Restaurante Zé Dos Cornos | Unpretentious Portuguese lunch |
| 5 | Miradouro do Monte Agudo | Less touristy viewpoint north of the centre |
| 6 | Botequim | Historical Graça stop for a drink |
| 7 | Miradouro Sophia de Mello Breyner Andresen | Graça panorama |
| 8 | A Baiuca | Small Alfama tavern and dinner alongside fado |

**Operational caveats:** Zé Dos Cornos lunch hours are limited and Sunday's opening is unconfirmed/likely closed; A Baiuca starts dinner at about 20:00 and is small. This is an intensive walk with hills and a late dinner, not a guaranteed sunset route.

Sources: https://www.visitlisboa.com/en/places/miradouro-de-monte-agudo ; https://roteiro.museudofado.pt/local/a-baiuca .

Cover: Miradouro São Pedro panorama by Ingo Mehling, CC BY-SA 4.0; https://commons.wikimedia.org/wiki/File:Lissabon_-_Sao_Pedro_de_Alcantara.jpg .

## Runtime integration and verification gate

1. **Static fallback:** existing app reads `data/cities/lisbon/places.json` and `routes.json`; the new route records are compatible with the current editorial route-card/detail format.
2. **Supabase caveat:** `loadCatalogueWithFallback` prefers hosted Supabase when available. This PR alone **does not publish these routes to hosted Supabase**. Use a separate reviewed, additive import/parity package if hosted catalogue is active. Do not claim production visibility until tested.
3. **P0 pictures:** route **covers** exist and have source/credits. Individual place photos are not complete; address through existing issue #176, never insert unrelated stock as substitute.
4. **Pricing:** imported legacy records often have `cost:0` with `metadata.costUnknown:true` and real admission fees may apply. A `0` is **not** an asserted free entry. Avoid “free route” claims until display respects the unknown-cost flag.
5. **Opening hours:** schedule hints are metadata/content only; this does not implement a live opening-hours validator. Route Mode needs to keep an honest “verify before visiting” note in the upcoming UX package.
6. **Authenticity:** desk validation is not walking the itinerary. Test at least one full real-world pass of every route before describing it as “tried by travellers”.
7. **QA:** check all 23 stop references, license metadata and exactly three distinct covers; run `npm test` and `npm run build`, check route-card cover loading on iPhone 13 Pro, and test restart/resume of one route.

Keep future Start UX and Planner V2 integration separate from this content PR to avoid simultaneous edits to `app.js` while PRs #173 and #143 are open.
