# Feedback Przema + sprint City Route — 2026-11-05

Status: scoped acceptance brief. Issues are observed in tester screenshots, not verified as existing production defects after any later release.

## P0 — EXPLORER-FOLLOW-053
- Separate one-way following from mutual friendships. Public author profile and published route detail: Obserwuj/Obserwujesz, persists after reload and across devices.
- Signed-in writer only; RLS prevents forging another user's follows and self-follow. Counts reflect actual followers.
- Additive database script `scripts/staged-user-follows-20261105.sql` is STAGED, **not applied**. Hosted schema requires approval and genuine 2-account testing before activation.
- On missing table, interface indicates the feature is inactive rather than faking a locally saved follow.
- Public follow feed/discovery ranking is a separate later iteration, never mixed into friend_connections.

## P0 — PLACE-AUTO-PHOTO-032 + PHOTO-COVERAGE-039
- If a user submits a place with no upload, first match an existing authorized and attributed photo from our catalogue, permitted official source or configured provider API, by place ID/name/coordinates.
- Show best quality verified photo where source terms allow inline display, preferring correct venue identity, human-readable credit and a useful crop over decorative stock.
- Do not persist or redistribute Google/Tripadvisor image bytes against API terms or scrape Instagram/Facebook. If no authorized image is available, honest placeholder and manual source-review queue.
- Photographs should be lazy fetched and cache/rate-limited; avoid one expensive provider lookup per page view. Pilot on a few user-added Warsaw places plus missing Kraków coverage.
- Acceptance: user adds new venue without uploading a photo; on both account and public listing, an actual matching allowed photo appears with attribution OR an explicit no-photo state, never an unrelated image.

## P1 — PRZEMEK-BETA-UX-054
1. Multi-image contributions: accept up to 3–5 user-owned photos; preview reorder/delete and validate file size/type; avoid localStorage overflow and preserve consent per upload. One image is the cover.
2. Crop controls: preview 4:3, 16:9 and square framing with drag/zoom for chosen own photos; do not destructively crop original or overwrite provider content.
3. Photo-rights statement: screenshot requests default opt-in. **Do not precheck permission**; retain an explicit deliberate tick only when user uploads their image and wants it publicly shown. If no upload, this statement should not block place submission.
4. Search fallback: after no matching place / no relevant suggestions, visible context CTA `Nie ma tego miejsca? Dodaj je` prepopulates the typed name; keep the normal search when there are matches. Avoid false positives while results are still loading or unavailable.
5. Login acknowledgment: after a successful auth redirect, show unobtrusive, once-per-login `Zalogowano pomyślnie` toast, no duplicate on every navigation.
6. Visual polish: one consistent blue/white SVG line-icon set; eliminate emoji in controls; reduce oversized chip padding, place actions in predictable slots, compact mobile header; optional 140–200ms nonessential transitions with reduced-motion support.
7. Discovery clarity: existing permanent `Poradnik` and first-run onboarding remain. Observe first-time users before adding further UI overlays. Add one clear primary action per screen, secondary actions underneath.

## Measurement / Done
- No horizontal scroll and no occluded controls at 320, 375, 390px; manual iPhone 13 Pro Safari check.
- New user can discover route, place, friend/follow and create-place flow without guidance.
- End-to-end: submit place without photo -> legitimate matched photo or clear placeholder; successful login toast -> search -> no results -> submit new place -> crop multiple owned photos -> publish with explicit consent.
- Staged rollouts: follow separately from photo pipeline and layout redesign. Never mark production-live until database and build checks pass.
