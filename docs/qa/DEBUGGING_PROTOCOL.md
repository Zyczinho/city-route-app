# City Route — P0 debugging protocol (anti-loop)

Status: **active** · Adopted 2026-11-09 · Owner: Incident Debugger (Coordinator assigns one incident owner)

**Goal:** diagnose blocked core flows in one bounded investigation whenever possible; do not promise a 15-minute resolution regardless of evidence. The incident's clock measures progress to **credible reproduction/root cause**, not number of PRs merged.

## Trigger

Apply for any core-flow freeze, regression after deploy, founder report contradicting CI, or two unsuccessful changes for the same issue. Freeze unrelated feature work in the affected area. Reuse the existing GitHub issue; do not open a series of near-duplicate PRs.

## Minimal incident record

| Field | Required observation |
| --- | --- |
| Symptom | Specific last working action → failing action; visible effect and blocked outcome |
| Context | City, route, source/provider, selected photo, device/browser/PWA, login, persisted state |
| Working control | Comparable case that works, with exactly which variables differ |
| Evidence | Repro steps, console/page errors, network responses, DOM/event trace, screenshot if useful |
| Attempt log | Each hypothesis, changed commit, test that should falsify it, outcome |
| Root cause | Specific line/selector/state transition + *why* it only fails in this context |
| Acceptance | Same real sequence before red / after green; production parity; founder real-device confirmation |

Never log access tokens, private user data, account identifiers or private photos. Avoid deleting browser/PWA storage and avoid paid provider calls except an explicitly bounded request.

## Operating sequence

1. **Freeze + baseline.** Sync `main`, open PRs and CI. Record exactly what is deployed. Keep one active issue/owner; rollback obviously unsafe patches.
2. **Reproduce the user's facts, not a cleaner synthetic path.** Include city switches, real provider, photo type, session/PWA state, and exact order of actions. Compare a working control (e.g. Warsaw) with the failing case (Lisbon). If the user already supplied a reproducible step, do not ask them to repeat it.
3. **Instrument before editing.** For click bugs capture `elementFromPoint`, `pointerdown`, `pointerup`, `click`, `input`, `change`, `defaultPrevented`, listener stack, selected radio, and form submit. For save bugs capture validation messages, API status, city geofence and state persistence. Identify the responsible line, not a plausible CSS smell.
4. **Root-cause hypothesis → falsifier.** Write down one mechanism and what output would disprove it. Mark the **old revision red** with a regression using the same venue/provider/data path. Mocked tests are allowed only for isolated comparison, not as proof of actual provider behavior.
5. **Minimal corrective patch.** No broad layout refactor, duplicate cache bump, random CSS or new unrelated functionality. Have Reviewer verify why the change addresses the captured event trace.
6. **Exactly the same test green.** Run scoped tests, `npm test`, build, required P0 browser smoke. Test different cities/providers as a regression matrix; do not let an artificial scroll or fixture conceal the bug.
7. **Release + founder acceptance.** Verify deployed exact assets, then replay the same real-provider production case in a disposable session. Explicitly distinguish that from testing the founder's own browser. Close issue **only after** the founder confirms the originally failing flow.

## Circuit breaker

After **two fixes without founder acceptance**, further speculative merging/patching **stops**. Change method: inspect the actual provider and user state, record failing event traces, ask an independent Reviewer to check the proposed mechanism. No third code change until new evidence demonstrates root cause.

Each diagnostic run should be bounded, focused and reusable; avoid repeatedly launching the full CI and expensive provider workflows. Draft PRs batch revisions; run browser QA when ready. If a production fix is disproven, consider reverting that specific PR before adding more layers.

## Red flags that mean the test is inadequate

- Green mocks but a real user still fails.
- A synthetic photo substitutes for an accepted Commons/Google record with different attributes.
- Browser tests succeed only after `scrollIntoView({block:'center'})`.
- A click hits the correct DOM element but `checked` or `change` does not persist.
- The A/B difference (city, provider, actual input) is absent from fixtures.
- Assets are served but the founder PWA is still on stale code.

## #200 worked example

Accepted Commons photo wrote `data-pc-photo` onto the **form** as metadata, whereas a delegated photo-action click handler used `closest('[data-pc-photo]')`. That matched the ancestor form, treated radio/save clicks as photo actions and called `preventDefault()`.

The decisive production log contained the canceling stack at `place-composer.js?v=7:397`; PR #205 changed the selector to `button[data-pc-photo]`. The identical real Estádio da Luz production test failed before and passed after release. See [postmortem](INCIDENT_2026-11-09_LISBON_ADD_PLACE.md).

## Completion report template

**Observed:** …  **Working control:** …  **Root cause:** …  **Red evidence:** …  **Patch:** …  **Same-test green:** …  **Production status:** …  **Real-device acceptance:** PENDING / CONFIRMED.  
If acceptance is pending, leave the Issue OPEN and do not say “naprawione u Ciebie”.
