# Auditor evidence & versioned learning log

This file is intentionally a **template, not a record of completed tests**. No user interviews or real device tests have been performed merely by creating these persona files.

## One record per persona × build × task

### AUDIT-YYYYMMDD-XXX — Auditor ## — Scenario
- **Status:** OPEN / CONFIRMED / DISPROVED / FIXED / RECHECKED
- **Auditor/persona version:** `AUDITOR_0X_...md@v0.1`
- **Repository SHA / PR:** [exact reference]
- **Environment:** production/preview/local; signed-in/guest; desktop/mobile; viewport; city; date/time
- **User intent:** [literal search/task and constraints]
- **Input catalog / sources:** [fixture version, actual venue IDs, rating and opening-hour provenance]
- **Journey & reproduction:** 1. ... 2. ... 3. ...
- **Evidence:** [screenshots, console logs, test output, links; none if unobserved]
- **Expected / actual:** [observable, falsifiable]
- **Scores (0–5 or N/A):** Relevance: _; Trust: _; Clarity: _; Completion: _; Discovery: _
- **Finding 1:** BLOCKER / NON-BLOCKER / INFO — [what, why, concrete fix]
- **Finding 2:** [optional]
- **Finding 3:** [optional]
- **Competing persona/trade-off:** [e.g., resident discovery vs 24h essential coverage]
- **Regression/experiment:** [scenario, acceptance criterion, baseline]
- **Proposed new learning:** [what evidence suggests a stable persona/rubric amendment]
- **Decision owner:** [owner, reviewer]; **PR:** [link]; **Outcome:** [link/evidence]
- **Updated:** YYYY-MM-DD

## Controlled improvement rule

A proposal to update an auditor persona must contain:
1. Real new evidence with a link and observation date (a hypothesis is not evidence).
2. Specific file and wording change, plus reason.
3. Demonstration that the change improves user coverage **without merely excusing an existing bug**.
4. Version bump and changelog entry (v0.1 → v0.2 etc.), reviewed by Product Owner for meaningful product assumptions.
5. At least one replayable regression scenario preserved after the change.

Audit findings may be closed by a verified fix but **must not be erased**: future auditors use the log to avoid regressing into the old behavior.

## First candidate audits (NOT RUN)
- 24h tourist, neutral request: essential landmarks should appear before weekend-only markets.
- Resident, explicit vintage flea market query: matching open market must be findable even with fewer reviews.
- Erasmus, weekend budget cap: a mix of one classic and locally useful options.
- Operator, 5k places with duplicate suggestions: a single canonical public listing, unlimited private drafts and no phantom provider ratings.

Record real results only after running a specific build and capturing evidence.

## AUDIT-20261105-001 — Personas v1.0, first full audit (Auditor agent)
- **Status:** CONFIRMED (findings filed as issues)
- **Persona version:** `docs/personas/CITY_ROUTE_PERSONAS_V1.md@1.0`
- **Repository SHA:** `43b06e2` (production cache `city-route-v64-7bb2ddd871`)
- **Environment:** production, guest, fresh local state, Chromium mobile emulation 375x812, Warszawa, 2026-11-05 ~21:50. Not a real iPhone.

| Persona | Core task | Result | Issues |
|---|---|---|---|
| 1 Newcomer | Find places, save 3, find another user's route, find an event | Partial: saving 3 places works; 0 community routes in Warsaw; events only from Ticketmaster; welcome omits people/events | #103, #102, #108 |
| 2 Time-Limited Explorer | 6 h, medium budget, history + food → route on map → start | **Pass:** 3 variants in seconds, 7 stops ~5 h 10 min, ~8.2 km, food stop, Google Maps link, live mode works | #107 (minor) |
| 3 Authenticity Seeker | Find niche places, a local creator's route, save it | **Blocked:** 0 Warsaw community routes; "Bary i kluby" 0 places; place cards lack "why visit" | #103, #104, #106, #109 |
| 4 Spontaneous Social Explorer | "Dziś" → event or community walk → join | **Blocked:** "Dziś" 0 events (source has none tonight); community events honestly marked "w przygotowaniu"; placeholder text on every event card | #105, #102 |

- **Checked and fine:** all 40 Warsaw catalogue cards have a photo; no horizontal overflow on Miejsca, Ułóż trasę or Moja trasa; Add Place photo proposal and submit work (see PR #97, #100).
- **Not tested:** signed-in flows (friends, groups, chats, publishing), Kraków, real devices.
