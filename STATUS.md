# Status — 2026-11-02

Branch: work/mvp. Current checkpoint: product/architecture foundation; use git log -1 for this commit's exact SHA (a commit cannot contain its own hash).

## Completed
- Entire v1.3 brief read, including logo and visual reference; text preserved in PRODUCT.md.
- Inspected current main of Zyczinho/cave-access-prototype (Vowl) and Zyczinho/1001-cave.
- Created private Zyczinho/city-route-app repo.
- Chosen vanilla HTML/CSS/JS, local JSON, manifest, versioned app-only offline cache, localStorage and static Cloudflare deployment.
- Adapted Vowl's buildless local run and continuity pattern. Deliberate differences: no D1, friends API, push or cron; deploy dist only to keep docs private; scope cache cleanup to this app.

## Working MVP checkpoint
Explore, Best of City, Sidequests, Build, My Route, reorder/remove/optimize, Route Detail, Start/Navigate/Done/Skip/Complete and recommendation implemented. Local nickname, event log and JSON export implemented. Manifest/icons and app-scoped offline cache implemented.

Validation: six Node tests pass, JS syntax checks pass, static build succeeds. Browser verified full 4-stop route with 3 done/1 skip, reload at stop 2 preserving state, and recommendation persistence. HTTP preview cannot verify secure-context service worker installation. Phone device/offline install QA remains.

Known limitations: 30 sidequests are simple prompts anchored to 30 places; source rating aggregation is pending verified manual ratings. Source tabs expose searches, not claimed endorsements. One city cover image reused. No live directions or opening hours. Generated route detail is session-memory only until saved to My Route or started.

## Next
1. Verify seeded source ratings/links and curate richer sidequests.
2. Finish hosted HTTPS deployment and offline/mobile install QA.
3. Add product card to Studio in a separate PR.
4. Test outdoors with founder, export events and inspect start/completion ratios.

Current branch work/mvp; previous pushed checkpoint f6e5ab1c413954079db9ee3cd71fec8a435bc734. This checkpoint hash: git log -1 after fetching. Run npm test, npm run build, python3 -m http.server 4180 --directory dist.
Cloudflare Pages is prepared: main, npm run build, dist. Direct account connection is not configured. Optional private Sites mirror registered as appgprj_6ae878f238188191ad1c9de840ad1bc7; not yet deployed. No secrets required.

## Published handoff
Canonical main MVP commit: 859f2e557e7de647bf611a9a780e48e1bc7f8de5 (work/mvp also points here). Current branch for next work: create claude/* from current main, which additionally includes this handoff.
Private convenience mirror deployed successfully: https://city-route-app.pocztowka.chatgpt.site (requires owner ChatGPT login). Mirror packaging commit e8ae4b752656ff7c33f7c2fd1ea54bb34ac6fe56; GitHub remains canonical. Do not develop against the mirror repository.
Studio card commit: 2df9f0c30a0b3bfaa13a75235b95c0cf1b87a35f, branch codex/city-route-app, PR https://github.com/Zyczinho/1001-cave/pull/6. PR is open, not merged or live. Contains logo, status, description and repo link. Add live URL after independent Cloudflare deployment.
Independent Cloudflare account deployment not completed: no connected Cloudflare management tool/account session was established. Next agent: connect GitHub repo in Cloudflare Pages, main / npm run build / dist; no env vars. See https://developers.cloudflare.com/pages/get-started/git-integration/ . Private mirror is not a substitute for this independence requirement.
PWA manifest/cache foundation is implemented; offline install on HTTPS and physical phone still needs verification. Source aggregation remains a staged feature: source tabs currently open searches, no verified rating records yet. Do not describe it as finished multi-source rankings.

## Visual/social iteration — 2026-11-02
Added photo covers to all discovery/sidequest cards, blue palette and primary actions, distinct source chip colors/icons, illustrative per-source scores and arithmetic blended mean (3 numeric scores only). Atlas editorial pick excluded. All invented scores/picks explicitly marked DEMO per owner request; no real reviews claimed. Community demo route collection appears first in Explore. Friends nicknames can be added/removed locally with persistence, no invitations or backend. Discounts is a coming-soon tab. Existing route flow retained. Six core tests pass; browser checked source widgets and friend add/reload. Next: real images per place, verified source records, physical-phone navigation QA. Service worker cache bumped v2.

## Focused navigation — 2026-11-02
Four primary destinations: Explore, Places, Build, My Route. Sidequests accessible within Places. Friends/Discounts available in profile shortcuts. Local Lucide SVG UI icons and Simple Icons Maps/Tripadvisor marks; GYG/Atlas use brand-name color buttons. Cache v3. Six tests pass; browser checked discovery switch and source rendering.
Cloudflare transfer blocked by account authentication: GitHub sign-in returned Unable to sign in in dashboard. No independent deployment created. User must complete Cloudflare authentication to continue setup. Keep existing private mirror until independent deployment verified.

## Independent Cloudflare deployment confirmed — 2026-11-02
Owner deployed city-route-app via Cloudflare Workers Builds from Zyczinho/city-route-app. Production URL: https://city-route-app.jakublojek.workers.dev . Owner dashboard screenshot showed successful build and deployment, build command npm run build, deploy command npx wrangler deploy, root /. HTTP check returned app HTML with City Route App title and app.js module. This supersedes earlier authentication/deployment blockers. Automatic build trigger still needs confirmation; screenshot was marked Manually deployed. This documentation commit can serve as a trigger check. Existing private Sites URL is a convenience mirror only. Next: physical-phone/PWA/offline test and verify automatic deploy on main push.

## Polish Warsaw iteration — 2026-11-02
Branch work/warsaw-polish from 51709ae. Polish UI/seed copy, 18 local illustrative photo covers. Food strictly restaurant kind: Stary Dom and Der Elefant. Hotels: Polonia Palace and Bristol, official reservation website links, Booking search links. Scores are DEMO: hotels Google/Tripadvisor/Booking (10 normalized to 5), restaurants Google/Tripadvisor/Yelp, sights Google/Tripadvisor/GYG. Atlas removed from score filters and never averaged. Hotels excluded from route generator and not described as free stops. Eight tests passed including mixed-scale averaging and Food classification; browser checked Polish discovery and restaurant/hotel cards. Images are labeled illustrative, not verified photos of every named property. Next: verify Cloudflare main deployment, expand actual place photos/restaurants and collect verified ratings. Cloudflare production https://city-route-app.jakublojek.workers.dev ; private Sites mirror may lag production.

## Discovery quality iteration — 2026-11-02
Branch work/discovery-quality, based on a90df90. 10 restaurant demos (including Sapko and EFES) with cuisine filtering/search. Airbnb shown for hotels; all current records N/A because no exact listing matched, not proof of nonexistence. Yelp gaps also N/A. Missing scores unclickable and excluded from mean. Numeric scores remain clearly DEMO. Actual high-res images mapped for Castle Square, Barbican, BUW garden, Palace of Culture; reviewed contact sheet. Existing exact Old Town/Łazienki/Palace on Isle mappings retained. Other incorrect place images replaced by explicit placeholders, not arbitrary images. Sidequests inherit anchor images; portrait cover preserves aspect. Nine tests passed; browser checked Kebab returns Sapko/EFES with Yelp N/A. Cloudflare builds auto-publish from main (confirmed by owner's last dashboard screenshot); allow deployment time, do not equate transient 404 with disabled integration. Next: source actual images for remaining placeholders, verify restaurant score/listing identity, add matched Airbnb listings only when found. Restaurant map coordinates are seed approximations; source Maps search uses names to avoid pretending exact location validation. Do not label demo selection TOP10 ranking.

## Intent-first/social prototype — 2026-11-02
Branch work/intent-first-experience from bf274f8. Default entry #home: four intents plan, food, hotels, people. Nav Start/Odkrywaj/Moja trasa/Ludzie. Dedicated #food/#hotels contexts. Profile #profile: resident/visitor/temporary 1–12 months and local activity stats. Stay profile persisted. Card descriptions and external reviews revealed on demand; visible blended scores explicitly DEMO. Real GetYourGuide SVG with provenance. Local per-place ratings do not affect external demo means. 10 hotel seeds, 10 restaurants total (NOT 10 each cuisine, no real top ranking). #community has 3 sample daily walks, local join/cancel, local demo chat, friend connection simulation. No real accounts/invites/messages/network/ranking. See EXPERIENCE.md for boundaries and future shared schema. Existing route execution remains. Ten Node tests pass; browser tested home, stay save/reload, local meetup join/chat save/reload and description/review personal rating. Remaining: enrich sourced restaurant lists per cuisine/photos/verified source data, real backend/auth only in a later approved scope, physical-phone testing. Cloudflare auto main deployment; allow build time and installed-cache update before diagnosing stale code.

## Review-volume weighting — 2026-11-02
Branch work/review-volume-weighting from ea44de7. Restaurant sources Google Maps/Tripadvisor only; hotel sources Google Maps/Booking/Airbnb only. Seed records include illustrative reviewCount (explicit DEMO). Weighted normalized /5 mean; missing/zero/invalid count excludes source. Per-source and total counts displayed, comparison expanded on demand. Private City Route rating displayed separately in place dialog and excluded from blended. 12 tests pass; browser verified Stary Dom sample 5000 Google at 4.5 + 500 Tripadvisor at 4.0 displays 4,45. Other attraction category demos keep previous unweighted average. Next: replace demo inputs with verified ratings/counts, define community eligibility rules before including those scores. See EXPERIENCE.md for full formula and limitations. Cloudflare auto-publishes main; installed PWA can require closing old tabs for version activation.

## Routes-first navigation, real ratings and photos — 2026-11-02 (Claude Code)
Branch claude/routes-places-profile from main 2aac624. ChatGPT's work/sourced-discovery-profile branch had no commits beyond main, so this continues from main.
- Five tabs: Trasy (browse editorial and your saved routes), Miejsca (7 categories: Klasyka, Historia i muzea, Zieleń, Wisła i widoki, Jedzenie, Side questy, Noclegi; cuisine filter, sort, diacritic-insensitive search), Zaplanuj (chip-based planner, extra options folded), Moja trasa (cyan once a route is chosen, red "Na żywo" with pulse while a route runs; live guidance moved here from #active), Profil (stay type, bio, Instagram/TikTok/web links validated to http(s), local stats, empty community rating/ranking with explanation, data-sources page).
- Area chips (Starówka, Wisła, Parki, Praga, Centrum) replaced by intent categories; area is now metadata shown on cards and searchable.
- All DEMO ratings removed. Every place has Google Maps and Tripadvisor records checked 2026-11-02 with listing name and URL, or value null plus a reason. Combined score = review-count weighted mean (core.js combinedRating). Only ul. Francuska has no rating anywhere. See DATA_SOURCES.md.
- Every place and sidequest has a photo with credit: 41 Wikimedia Commons, 4 Pexels, 5 hotlinked from the venue's own site (permission needed before public launch). Contact sheet reviewed.
- Fake "community DEMO" route copies removed; community section shows saved user routes and an honest empty state. Friends/meetups demos kept under Profil.
- i18n.js removed: UI copy is Polish in app.js. styles.css rewritten as one design system. Service worker cache v8; photos cached on first view.
- 14 Node tests pass (new: rating records and reasons, combined score example, photo credits and categories, search folding). Browser-checked at 375×812: Trasy, Miejsca, place sheet, route detail, start → live (red tab) → done/skip → finish → recommend, basket (cyan tab with count), planner → generated → save to Twoje trasy, Profil, Skąd są dane; desktop width checked for Trasy and the place sheet.
- Known: in the in-app preview the sheet's slide-in can be captured mid-frame; local python http.server on Windows sometimes resets connections (images then show the camera placeholder). Not seen as app bugs. Physical-phone test still pending.
Next: decide equal vs review-weighted platform weighting; get venue photo permissions; Google Places API through a Cloudflare Worker for live ratings (key in env, not repo); Tripadvisor Content API after checking whether blending is allowed; GetYourGuide affiliate tickets.

## Strict categories, user places, audit quick wins — 2026-11-02 (Claude Code)
Branch claude/user-places-strict-categories from main 4521586.
- Strict taxonomy: every place has exactly one category by what it is (Zabytki 10, Muzea 4, Parki i ogrody 5, Wisła i widoki 4, Ulice i okolice 4, Jedzenie 13, Noclegi 10); Side questy holds only the 30 activities. "Klasyka" is now a Must-see badge, sorted first. Tests enforce: one category, hotels only in Noclegi, restaurants only in Jedzenie.
- User places: #add-place form (name, one category, note, GPS or pasted Google Maps link/coordinates, optional photo resized to 800 px). Stored in state.userPlaces on the device only, no ratings, usable in routes and the planner, deletable. Sharing needs a backend (not built).
- Audit quick wins: service worker activates new versions immediately (skipWaiting, fresh precache, page reloads on update; not verified end-to-end because the local python server breaks SW script fetches); outside-only stops say so and offer GetYourGuide tickets (buy_ticket_click logged again); hotels compare via Google Hotels and Booking instead of a fake website; whole route as one Google Maps link (route detail, My Route, live); "Edytuj jako Moją trasę" replaces the basket; own routes deletable; residents don't see hotels and get a different Trasy promise; "Najbliżej mnie" sort with distances; demo friends/meetups/chat removed (old stored data untouched).
- 17 tests pass. Browser-checked at 375×812: category counts, add-place via pasted link, user place in Jedzenie and in the basket, hotel compare links, route detail actions, resident mode.
Next: OpenStreetMap import for breadth, Google Places via Worker for live ratings, opening hours, map view, English.

## Zarezerwuj tab, planner v2, profile photo, live extras — 2026-11-02 (Claude Code)
Branch claude/book-tab-planner-v2 from main 98494e0.
- Navigation: Trasy · Miejsca · Zaplanuj · Moja trasa · Zarezerwuj. Profil moved to the avatar in the header (photo or initial).
- Zarezerwuj: Noclegi (10 hotels, Google Hotels / Booking / official site), Bilety i wycieczki (museums and outside-only landmarks: GetYourGuide and an official-ticket search), Stoliki (restaurants: official site, Google Maps). Links only, no prices or commission yet. Residents open on Bilety.
- Miejsca now only exploring: 40 places, no hotels, no side quests. Category fixes: Parki i ogrody → Zieleń (parks, gardens, open space), Syrenka → Zabytki, Multimedialny Park Fontann → Zieleń. Wisła i widoki now has only 2 places (boulevards, bridge) — it needs real viewpoints added.
- Side quests appear in live mode at the matching stop. The 30 texts are still three templates and need rewriting.
- Planner v2 (core.js generate): optional start from current location (walk counted), smoothed rating (prior 4.3, weight 200 reviews) in scoring and in "Najlepiej oceniane", guaranteed food stop in the middle third when requested; food halls and Freya count as quick food. Food/coffee and start choice are on the main form.
- Audio prototype: "Posłuchaj o tym miejscu" uses the phone's built-in speech (pl-PL); ElevenLabs later.
- Profile photo (resized to 256 px, stored on the device). Stay type is saved on the device and stated as such.
- 20 tests pass. Browser-checked at 375×812: nav labels, Zarezerwuj three lists, Miejsca 40 places and categories, planner with coffee stop → live with side quest and listen button, profile via header.

## Odkrywaj and events — 2026-11-02 (Claude Code)
Branch claude/events-ticketmaster from main 6ff50c1.
- Tab Miejsca renamed Odkrywaj (compass icon) with a Miejsca | Wydarzenia switch; #events deep link.
- Wydarzenia → Globalne: fetched from /api/events (worker.js + events.js), Ticketmaster Discovery API for Warsaw, dedupe by name/date/venue, 1-hour edge cache, filters Dziś / Weekend / 7 dni / 30 dni and Koncerty / Teatr / Sport / Kino / Inne, search, "Kup bilet" logged as event_ticket_click. States: loading, no-key, source error, offline.
- Wydarzenia → Społecznościowe: explains verified-organiser rules; no sample events.
- wrangler.jsonc now has "main": "worker.js" and an ASSETS binding. `wrangler deploy --dry-run` (wrangler 4.156.1) bundled the worker and read 113 asset files. Not deployed yet.
- Owner action needed: add Secret TICKETMASTER_API_KEY in Cloudflare; optional TICKETMASTER_AFFILIATE after Impact approval; apply to Going. (Tradedoubler) and AleBilet.
- 21 tests pass (new: Ticketmaster query window, normalization, dedupe, affiliate wrapping). Browser-checked at 375×812 with a local-only fixture in dist/api/events: cards, filters, community view, switch, nav labels.

## Private or public user places — 2026-11-02 (Claude Code)
Branch claude/place-visibility from main.
- Add-place form has "Kto to zobaczy?": Tylko ja (default) / Wszyscy. Stored as visibility on the user place; the place sheet shows it and can switch it; list rows say "prywatne" or "publiczne"; place_add and place_visibility events record it.
- Public is an intent until accounts and a shared database exist (and moderation): the app says so and nothing leaves the device.
- 21 tests pass. Browser-checked at 375×812: default private, save as public, sheet text, switch back to private, row label.

## O City Route page — 2026-11-02 (Claude Code)
Branch claude/about-page. #about page: one-line purpose, 4 steps (wybierz, ruszaj, odhaczaj, oceń), what each tab does, principles (real sourced data, booking at the seller with possible future commission that never changes prices or rating order, data stays on the device, early Warsaw-only version, 1001 CAVE). Reached from Profil menu and "Jak to działa?" in the Trasy intro. Checked at 375×812. 21 tests pass.



## Planner-first navigation — 2026-11-02 (ChatGPT)
Branch work/planner-first-navigation from main 5d69909. Continued the current Claude implementation, not the stale Work checkout. First tab and default entry now Ułóż trasę (#plan), full page/accessibility label Zaplanuj moją trasę. Ready-made routes stay Trasy; place/event catalogue labelled Miejsca. Zarezerwuj and header profile retained. Moja trasa keeps its stable name with blue Gotowa before starting and red W toku during an active session; completed sessions no longer show W toku. Blank-entry while active resumes My Route. Side questy restored as a separate Miejsca category and legacy #sidequests deep link, without mixing activities into venue categories.
Validation: 21 Node tests and build pass. Browser verified default planner → generated route → editable basket (Gotowa) → start (W toku) → refresh/resume → done/skip/complete; verified 30 sidequests in Miejsca. Existing live state mechanism reused. Cloudflare auto-builds main; verify deployed v14. The malformed location text shown in the owner's screenshot is not a valid coordinates-bearing Maps URL; parsing/resolving short links remains a separate task. No changes to ratings, photos, worker/events or profile storage.
Next: physical-phone navigation QA; improve location input guidance/resolution; curate sidequest copy. Earlier historical status sections remain below/above as history, not current blockers.


## Manual routes and location repair — 2026-11-02 (ChatGPT)
Branch work/manual-route-location, based on d65305d, ready for main after checks.
Implemented: manual planner entry; touch/mouse pointer drag handles with existing accessible arrow reorder; sequential add link; persisted order. Coordinates accept decimal points, whitespace, Polish decimal commas separated by semicolon; malformed escapes no longer crash; Google destination coordinates beat viewport coordinates. Worker /api/location resolves HTTPS Google Maps short redirects only through a strict host/path allowlist with timeout and bounded redirects, never arbitrary fetch. Links with no coordinate-bearing redirect still require coordinates/GPS. Form retains failed input.
Official ticket pages added for seven attractions, official-first UI with external offers collapsed. Outside stops clearly distinguished from ticketed interiors. Event official URL shown only when available (Ticketmaster adapter does not supply organiser URLs yet); no Google search presented as official. New user places record two unverified flags (no claim of actual verification).
Validation: 24 Node tests pass; build and syntax pass. Browser verified adding 52,2395; 21,0458 produces exact Google Maps destination; further drag/mobile QA needed.
Not implemented: real accounts, shared DB, groups/chats, automatic Maps photo/name import, broad new catalogue. No Cloudflare management/auth connector or D1 binding available in this session; current wrangler only ASSETS. Existing profiles and places are device-local. Do not describe nickname/profile as a real account.
Next: provision shared database and authentication before social features; add server-side account/session tests and migrate only with user consent. Curate more Warsaw venues using official/listing sources with photo provenance and no invented ratings. Add official event URLs and verified ticket-free records. Real short-link end-to-end check needed (unit tests mock redirects); photos require source integration or explicit matching, never guess by proximity.
