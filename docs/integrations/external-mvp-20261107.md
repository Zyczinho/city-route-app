# External integrations MVP — 2026-11-07

Status: PR #151 DRAFT; do not merge until mobile QA, independent code review and production budget/privacy acceptance.

## Sharing
- Reuse existing published route /r/ URLs and Open Graph cards from #116 for WhatsApp/Messenger previews.
- Chooser contains WhatsApp, OS native Web Share, Instagram and Messenger. Instagram/Messenger open their inbox; user copies/pastes link. These are not automatic DMs and not a Meta messaging API integration.
- Device-only/generated plans share a clearly identified Google Maps itinerary, not a fabricated public City Route URL. These links are available for walking/bicycling, up to the Google Maps waypoint limits.

## Strava
- Download GPX 1.1 route waypoint XML from current, saved, generated or finished route. It contains names and coordinates only, no GPS track or realistic street geometry. Strava may require waypoints to be connected/edited.
- On Strava web choose Dashboard → My Routes → Create New Route → upload GPX. Confirm geometry before saving.
- A planned route must NOT be uploaded as a completed workout. Full Strava OAuth, actual GPS activity history, bi-directional route sync and uploads are separate gated work requiring client registration, secrets in backend, minimal scopes, revocation, rate limits, permission and privacy review.

## Google Saved import
- Profile → Integracje i import → select a single extracted Google Takeout Saved CSV (not ZIP), or Google My Maps KML point file (extract from KMZ first), or point GeoJSON/JSON. Max 2 MB/2000 records; parsing happens locally.
- KML supports Google My Maps Point Placemarks with name, description, coordinates (lines and polygons are ignored). CSV supports title, item_content_url/url, note and optionally latitude/longitude. It tolerates an optional description line and quoted multiline cells.
- Title matching uses the selected-city catalogue; a coordinate narrows matches to 250 meters. Coordinates are accepted only when explicitly present in the file or Google Maps place URL; /@viewport is not a place location.
- Known catalogue matches are bookmarked and use existing account saved-place sync. Unknown points with valid coordinates inside selected city become private local u- places. These do NOT yet sync across devices. Unmatched names and opaque links are skipped and counted in confirmation.
- Roll back local state on storage failure; no auto-publication, scraping, reviews or arbitrary photo copying.

## Pending architecture
1. Personal-place account sync with Supabase owner-scoped RLS, duplicate merge and conflict resolution, plus two-account acceptance.
2. Optional Google Data Portability API (verification, sensitive/restricted OAuth scopes) for full user-authorized collection transfer and explicit resolution of unmatched Google IDs.
3. Strava OAuth backend integration, activity read/sync only with permission; no fabricated GPS tracks, no client secret in PWA.
4. Mobile 375/390px and iPhone 13 Pro QA: copy/share via 3 channels, public preview, private itinerary, GPX download and a real Takeout CSV from consenting tester.

Rollback: revert PR #151; no migrations, keys or account data deletions.