# Changelog

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
