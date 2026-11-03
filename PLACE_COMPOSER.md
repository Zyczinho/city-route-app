# Quick place composer (CLAUDE-PLACE-017)

One search box on `#add-place` replaces the old multi-step "where" input. It decorates the form rendered by `app.js`; `app.js` still validates and saves the place, so nothing about storage changed. Saved places stay on the device (`visibility: private` unless the user picks "Zaproponuj społeczności", which keeps the existing honest note: nothing leaves the device yet).

## What the user types

| Input | What happens |
|---|---|
| Name or address (3+ chars) | City Route catalogue + own places first (instant, offline), then `/api/place-suggest` after 300 ms. Stale responses are dropped. Last row is always "Dodaj „…” jako własne miejsce". |
| Google Maps link (full or `maps.app.goo.gl`) | `/api/place-preview` resolves name + coordinates. On failure the link is kept in `where` (app.js retries via `/api/location` on save) and the pin map opens. |
| Coordinates (`52.23, 21.01`, `52,23; 21,01`, `52,230123, 21,012345`) | Parsed locally, checked against the active city radius. |
| Nothing found | Name is prefilled, an OSM map opens, the user taps or drags the pin. Save is blocked only until a pin is placed. |

A new query drops the previous pick (its coordinates, preview, map and auto-filled name), so place B is never saved at place A's location; only a pin placed by hand survives renaming. Picks that resolve after a newer query, and app.js re-renders from an older draft, cannot bring A back.

After a pick: name (editable), suggested category, location written to `where` as coordinates, preview card with source label, and a duplicate warning when a known place sits within ~120 m with a shared name word (or within 25 m). Picking a catalogue match shows "Już mamy to miejsce" with `Zobacz` / `Dodaj do Mojej trasy` (app.js actions `place` and `add`).

## Providers and cost

- Default: **OSM Photon** via the Worker, restricted to a box around the active city, cached for a day. No key, no cost. Public Photon rejects `lang=pl` (HTTP 400), so requests use `lang=default`; that bug had silently disabled the old Photon fallback too.
- **Google Places Autocomplete** runs only when both `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACES_AUTOCOMPLETE=on` are set (session tokens, details on selection, never cached). Turning it on is a paid-usage decision for Jakub. `GOOGLE_PLACES_DAILY_CAP` (default 300) is a soft per-instance guard; the real cap belongs in Google Cloud quotas.
- Without the Worker API (static hosting, offline) the box still offers catalogue matches, coordinates and the pin.
- No public Nominatim type-ahead. Nominatim is still used only on an explicit save of a typed address (existing behaviour, now city-aware).

## Photos and licences

Google photos are shown only as a display preview (`/api/place-photo?id=`, `private, no-store`) with the author's attribution and the note "Tylko podgląd, nie zapisujemy go". The old flow that copied the Google photo into the user's own photo field was removed. The user's own photo upload is unchanged and optional. For Google results the OSM map is not opened automatically (EEA terms on Google content next to a non-Google map); the user can still tap `Popraw pinezkę`.

## Integration left for app.js / service worker (owned by ChatGPT)

1. **Optional 1–5 rating on add** — `app.js` `addPlaceView`/`keepDraft`/`place-form` submit: add a `rating` radio, keep it in `draft`, and after `state.userPlaces.unshift(p)` set `if(Number(draft.rating)>=1)state.placeReviews[p.id]=Number(draft.rating);`. Update the "Nie dodajemy ocen…" note.
2. **"Dodaj do mojej trasy" right after save** — after a successful save, offer `Dodaj do Mojej trasy` / `Dodaj kolejne miejsce` (the place dialog already has the add button, so this is one tap today).
3. **Service worker precache** — add `./place-composer.js?v=1`, `./place-composer-model.js`, `./place-composer.css?v=1` and `./enhancements.js?v=23` to `FILES` with the next cache bump (PR #57 already bumps to v34). Until then the composer loads from the network; offline it is simply absent and the original form still works.
4. `scripts/build.mjs` has one extra line for the three new files; it will need a trivial merge with PR #57's edit of the main list.
