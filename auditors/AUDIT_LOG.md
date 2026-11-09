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
