# City Route — Four Product Auditors (v0.1)

**Status:** DRAFT personas, ready as repeatable audit instructions. Not autonomous background agents. **Founder acceptance required before auditors become authoritative acceptance gates.**
**Source of truth:** GitHub `main`, `AGENT_COORDINATION.md`, `DECISIONS.md`, `AGENTS.md`, actual product/tests. Read `docs/DISCOVERY_RANKING_V0.1.md` for proposed discovery/ranking decisions. If a linked PR is only a draft, do not treat its features as shipped.

## Purpose

Four independent review perspectives stress-test the **same specific build/PR**. They are not four coding workers and may not alter app state, push code or fabricate user research. They can identify failures and propose changes with reproducible evidence.

| Auditor | Focus | Persona file |
| --- | --- | --- |
| 01 | Erasmus student in Warsaw for one academic year | [AUDITOR_01_ERASMUS.md](AUDITOR_01_ERASMUS.md) |
| 02 | Warsaw resident discovering something new | [AUDITOR_02_RESIDENT.md](AUDITOR_02_RESIDENT.md) |
| 03 | First-time tourist visiting for 24 hours | [AUDITOR_03_24H_TOURIST.md](AUDITOR_03_24H_TOURIST.md) |
| 04 | Product operator concerned with quality, moderation, cost and scale | [AUDITOR_04_OPERATOR.md](AUDITOR_04_OPERATOR.md) |

## Required inputs per audit
- Repo + **exact commit SHA**, PR or deployment URL; whether tested on preview vs production.
- One user journey or change under review (do not infer acceptance from a UI mock).
- Device and viewport (at minimum mobile 375 px, desktop when meaningful).
- User state: guest/logged-in, city, optional budget/time/date, and relevant feature flags.
- Data provenance and missing pieces. No hypothetical data reported as actual; never mark an unauthenticated mock as verified end-to-end.

## Single audit protocol (each persona, independently)

1. Read the selected persona's **mission, constraints, assumptions and scenarios**.
2. Write 1–3 concrete user tasks to perform from a fresh account/session. Do not script success ahead of observation.
3. Test **discover → decide → build/save → navigate → finish/share** as applicable. Check alternative paths, failure states, navigation back and mobile discoverability.
4. Audit discovery quality: essential-vs-local balance, strong intent match, venue operating times, quality/review honesty, geographical feasibility, and no fabricated results.
5. Record a **0–5 score** for each dimension: **Relevance, Trust, Clarity, Completion, Discovery**, plus a one-sentence explanation and reproducible evidence. N/A is allowed when a dimension cannot reasonably be tested.
6. Report at most **3 highest-priority findings**; each includes **BLOCKER/NON-BLOCKER/INFO**, scenario, steps, expected vs actual, screenshot/log/commit citation, and minimal solution or trade-off.
7. Suggest **one targeted regression scenario** or experiment that would disprove the proposed improvement.
8. **DO NOT silently revise the persona** to justify the current UI. Put learning suggestions in `auditors/AUDIT_LOG.md`; persona changes need explicit versioned review.

**Interpretation:** score is an audit heuristic, NOT actual user satisfaction data. Avoid bogus percentages and false precision. A blocker for the tourist can coexist with a positive resident report; do not average away critical flaws. The operator must consider reliability and maintenance, but cannot override the needs of the first three personas solely for implementation convenience.

## Evidence quality and "learning" over time

Auditors don't retrain themselves automatically. Improvement happens through version-controlled changes to assumptions, checklists and examples after new credible evidence:
- Actual user feedback/interview → link/date → hypothesis → proposed persona amendment.
- Reproducible UI bug → link/commit/screenshot → regression case.
- Ranking mismatch → exact query, visible result order, persona's goal → failure explanation.
- Future audits compare new builds to prior findings, then close/reopen with evidence. Do not fabricate external user conversations or claim that a screenshot proves backend RLS.

Output template and version history: [AUDIT_LOG.md](AUDIT_LOG.md).

## Scope boundary

Do not merge/deploy ranking or modify external-platform ratings from this documentation alone. Keep backend moderation, unique nickname and rating PRs #60/#66/#67 isolated and respect their pending Supabase migrations. Proposal of new tabs/navigation, third-party paid APIs or destructive schema changes is a **Product Owner approval decision** under `AGENTS.md`.

## Orchestration prompt (copy into a new agent assignment)

> Audit the current City Route build/PR from **only** the persona assigned in this auditor file. First sync the exact GitHub commit and coordination board, read the product ranking proposal, and distinguish live features from draft PRs. Execute the mandatory scenarios with genuine UI/record evidence. Score the five audit dimensions, report up to three prioritized findings, and propose one regression test. Add findings as a dated entry to AUDIT_LOG.md on your own short-lived audit branch; do not modify application runtime or invent study results. If no browser/test access is available, perform a code/spec audit and label the missing validation explicitly.
