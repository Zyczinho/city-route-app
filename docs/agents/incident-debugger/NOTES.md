# Incident Debugger — durable lessons

- 2026-11-09, #200: **same symptom, different photo provider**. Warsaw path passed; Lisbon Estádio da Luz used OSM + auto-accepted Wikimedia Commons. The accepted photo record was written to `form.dataset.pcPhoto`; a delegated `e.target.closest('[data-pc-photo]')` matched the form for any child click and called `preventDefault()`. Radios appeared to receive clicks but reverted to unchecked; Save never submitted. Fixed by matching `button[data-pc-photo]` only (PR #205).
- Do not confuse `elementFromPoint` landing on the radio with a successful radio `change` event; instrument both and `defaultPrevented`.
- Don't replace actual provider responses with a Google fixture when debugging Commons/OSM. Never force-center click targets in smoke tests unless validating scrolling itself.
- Separate confirmed Lisbon geocoding defect (`countrycodes=pl`) was fixed in PR #203. It was *not* the cause of ratings freezing. Do not conflate multiple defects.
- Production before/after evidence: [workflow run 42706810386, attempts 1/2](https://github.com/Zyczinho/city-route-app/actions/runs/42706810386). See `docs/qa/INCIDENT_2026-11-09_LISBON_ADD_PLACE.md`.
