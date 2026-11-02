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
