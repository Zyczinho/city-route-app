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
