# Incident INC-200 — Lisbon Add Place controls stopped working after auto-photo

**Date:** 2026-11-09 · **Severity:** P0, blocks creating a place · **Status:** resolved after founder confirmation · **Canonical Issue:** [#200](https://github.com/Zyczinho/city-route-app/issues/200)

## User-visible sequence

1. In Warsaw, adding a place worked.
2. In Lisbon, select **Estádio da Luz** from place autocomplete (OpenStreetMap/Photon), which automatically proposes and accepts a Wikimedia Commons photo, credited to Trickstar under CC BY-SA 3.0.
3. Trying to set a rating or click **Dodaj miejsce** did nothing. The same form without this photo condition could work.
4. The founder's report exposed the missing differentiator after multiple prior CSS and form-layout patches did not solve the issue.

The founder reported approximately three hours lost across repeated attempts. Treat that as an operational failure of the debugging workflow, not as inadequate user instructions.

## Exact root cause (confirmed)

`place-composer.js` function `syncAccepted(form)` stored the accepted Commons photo as `form.dataset.pcPhoto = JSON.stringify(record)`, adding a `data-pc-photo` attribute to the **entire form**. The delegated `document.addEventListener('click', …)` handler looked for `e.target.closest('[data-pc-photo]')`. For any descendant control—including rating radios and the submit button—`closest()` walked up to the ancestor form and returned it.

The handler then called `e.preventDefault()` and treated the event as a photo action. This canceled native radio selection and the submit action. **No CSS overlay was required.** The observed event landed on the correct radio, toggled it temporarily, invoked `preventDefault` at `place-composer.js?v=7:397`, and the selected rating reverted to `none`.

The correct action target is `button[data-pc-photo]`; the form's photo **metadata** should not be a delegated **action** selector.

## Timeline and evidence

| Step | What actually happened |
| --- | --- |
| Earlier PRs #197, #201, #202 | Pointer-target, photo editor order and navigation layout patches. Synthetic regression/CI green, but founder's Lisbon case still failed. |
| PR #203 | Corrected a **separate** verified Lisbon problem: manually entered Portuguese addresses had been geocoded as `PL`. Not the click root cause. |
| [Live test 42706810386, attempt 1](https://github.com/Zyczinho/city-route-app/actions/runs/42706810386) | Real production provider: OSM result and actual Commons auto-photo. Rating hit the correct radio, but `defaultPrevented=true`; click was canceled; test failed. |
| [PR #205](https://github.com/Zyczinho/city-route-app/pull/205) | Narrow fix: `e.target.closest('button[data-pc-photo]')`, plus Commons metadata regression. Merged `985137b6a6a03215abe2ef527bb691cf1717cd49`. |
| [CI](https://github.com/Zyczinho/city-route-app/actions/runs/42707297157) / [mobile QA](https://github.com/Zyczinho/city-route-app/actions/runs/42707297330) | Passed with a test that keeps accepted Commons record on the form and verifies actual rating/save. |
| [Production verification](https://github.com/Zyczinho/city-route-app/actions/runs/42707643021) | Passed after merge. |
| [Live test 42706810386, attempt 2](https://github.com/Zyczinho/city-route-app/actions/runs/42706810386) | **Same production scenario** passed: 5/5 radio remained checked, click/input/change were emitted without cancellation, Add Place saved the private place and photo. |
| Founder confirmation | “Dobra, działa.” This is the real user acceptance gate. |

## Why repeated attempts failed

1. **Wrong fixture:** early tests used a 1×1 PNG or mocked a Google photo. The actual failing path used OSM + accepted Commons metadata.
2. **False green:** tests proved that an isolated private place could be saved, not that the founder's real venue/photo path worked.
3. **Misleading observation:** once `elementFromPoint` showed the radio, CSS changes should have stopped. A hit target can be correct while its click gets canceled.
4. **Missing event tracing:** `defaultPrevented`, checked state after click and listener stack were captured only late in the incident.
5. **Premature release claims:** production file parity and a CI green status were mistaken for user-session acceptance.

## Controls to prevent recurrence

- Circuit breaker at two unsuccessful fixes (mandatory).
- Explicit **city/provider/photo/session** matrix for every photo-related incident.
- One Incident Debugger, one canonical Issue, one focused reproducer.
- Evidence-first: `pointerdown → click → input/change → submit`, `defaultPrevented`, handler stack.
- Failing real-provider test before fix; exactly same test passes after fix.
- Founder verifies on original session before the issue is DONE.
- Make regression coverage permanent: `tests/commons-photo-click-regression.test.js` and Commons record scenario in `tests/add-place-after-photo-smoke.mjs`.

## Separate follow-ups

- Continue P0 #176 Lisbon licensed covers without altering form event handling.
- A future review may namespace DOM metadata vs actions (`data-pc-photo-record` vs `data-pc-photo-action`) to reduce collisions, but do not change a working production flow without a scoped test and PR.
- Keep PWA offline data intact during debugging.
