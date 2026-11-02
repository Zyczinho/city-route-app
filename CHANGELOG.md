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
