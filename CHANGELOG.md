# Changelog

## 2026-11-03 — quick place composer (CLAUDE-PLACE-017)
One search box on "Dodaj miejsce" takes a name, address, Google Maps link or coordinates. City Route catalogue and own places are searched first (duplicate warning within ~120 m), then OSM suggestions scoped to the active city, so Kraków no longer resolves to Warsaw. Unknown places get a prefilled name and a draggable pin; saving needs no photo, account or API key and stays on the device. Google photos are display-only with attribution and are no longer copied into the user's photo. Fixed Photon fallback that never worked (`lang=pl` returns HTTP 400). 164 tests pass; verified in the browser at 375 px for Warsaw and Kraków. Google Autocomplete is wired but off until approved.

## 2026-11-02 — foundation
Read full brief, inspected live GitHub architecture of Vowl/Studio, created independent repository, preserved product and continuity contract. Static Cloudflare packaging selected.

## 2026-11-02 — working MVP
Explore, Best of City source discovery, Sidequests, preference builder, shared basket and ordering, complete route execution, local test profile/events/export, installable manifest and offline asset cache. 12 Warsaw walks, 30 places, 30 activity prompts. Six automated tests passed; browser verified route start, done/skip, refresh/resume and recommendation. Fixed UUID fallback for HTTP preview. Source ratings still require manual verification; source buttons currently open attributed searches. General Warsaw cover is reused pending per-route photography.

## 2026-11-02 — intent-first experience and social demo
Start screen separates plan/food/stay/people. Four navigation destinations. Resident/visitor/1–12 month profile with local activity stats. 10 demo hotels. Nieoczywiste is an activity layer separate from place catalogue. Expandable source details and per-place description/review dialog with private local rating. Sample daily meetups, device-local join/chat and friend connection simulation. Empty community ranking. Real GetYourGuide SVG. System font stack. EXPERIENCE.md defines UX/data boundaries and future backend. Ten automated tests passed; browser tested stay persistence, demo join/chat, description/review and saved private rating.

## 2026-11-02 — review volumes and source policy
Restaurant/hotel scores now weighted by per-source review counts, with /10 normalized to /5. Counts on card and source rows; unknown/zero counts excluded. Restaurants Google/Tripadvisor; hotels Google/Booking/Airbnb. City Route opinions shown separately, not in ranking. Demo counts explicitly labeled. Twelve tests pass, including 5000×4.5 + 500×4.0 = 4.4545 and missing-count exclusions; browser verified source counts and 4,45 display.

## 2026-11-02 — routes first, real ratings, photos, profile
Five tabs: Trasy, Miejsca, Zaplanuj, Moja trasa (cyan when a route is chosen, red "Na żywo" while walking), Profil. Intent categories replace area chips. Google Maps and Tripadvisor ratings and review counts for all 50 places, checked by hand on 2026-11-02, with per-platform counts on every card and a weighted combined score; DEMO scores removed. A credited photo for every place. Profile with stay type, bio, social links and local stats. Data-sources page in the app and DATA_SOURCES.md. 14 tests pass.

## 2026-11-02 — strict categories and your own places
Each place now belongs to exactly one category (Zabytki, Muzea, Parki i ogrody, Wisła i widoki, Ulice i okolice, Jedzenie, Noclegi); Side questy are only activities; Must-see is a badge. Users can add their own places with GPS or a Google Maps link and an optional photo (stored on the device). Hotels compare on Google Hotels and Booking. Whole route opens as one Google Maps link. Stops seen only from outside say so and link to tickets. Residents don't see hotels. Sort by distance. New versions apply without closing tabs. Demo social screens removed. 17 tests pass.

## 2026-11-02 — Zarezerwuj and planner v2
New Zarezerwuj tab (hotels, tickets, tables) keeps paying apart from exploring; Profil opens from the header avatar and can have a photo. Places hold only things to see and eat, with Zieleń replacing Parki i ogrody, Syrenka in Zabytki and the fountain park in Zieleń. The planner can start from your location, ranks places by a rating smoothed by review count, and puts a requested coffee or meal stop in the middle of the route. Live mode shows the side quest for the current stop and can read the stop aloud. 20 tests pass.

## 2026-11-02 — Odkrywaj with events
Miejsca becomes Odkrywaj with a Miejsca | Wydarzenia switch. Wydarzenia has Globalne (Ticketmaster via a small Cloudflare Worker, filters for today, weekend, 7 and 30 days and by type, one-click "Kup bilet") and Społecznościowe (planned for verified users, honest empty state). Needs the TICKETMASTER_API_KEY secret in Cloudflare to show events. 21 tests pass.

## 2026-11-02 — private or public places
When adding your own place you choose who sees it: only you, or everyone. The place card shows the choice and lets you change it. Public places will reach other people once accounts, a shared database and moderation exist; until then they stay on your device and the app says so.

## 2026-11-02 — O City Route
New page explaining what City Route is, how to use it in four steps, what each tab does and what we promise about data, bookings and privacy. Opens from Profil and from "Jak to działa?" on Trasy.


## 2026-11-02 — planner-first route lifecycle
Default first tab Ułóż trasę; full planner title Zaplanuj moją trasę. Explicit Trasy and Miejsca labels. Moja trasa keeps its name plus Gotowa/W toku, retaining blue/red state colors and resume. Side questy accessible in Miejsca. Current Claude changes preserved. 21 tests/build pass; browser tested full plan/start/resume/complete flow.

## 2026-11-02 — manual route and Maps repairs
Manual route entry, pointer drag ordering and sequential stop addition; broader coordinate parsing and safe Cloudflare short-link resolver; official ticket links first and secondary offers separated. Verification stays unclaimed. See STATUS for accounts/photo/catalogue work still outstanding.

## 2026-11-03 — Kraków content quality
Kraków catalogue cleaned from 220 to 208 places: duplicates and chains removed, 5 important places added, wrong coordinates of seven curated places fixed, real neighbourhoods instead of "Kraków", better categories and tags, short descriptions for every curated place. All 15 Kraków routes checked and re-ordered, with the Nowa Huta walk going from 14.5 km to 3.3 km. Editorial decisions live in curation.json and survive regeneration; an enrichment report lists missing photos, ratings, websites and hours. 59 tests pass.

## 2026-11-05 — automatic photo proposal in Add Place (PHOTO-COVERAGE-039, P0 #1)
After choosing a venue in "Dodaj miejsce" the form now proposes a real photo of that exact place on its own: the Google photo (preview only, when the Worker has a key), the lead photo of the Wikipedia article about the place (article within 350 m and sharing the place's distinctive name word), then named geotagged Commons files. Every candidate passes the existing Commons licence/author/resolution gate. The user picks "Użyj zdjęcia", "Inne" or "Pomiń" (or "Dodaj własne"); an accepted photo is stored on the new place with author, licence and source, and the user's own upload always wins. Nothing found shows an honest "Nie mamy pewnego zdjęcia tego miejsca". Root causes fixed on the way: Wikimedia now serves thumbnails from thumb.wikimedia.org, which the old gate rejected (this also starved the card fallback), and ported licences such as "CC BY-SA 3.0 pl" were refused. PWA cache v60.
Follow-up: cafés and restaurants without a free photo now get the Google photo of the same venue when the Worker has a Google key (shown through the proxy, never copied); the Worker's Google soft cap was stuck at 25 calls a day and now defaults to the documented 300.

## 2026-11-05 — icon cleanup completed (VISUAL-SYSTEM-057, P0 #2, on top of PR #96)
The last text glyphs that stood in for icons are now local Lucide SVGs: route stop paths ("A › B" chevrons instead of "→"), "Zobacz trasy", "Moje dodane miejsca", "Gotowe trasy" and request ranking links, the drag handle (new Lucide grip-vertical, 44 px target instead of "⠿"), the planner disclosure ("⌄"), the external request link ("↗"), the map card and publish dialog close buttons ("×"), and every "GDZIE TO JEST?" menu path in the guide. The guard test now covers these modules and characters. PWA cache v61.

## 2026-11-05 — Google main photo first
Google photos now keep Google's order: the place's main photo (the cover shown in Google Maps) is used unless it is unusable (short side under 400 px or extreme ratio). Ranking by resolution had picked random visitor shots, e.g. a blurry dance floor for Sketch Nite. PWA cache v63.

## 2026-11-05 — Add Place no longer widens the phone layout
The invisible "Dodaj zdjęcia" file input was absolutely positioned against the whole page, so it took the full page width and pushed the layout to ~406 px on a 375 px phone; the photo proposal buttons did not wrap either. On iPhone this shifts and zooms the page and can make taps on "Zaproponuj społeczności" and "Dodaj miejsce" miss. The input now stays inside its label and the buttons wrap. PWA cache v64.

## 2026-11-05 — agent team v1 and personas v1.0
Eight role-based agents (Coordinator, Auditor, UX Editor, API Integrator, Source Scout, Place Curator, QA / Release, Reviewer) with Claude Code subagent files in `.claude/agents/`, shared rules and file ownership in `docs/agents/TEAM.md`, per-role notes, a sources registry and an "Audit finding" issue template. The founder's four v1.0 personas are canonical in `docs/personas/`. The built service worker's cache name now carries a content hash, so feature PRs no longer bump the PWA version by hand. No app behaviour change.

## 2026-11-05 — profile photo on the account, friends' profiles open
Founder report: the profile photo did not survive on desktop or after signing in, and friends' profiles could not be opened or followed. Causes: the photo lived only in one browser's localStorage (no column, no upload) and a guest photo stayed in the guest scope after sign-in; friend rows had no link, and `public_profile` only returned authors with a published route (Warsaw has none). Now `profile-avatar.js` uploads the photo to Storage `city-route-avatars/<user>/avatar.jpg`, stores `profiles.avatar_path` and restores it on every device (adopting a guest photo on first sign-in); friend rows link to `#social-profile/<id>`; migration 017 lets signed-in explorers open any profile (they could already read `profiles`). Until 017 is applied the app keeps the old local-only behaviour.

## 2026-11-05 — saved places follow the account
Founder report: a place saved on the phone was missing on the desktop. Saves lived only in one browser's localStorage. Now `saved-places-sync.js` sends each save/unsave to `public.user_saved_places` (migration 018, own rows only), queues changes offline, merges on sign-in and whenever the app returns to the foreground (first sync on a device adds its existing saves instead of dropping them), and hands the result to `app.js`. Private places created on one device (`u-…`) stay local. Until 018 is applied the app keeps the local-only behaviour.
