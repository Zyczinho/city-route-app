# P0 — Frictionless places and routes (product spec v1)
Date: 2026-11-03. Product directive. **Documentation only. Do not modify runtime / migrations until dependencies and ownership are reconciled.**

## Thesis
The core must be so fast that a friend will contribute a recommendation immediately: **name or Maps link → confirm place → save → add to route**. No AI assistant, chat, mandatory rating, or photo upload required. A place absent from Google must be just as easy to add. P0 includes easy route composition, reuse, and publishing.

Success target (experiment, not a claim): median <=15 seconds to add a recognized place, <=30 seconds to add a new coordinate-only place, >=80% completion for invited testers, <2 taps to add a saved place to draft, >=60% testers create and save a 3-stop route without coaching. Record time-to-save with actual analytics.

## Single entry point / UX
Available from Places, map pin, route builder and empty search results; use one recognizable action `+ Dodaj miejsce`.

One prominent input: **"Wpisz nazwę, adres, link z Google Maps albo współrzędne"**. Input examples:
- `Nudlani` -> suggestions constrained/bias to *active city* and viewport, displaying name + street/district + source. Query does not mean exact name; verify chosen candidate.
- Google Maps long or short link -> safe redirect resolution, find coordinates / place name, display confirmation.
- `52.230123, 21.012345` -> parse both decimal points, coordinate validations and city boundary, put a movable pin on existing OSM map.
- Custom `Punkt widokowy na skarpie` -> if no indexed result, clear `Nie ma na mapach? Dodaj własne miejsce` continuation, name stays prefilled, choose pin on map, never block on Google lookup.

After result selection show lightweight preview:
- name (editable)
- category auto-suggested (editable)
- map location and address (if available); allow pin adjust
- photo if an authorized, properly licensed image is available; otherwise optional Upload/Take Photo and graceful no-photo placeholder
- free-text `Dlaczego polecasz?` optional; 1–5 own rating optional; neither blocks save
- visibility: `Tylko dla mnie` / `Zaproponuj społeczności` (clear actual consequences)
- primary **Dodaj miejsce**; secondary **Dodaj do mojej trasy**. After save present `Dodano · Dodaj kolejny punkt` / `Zobacz moją trasę`.
No login to compose a private/local place or route. Sign-in only when submitting publicly, and preserve draft across auth.

### Location/source paths
1. Existing catalogue match: show `Już mamy to miejsce` and offer `Oceń`, `Dodaj do trasy`, `Zapisz`; avoid duplicate canonical place.
2. Geo-provider match: resolve an external provider ID and user-approved name/position; keep independent canonical place identity; attribution and caching compliance.
3. No match: user sets name + pin or coordinates and adds immediately without photograph.
4. Invalid/unsupported Google short link: preserve user text and offer pin/manual coordinates rather than hard failure.
5. Offline/no API key: search existing local catalogue, paste raw coordinates or mark pin; photo optional.

### Critical current-code gaps observed
- `app.js` `addPlaceView`: many required fields; user-added places are currently device-local (public flag is future intention).
- `enhancements.js`: address lookup is submit-triggered, not live autocomplete; `WARSAW`, Warsaw-only geocoding/search and fixed viewbox lead to wrong behavior in Kraków; `maps-preview.js` `searchPlace()` uses `${name} Warszawa` even when geocoordinates indicate another city.
- `maps-preview.js` + `enhancements.js` can proxy a Google photo into a File and compress it to user local data; DO NOT promote this workflow to permanent community media. Review current usage under Google Maps Platform EEA terms. Place photos cannot simply be downloaded and re-uploaded as City Route-owned assets.
- Public route publishing currently accepts catalogue places only, so a newly created private pin cannot become a public route stop. Require a canonical approved place ID and migration/sync from local provisional IDs.
- Existing `catalogue_requests` is a separate demand/voting system, NOT a shared place contribution system; don't duplicate or override request records.

### Architectural delivery
**Frontend:** isolated `place-composer.js/css` modal/screen; minimal bridge to current `app.js` and route builder. Debounce user-initiated suggestions (e.g. 250–350ms), prevent stale responses, 3+ chars, cap results ~5, accessible keyboard list; map selection explicit; no search as user types on public Nominatim API.

**Provider abstraction:**
- existing local catalogue first (free),
- reliable licensed autocomplete provider (evaluate Google Places Autocomplete New / paid alternate based on EEA permitted uses and costs),
- optional OSM/Photon self-host or licensed third party search,
- pasted maps URL / raw coordinates / pin always works.
- Cloudflare Worker as provider proxy to protect keys, set small costs/quota/rate limits; per-session Google token and relevant field masks, user-cancelled request cleanup.

**Google EEA restrictions (verify live at implementation):**
- Places permitted-use scope includes address autocomplete and tagging/sharing a place in user posts/social experiences; broad ingestion into an independent POI database and photos are not automatically permitted.
- Google Places content associated with a map is restricted under EEA terms; current map is Leaflet/OSM. Only latitude, longitude, place_id can be used with any map as defined. Keep Google content in a compliant separate detail UI or appropriate authorized component; do not rehost photos, cache photo names or omit photo author attributions.
- Persist external `place_id` where allowed, independently submitted user fields, coordinates from independently permitted source; fetch compliant Google photo metadata/photo on demand, without turning into uploaded files. Prefer owned user images or suitably licensed Wikimedia Commons, with license/creator credit, for public reusable cards.

**Backend:** Supabase proposed `place_submissions` table (distinct from catalogue requests) with `id`, `city_id`, `submitted_by`, `name`, `description`, `category_id`, `lat/lon` + source provenance, `external_provider`, `external_id`, `source_url`, `image_asset_id`, `status` pending/approved/rejected/merged, `canonical_place_id`, timestamps; separate user place ratings keyed by user and canonical place. RLS ensures authors see own submissions; an admin-reviewed approval publishes in `places`. Duplicate normalization + distance threshold + category; city bounds; rate limits; content moderation; an owner-uploaded image in a separate Supabase Storage bucket with rights declaration/validation, dimension and size caps. Do not re-use existing request RPC for actual community place creation.

**Content and publishing:** Save provisional place to my route immediately in browser. On successful public submission, show `Zgłoszono społeczności` pending confirmation, NEVER `Publicznie dodane` before approval. Approved canonical location can be used by other users and public routes; map provisional route stops to canonical IDs after approval. Avoid broken published routes if removed/merged. A founder-verified cohort could gain instant publish later with abuse controls.

## P0 route builder
- preserve one city-scoped ordered draft across sessions, as in `ROUTE_BUILDER.md`
- three entry points: `Dodaj do trasy` directly from place composer / maps / place cards
- `Dodaj kolejne miejsce` immediately after save and in My Route; autocomplete reused
- move stops with direct touch drag and arrow alternative, live map numbered pins, undo, save as private route, share via URL when supported, Start.
- If user has 3 stops: name optional; `Zapisz trasę` should work without forced extras.
- Publish community route requires authenticated user + canonical published place IDs; show specific blocker and continue private if a stop awaits approval.
- Real walking route/ETA provider is future enhancement. Never claim straight-line estimate as accurate road routing.

## Sequence and test gates
0. **Operational release gate**: resolve P0 startup/cache/installed PWA issue and production smoke before UI rewrites; current main may have merged PR #54 but does not mean completed verification.
1. **P0-PLACE-001**: redesign add-place UI + coordinate/Google-link parsing + local catalogue suggestions + map pin for nonindexed POI; verified manual full flow *without any paid APIs*.
2. **P0-PLACE-002**: provider autocomplete with city-aware bias + compliant photo preview, API key/billing controls, server-side error fallback; address Warsaw/Kraków regressions.
3. **P0-PLACE-003**: shared moderated submission + photo upload + canonical ID/route-stop transition, distinct from request/voting system.
4. **P0-ROUTE-004**: frictionless 3-stop builder, add-from-compose, confirm save and publish with approved places; preserve legacy drafts.
5. **P1-INTENT**: previously discussed four paths `Poznaj swoje miasto`, `Mam tylko kilka godzin`, `Pokaż mi coś lokalnego`, `Gdzie dziś wyjść?` built ON TOP OF solid P0 catalogue/contribution flows.
6. **P2 EVENTS**: real event ingestion, organizer, RSVP, moderation; no fictitious popularity.
7. **P3 COMMERCIAL**: day/month/year pass and creator/business hypothesis tests; do not monetize P0 adding simple places/routes.

## Acceptance cases
- Typing `Nudlani` produces source-labeled suggestions if a licensed provider returns match; user can select and save. If no match, custom place path still works.
- Pasting `maps.app.goo.gl` link (supported redirect) populates coordinates and candidate name if present; failed redirect falls back to input and manual pin.
- Pasting latitude/longitude accepts valid Polish decimal formats and rejects invalid/out-of-city coordinates with helpful message.
- Unindexed `Punkt widokowy` saves without a photo and can be placed in a private route.
- Existing place match does not create duplicate; notes/rating remain optional.
- User may add place and next stop without navigating out/back; can save or start three stops.
- Account sign-in preserves private draft and resumes pending public submission; second account sees published place only after approval.
- Photo placeholders/permission/author attribution are correct; no licensed provider images are copied into Storage as user uploads.
- Budapest/other non-Warsaw city cannot be mistakenly assigned to Warsaw, or result must prompt a city switch.
- Tests + build + 375px touch interaction + old installed PWA upgrade + production smoke, no regression of social requests or route publish.

## Decision record
User's priority supersedes implementing additional AI, pricing and discovery tabs ahead of place and route input. The vision remains the same, only execution priority changes.
