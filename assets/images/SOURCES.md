# Image provenance

Every place and sidequest names its photo in `data/places.json` / `data/sidequests.json` under `image` and `imageCredit` (author, license, license URL, source page). The app shows that credit under the photo in the place sheet, and the "Skąd są dane" page summarises it.

Rules used on 2026-11-02:

- First choice: Wikimedia Commons, free licenses only (CC0, CC BY, CC BY-SA, public domain). Downloaded through the Commons API thumbnail, resized to max 960 px, JPEG q78. Nothing else was edited. Files: `place-<place id>.jpg`.
- Four earlier Pexels photos remain (Pexels License): `place-31495562.jpg` Royal Castle and Castle Square, `place-35839613.jpg` Barbican, `place-12028385.jpg` University Library garden, `place-17131946.jpg` Palace of Culture. Source pages are in each place's `imageCredit.source`. Re-encoded to 960 px.
- Five restaurants had no free photo, so the app loads one image from the venue's own website (hotlinked, not stored in this repo): Stary Dom, Der Elefant, Sapko Kebab, Concept Food & Wine, Koneser Grill (koneser.eu). These need the venue's permission before a public launch; replace them with own or licensed photos if permission is not given.
- Azia, Freya and Spółdzielnia show the Centrum Praskie Koneser building they are in; EFES shows ul. Francuska. The photo caption says so (`imageCaption`).
- Photos from Google Maps and Tripadvisor are not copied: their terms do not allow re-hosting user photos.

A contact sheet of every photo was reviewed by eye to confirm it shows the named place.

UI icons: Lucide (lucide-static 0.454.0, ISC, see `../icons/LUCIDE-LICENSE.txt`). Google Maps and Tripadvisor marks: Simple Icons, CC0; trademarks belong to their owners and are used only to identify the rating source. Logo extracted unchanged from the City Route App brief v1.3.

## Route main photos (`route-<route id>.jpg`)

Rule from the product owner: every route has its own main photo, and no main photo is ever repeated, even when routes share stops. `tests/route-covers.test.js` fails if two routes in any city share a file or a source photo, or if a route cover repeats a place photo.

- Each editorial route stores `image`, `imageCaption` and `imageCredit` (author, license, license URL, Commons source page, `quality`) in `data/routes.json` / `data/cities/<city>/routes.json`.
- Source: Wikimedia Commons, free licenses only. Commons *Featured pictures* and *Quality images* first; when none fit the route's subject, the best regular photo found was used, and `quality` says "Commons".
- Processing: Commons thumbnail, centre crop to at most 16:9, resized to 1280 px wide, JPEG q82. Nothing else was edited.
- Every photo was reviewed by eye on a contact sheet before it was added.
- Generated and user routes pick a free stop photo through `route-covers.js` (`assignRouteCovers`), never one already shown by another route.
