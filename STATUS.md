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
