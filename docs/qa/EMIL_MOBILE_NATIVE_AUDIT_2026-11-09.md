# City Route — iPhone UX audit, 2026-11-09

Status: **implementation proposed in PR; hardware acceptance pending**. Source baseline: `main` as read 2026-11-09. User-approved scope: audit and improve City Route starting with iPhone.

## Method

Use the practical criteria of Emil Kowalski's MIT-licensed [mobile-native](https://github.com/emilkowalski/skills/tree/main/skills/mobile-native) and [break-ui](https://github.com/emilkowalski/skills/tree/main/skills/break-ui) skills. Treat external skill material as review guidance, not instructions overriding `AGENTS.md`. This audit reviewed source CSS, `index.html`, existing mobile tests, and GitHub coordination/open PR scopes. There was **no live iPhone/Safari session**; code findings are distinguished from device observations.

## Source-confirmed findings and fixes

| Priority | Evidence in main | Source-confirmed issue | Proposed change (this PR) |
| --- | --- | --- | --- |
| P0 | `map.css:54` | Mobile map-card close button forced to 28x28px, `min-height:28px!important` | 44x44px override in `mobile-device-polish.css` |
| P0 | `map.css:52` | Map-card action buttons forced to 32px minimum height | 44px minimum; reserve 52px title space for Close |
| P1 | `styles.css:67` | `max-height:92vh` can overrun the visible iOS Safari viewport with browser chrome | `92dvh` mobile override with `vh` fallback |
| P1 | `mobile-device-polish.css` previous narrow header rule | City selector uses 13px (12px at <=359px), which can trigger iOS focus zoom | 16px for coarse pointers; allow user zoom |
| P1 | `styles.css:55-58,253` and `mobile-device-polish.css` | Place-card action row is separately positioned on mobile, while title retains right padding originally reserved for overlaid action buttons | Remove padding in mobile place list; keep 44px Save |
| P2 | `styles.css:35,70`, `map.css:4` | Search-clear / sheet-close / map toolbar controls under 44px in some layouts | Raise touch sizes to 44px on phones |
| P2 | `styles.css:5` and mixed form styles | Some editable controls inherit <16px text, causing Safari focus zoom | Apply 16px floor on coarse pointer; exclude radio and checkbox |

Existing good practices to **preserve**: `index.html` uses `viewport-fit=cover`, `#navigation` has `env(safe-area-inset-bottom)`, map scroll mode already uses `touch-action:pan-y`, missing photos have placeholders, and `styles.css` honors `prefers-reduced-motion`. Do not add `maximum-scale=1` or disable pinch zoom.

## Break-UI adversarial QA matrix (not yet executed on hardware)

The existing `break-ui` skill calls for realistic edge-case data at the actual component's data boundary. Cases to run on a development preview (never seed public places with test content):

| Screen | Data/state | Expected result |
| --- | --- | --- |
| Places list | 80-character Portuguese restaurant name, accents, 2-line title, missing photo, no provider rating | No horizontal overflow; no overlapping save/share; title legible, fallback honest |
| Places list | Exactly 0 items; exactly 1 item; 30 items/page; page 2 | Empty/one states understandable; no accidental 31st card; navigation reachable |
| Map card | Very long place name, full toolbar, map scroll-mode active | Close button reachable at 44px; actions usable; page scrolls without trapping finger |
| Place dialog | Open after browser bars are visible; open keyboard on an input; close keyboard | Dialog stays inside visible screen; no unexpected Safari page zoom |
| Header | Narrower 320px, 375px, 390px; cities Warsaw/Lisbon; long profile nickname | Selector text doesn't clip; avatar/actions reachable |
| Route builder | 10+ stops with long names; drag and scroll; then share/archive | No stuck gestures or inaccessible controls |
| Accessibility | 200% text zoom, large text setting, VoiceOver focus, reduced motion | Content and actions stay accessible; content can still be zoomed |

**Important:** This matrix is an acceptance plan, not a claim these tests ran or passed. The `break-ui` fixture toggle still needs a real component-boundary implementation if deeper stress testing is approved. This PR intentionally avoids changing `app.js`, `index.html`, `scripts/build.mjs`, and `service-worker.js` because ongoing PRs #154/#163/#151 touch them.

## Verification gates

1. GitHub CI: `npm test` and `npm run build`. The new `tests/emil-mobile-native.test.js` guards structural CSS / viewport rules; it is **not** a substitute for layout testing.
2. Browser at 320 / 375 / 390px; inspect overflow, name, map toolbar/card, sheet; simulate photo failure and long name. Use 200% text zoom.
3. Real **iPhone 13 Pro** (Safari and installed PWA): navigate Places -> map -> selected place -> close; scroll page one finger with map in scroll mode; tap Save, Share, date/time/select controls; check keyboard and address-bar expansion. Ensure no content under Home indicator and no focus-zoom.
4. Recheck after merging pending PRs for route share/pagination and web-push. Open PR intentionally remains unmerged until review + device check; avoid extra production cache/index changes that conflict with those PRs.

## Not in this small PR

Photo-provider reliability and license fallback; Google/Tripadvisor rating ingestion; backend data correctness; 30-per-page pagination; new gestures/animations; screenshot-based visual diff automation. These are separate data/feature workstreams and should not be described as fixed by CSS.

## Rollback

One branch, one isolated stylesheet update and one test/doc package. Reverting the stylesheet hunk restores pre-existing behavior without touching the database, service worker, or routing logic.
