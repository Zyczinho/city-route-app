# City Route — Visual System v1 (2026-11-05)

**Status:** approved direction to evaluate in UI PRs; this file is design governance, not a claim that the entire app was redesigned.
**Brand:** white / bright blue, warm neutral backgrounds, photographic discovery, readable typography, modern iOS-like controls, real community activity. No borrowed competitor identity, no giant CTA tiles everywhere. Vanilla HTML/CSS/JS as in AGENTS.md.

## Creative direction

- **Primary:** editorial city discovery — large *real* location photos, sharp place titles, small source labels, prominent direct save/route actions. Less dashboard, more "go out and discover".
- **Secondary:** trustworthy social atlas — public routes, creator/avatar, follower counts, friend invitations, meetup events. Following is one-way; friends are bilateral and accepted.
- References supplied by founder 05.11: Tripadvisor's experience-heavy photo grids (content hierarchy only), Nomadtable's real-world community actions (activity cards only), Polarsteps' trip storytelling (cover photography only). **Do not copy** their brand/colors/layout verbatim.
- Visual priority: exact matched place images > honest placeholders > generic illustrations. Never fabricate a place photo.

## Tokens and components

| Token | Default direction | Constraint |
|---|---|---|
| Brand | Existing City Route blue and white | Reuse current CSS variables instead of introducing unrelated palettes |
| Surfaces | White cards on subtly warm/light neutral background | Minimal shadows and borders, no heavy dashboard nesting |
| Typography | Existing type family; large titles, 14–16px readable body | Text inputs >= 16px on iOS; no tiny faint gray functional copy |
| Grid | 8px rhythm, predictable 12–16px gaps, responsive intrinsic widths | No clipped city labels, time inputs, card ratings or buttons at 320–390px |
| Radius | 12–16px inner cards; 16–20px outer surfaces | Nested corners follow hierarchy |
| Icons | **Lucide outline SVG** (existing local assets version 0.454.0) | 24x24 viewBox, 2px rounded stroke, currentColor, 20–24px in controls |
| Touch | >=44px tap targets, action feedback, visible focus | All icon-only actions have an aria-label |
| Motion | 140–200ms opacity/transform only for functional state transitions | Honor prefers-reduced-motion and avoid transition:all |

### Icon roles — a *single* semantic language

Use existing SVG assets in `assets/icons/ui`, loaded via `ic(name)` or the `.i` CSS class; do not switch packs within one screen. Verify a file exists before referencing it. Build should fail when a used icon is missing.

| User intention | Canonical icon | Text/state |
|---|---|---|
| Find places | `compass.svg` or `map-pin.svg` consistently per context | `Miejsca` |
| Routes | `route.svg` | `Trasy` |
| My route / navigate | `navigation.svg` | `Moja trasa` |
| Follow creators / social area | `users.svg` | `Społeczność` |
| Saved place | `bookmark.svg` | `Zapisz` → `Zapisane` |
| Add a stop | `plus.svg` | `Dodaj do trasy` |
| Stop already in route | `check.svg` | `W Mojej trasie`, toggle removes |
| Remove a stop in detail | `minus.svg` | `Usuń z Mojej trasy` |
| Expand / detail | `chevron-right.svg` | Never use a raw `›` when an asset exists |
| Photos | `camera.svg`, `image-plus.svg` | `Zdjęcie`, `Dodaj zdjęcie` |
| Rating | `star.svg` | Value and opinion count; stars are not arbitrary decoration |
| Like | `heart.svg` | Distinct from bookmark; count only if persisted |
| Search | `search.svg` | Search input / action |
| Bookings | `ticket-percent.svg` | `Zarezerwuj` |
| Edit | `pencil.svg` | `Edytuj` |
| Advanced filters | `sliders-horizontal.svg` | `Więcej ustawień` |

Retain the icon names already in working navigation (no invisible icon substitutions). Source: [Lucide](https://lucide.dev/icons/) — ISC license for official icon distribution; keep existing asset license headers. If a new icon is genuinely required, add ONE Lucide SVG with license header, then test that the asset is shipped in dist and service-worker cache.

Do not use: emoji as UI navigation, Unicode `+` or `›` in place of existing icons, random line thickness, icons that convey rating without supporting real numbers, or different icons for the same action between pages.

## Required screen architecture

**Profile**
1. Avatar, readable nickname, bio/links, edit pencil.
2. Three meaningful social counters: *Obserwujący*, *Obserwowani*, *Znajomi*; loaded from Supabase. Never confuse followers with accepted friends.
3. Presence setting: `Mieszkam tutaj / Jestem na wycieczce / Zostaję na dłużej`.
4. Local activity stats in a **collapsed** `details`; don't show 5 giant tiles by default.
5. **Więcej** collapsed: Saved routes, requests, guide, sources, export, delete, logout. No redundant "Konto aktywne" panel, no gray stale "Bez konta..." copy.
6. Account errors and real auth actions remain discoverable from expanded More; no invented sync claims.

**Places**
- Prefer an image first: real authorized exact match in a stable 4:3 or 16:10 cover; never a random city photo for the wrong business.
- Card hierarchy: image → name/type/area → legitimate provider rating and counts → Save / Add-to-route. A selected stop stays removable from the same card/detail.
- Google/Tripadvisor/City Route scores are distinct, no crowding or crossing action buttons.
- Empty photo: honest lightweight placeholder if authorized source cannot be resolved.
- Short cards by default, optional details expand within place sheet.
- Search no-results: contextual `Nie ma tego miejsca? Dodaj je`; no extra CTA if still loading or matching places exist.

**Planning**
- Fast route time chips short/intrinsic, not 20% of the page for `1 h`.
- `Oferty sponsorowane` disabled and grey unless genuine partner inventory is running; never imply a paid offer exists.
- Advanced options under disclosure; not a wall of options.

**Guide**
- All groups collapsed initially; search can reveal matching sections.
- A permanent entry remains in bottom nav; no redundant repeated onboarding overlays.

## Photo policy and acceptance

- Existing catalog photos with verified rights take priority; then official licensed provider photos; then name+geolocation matched geotagged Commons; otherwise honest no-photo state.
- Commons candidate: geotagged, hard distance gate, **matching venue identity**, sufficient resolution, attribution and allowed reuse license. Keep author + source visible. Do not blindly copy third-party source bytes to storage.
- User-owned uploaded photos with explicit consent stay a separate flow.
- Prioritize real Kraków coverage after production smoke. The old audit reported ~208 seeded Kraków places without images; this is a **coverage backlog**, not a promise that Commons automatically supplies all 208.
- For restaurants, hotels and bars: prefer source-approved venue uploads, user photos with consent, and configured official provider API. A historic landmark Commons query is not equivalent to a commercial venue photo.
- Avoid paid API keys or scraping until owner-approved. Measure fill rate and wrong-place rejects on each city.

## Browser acceptance checklist

Test on 320 / 375 / 390px, iPhone 13 Pro Safari, and desktop:
- no horizontal scroll or clipped Warszawa/Kraków; no date/time overlap
- whole 44px icon button tappable; selected/unselected route state reversible
- profile stats/social counts and collapsed disclosures stable after login/logout
- independent accepted friend counts and one-way follow counts remain correct after reload
- only one typeface and Lucide stroke family on an individual screen
- no overlap between rating source chips and Save/Add controls
- placeholder → real photo only when matched and licensed; visible attribution
- focus-visible/keyboard, reduced motion, graceful offline and no-source states
- screenshots before/after and Playwright regression attached to the PR.

## Skills and reference materials for agents

Recommended **review**: [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines). It contains practical mobile, accessibility, tap-target, typography, focus and motion guidance. Install in a local Claude Code project if wanted:

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines -a claude-code
```

Recommended **generation**: [Anthropic Frontend Design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) (official plugin). Use it to propose a constrained City Route redesign **in a reviewable PR**, not to generate a replacement app. Include this design system and existing routes/templates in the prompt.

Recommended **components**: Vercel [building-components](https://vercel.com/docs/agent-resources/skills) as accessibility/composability guidance, but avoid introducing React or a new component framework into this static vanilla JS app.

Suggested Claude task: "Read AGENTS.md and docs/CITY_ROUTE_DESIGN_SYSTEM_V1.md, audit current Profile/Places cards at 320/375/390px against Vercel Web Interface Guidelines, and propose no more than 3 concrete visual improvements as before/after screenshots. Preserve the static app, deployed routing, Supabase and existing interaction semantics. Use local Lucide SVG files only. Create one small branch/PR and report tests."

**Agent safety:** third-party skills are external code/instructions; review source before installation or execution. Installation has not been performed by merely documenting it here.
