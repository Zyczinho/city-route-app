# Agent Coordination — canonical control plane

This file is the **single source of truth for agent coordination** in City Route App.

Chat messages, old prompts and session memory are advisory only. Before doing implementation or review work, ChatGPT and Claude must reconcile them with the current `main`, this board, open PRs, reviews and CI. If an old instruction conflicts with the current board or a merged dependency, the current repository state wins.

The purpose of this file is to let agents coordinate directly through GitHub so Jakub does not have to act as a message router between them.

## COORDINATION BASELINE — 2026-11-03, `main` @ `0d23fb9`

A full synchronization audit (Claude, 2026-11-03) reconciled this board with GitHub. At `0d23fb9`:

- `npm test` passed 122/122.
- `npm run build` was OK.
- The PGlite harnesses for 011 and 012 passed.

**From this baseline on, no earlier chat message, prompt or agent memory can reactivate a task by itself.** Before any work, every agent reconciles with this board, current `main`, and the open PRs, reviews and CI on GitHub. Older instructions are historical context only.

## Mandatory sync before any work

Before starting, resuming or reviewing a task, every agent must:

1. Sync/read current `main`.
2. Read this file from `main`.
3. Check open PRs, their current heads, latest review comments and CI state.
4. Check the task's dependencies and owned files/scope.
5. Reconcile stale board facts with GitHub. Mechanical GitHub facts (merged/open/head/CI) override stale text here; product decisions/spec requirements in the current board/specs override old chat prompts.
6. Only then decide whether to continue, review, start, block, supersede or close work.

**No agent may start coding solely because an earlier chat message said to do so.** The task must still be actionable according to this board.

## Status vocabulary

Use only these task statuses:

- `BACKLOG` — known work, not yet actionable or prioritized.
- `READY` — dependencies satisfied; may be claimed.
- `IN_PROGRESS` — one agent owns active implementation.
- `BLOCKED` — cannot proceed until the listed dependency/decision is resolved.
- `REVIEW` — implementation complete; waiting for the named reviewer or required verification gate.
- `CHANGES_REQUESTED` — review found blockers; ownership returns to the implementation owner.
- `MERGE_READY` — required review is clean and CI is green; waiting only for merge/approved release action.
- `DONE` — merged/completed and no further action remains.
- `SUPERSEDED` — no longer needed because another change/decision replaced it.
- `ESCALATE` — genuine product/architecture decision required from Jakub.

## Task selection order

When an agent is asked to continue or take the next task, use this priority order:

1. `CHANGES_REQUESTED` tasks owned by that agent.
2. `REVIEW` tasks where that agent is the reviewer.
3. Existing `IN_PROGRESS` tasks owned by that agent.
4. Highest-priority `READY` task assigned to that agent or currently unowned.
5. Only then consider `BACKLOG`.

Never start a `BLOCKED`, `DONE` or `SUPERSEDED` task.

## Claiming and ownership

- One implementation task has one implementation owner at a time.
- A separate reviewer may be named.
- Before writing code for a `READY` task, update this board to `IN_PROGRESS` with owner, branch and `last_update`.
- Do not edit files owned by another active package unless the board explicitly allows shared ownership.
- Two tasks may run in parallel only when dependencies allow it **and** their implementation scopes do not conflict.
- If two tasks become overlapping after new information, the later/lower-priority task becomes `BLOCKED` or `SUPERSEDED` before more code is written.

## Handoff and stale-work rule

An `IN_PROGRESS` task must leave a recoverable GitHub checkpoint: branch, commit or PR plus a clear `next_action`.

A second agent may take over only after checking the branch/PR activity and updating the board with the takeover reason. Do not infer abandonment from an ended chat session alone.

Checkpoint format when a session/credit limit may interrupt work:

`CHECKPOINT — <ID> — owner — branch/PR — completed: ... — next: ... — blocker: ... — last_update: YYYY-MM-DD HH:MM UTC`

## Review protocol

- Maximum two full cross-review cycles per package unless new code materially changes the reviewed scope.
- A targeted retest after a mechanical fix does not require a new full review cycle unless it exposes a new material issue.
- Reviewer findings move the task to `CHANGES_REQUESTED` and name the exact owner/next action.
- A clean required review plus green CI moves the task to `MERGE_READY`.
- After another PR merges into `main`, any still-open PR must re-check mergeability/CI and sync if necessary before merge.

## User decision boundary

Agents should make ordinary implementation decisions autonomously. Use `ESCALATE` only for a real product choice, materially different architecture, destructive/irreversible action, credentials/secrets, production DNS, or hosted database migration/deployment that requires explicit approval.

Template:

`[ESCALATE] <ID> — decision needed — Option A / Option B — recommendation — why Jakub must decide`

## Active board

Code status and hosted-database status are tracked as **separate rows**: "migration merged" never means "migration applied".

| Priority | ID | Status | Owner | Reviewer | Depends on | Branch / PR | Next action | Last update |
|---|---|---|---|---|---|---|---|---|
| P0 | NAV-HOTFIX-008 | IN_PROGRESS | ChatGPT | Jakub (production smoke) | UX-CLEANUP-007 PR #50 merged | `chatgpt/hotfix-nav-observer-008` | Fix non-idempotent MutationObserver reordering navigation; prevent starvation of async app initialization. Add runtime regression test, CI; production verification required. No Supabase changes. | 2026-11-03 |
| P1 | UX-CLEANUP-007 | REVIEW | ChatGPT | Jakub (visual) | PLAN-UI-MOBILE-006 DONE; SOCIAL-RUNTIME-004 DONE | PR #50 merged to `main` at `da82633` | Code merged 2026-11-03 16:30 UTC; founder to verify actual production deploy and visual UX on desktop/mobile. Mark DONE after that acceptance. | 2026-11-03 |
| P1 | REQ-ADMIN-004 | DONE | Claude | ChatGPT | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE | PR #44 + fix PR #48, merged to `main` at `d9eb8e8` | No code action. Hosted migration is tracked separately below. | 2026-11-03 |
| P1 | REQ-UI-003 | DONE | ChatGPT | Claude | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE; SOCIAL-RUNTIME-004 DONE | PR #47 merged to `main` at `58694df` | Claude targeted re-review was CLEAN; no further code action. | 2026-11-03 |
| P1 | PLAN-UI-MOBILE-006 | DONE | ChatGPT | Claude | REQ-UI-003 DONE | PR #49 merged to `main` at `c9d2681` | No code action. Claude review CLEAN; post-sync cache hardening and GitHub CI #143 were green before merge. | 2026-11-03 |
| P1 | SOCIAL-PROD-SMOKE-005 | READY | ChatGPT + Jakub | Claude | SOCIAL-RUNTIME-004 DONE; production deploy of `09dad87` confirmed | no branch | Two-account production smoke: publish → feed → author → save → saved list → mobile nav. | 2026-11-03 |
| P2 | MIGRATION-013-HOSTED | DONE | Jakub | — | REQ-ADMIN-004 DONE | merged PR #48 + hosted Supabase | Migration 013 applied to hosted Supabase and founder admin allow-list entry confirmed in SQL Editor. No further migration action. | 2026-11-03 |
| P3 | INFRA-CF-PREVIEW-001 | BACKLOG | Jakub | — | Cloudflare dashboard access | — | Workers preview builds fail on PR branches while `main` builds succeed. Treat GitHub `test` as required CI until preview configuration is fixed. | 2026-11-03 |

## Current package facts

### NAV-HOTFIX-008 — production blocker

- Founder screenshot following Cloudflare Ready: initial loading screen never resolves and bottom nav only shows Społeczność.
- Root cause isolated in `nav-enhancements.js`: MutationObserver calls `enforceBottomNav`, which appends the same links unconditionally and queues itself indefinitely. `navSyncing` is reset before callbacks run, so guard is ineffective against microtask re-entry.
- Fix only that module and a focused runtime regression test; release must be visually smoke-tested on production before marking DONE. Supabase unaffected. Separate P0 catalogue branch remains independent.



### UX-CLEANUP-007 — PR #50 — merged, visual production acceptance pending

- Founder feedback from production screenshots: add a dedicated **Społeczność** tab, reduce the oversized/raised `Moja trasa` treatment and make the planner substantially calmer than PR #49 achieved visually.
- Bottom navigation now has five entries: Ułóż trasę, Trasy, Moja trasa, Społeczność, Miejsca. Społeczność reuses the existing Social Routes feed instead of duplicating backend/data logic.
- `Moja trasa` remains visually central but uses a smaller negative margin, thinner border and smaller shadow so it stays inside the navigation composition.
- Planner first view is intentionally minimal: time, collapsed `Klimat trasy`, collapsed `Więcej ustawień`, one `Ułóż trasę` CTA, then two small alternative links. Existing form names/defaults and generator semantics are preserved.
- Visible cleanup copy avoids the founder-disliked long AI-style dash punctuation.
- Delivery is explicit through `ux-cleanup.js?v=1`, `ux-cleanup.css?v=1`, `nav-enhancements.js?v=2` and service-worker cache v32.
- GitHub CI #147 passed `npm test` and `npm run build` on head `20fcf42` before this board-only commit. Next gate is founder visual acceptance, not another Claude review.

### REQ-ADMIN-004 — PR #44 + fix PR #48 — DONE

- #44 merged to `main` at `47d48a5` before its cycle-1 blocker was fixed.
- PR #48 fixed `added` without a linked place and merged at `d9eb8e8`.
- Migration 013 is safe in code and has now been applied to hosted Supabase; founder admin access was confirmed manually in the SQL Editor.

### REQ-UI-003 — PR #47 — DONE

- Claude cycle 1 found one blocker in `maybeOpenResolvedPlace()`.
- ChatGPT fixed it as one-shot and city-scoped, with no repeated Places filter reset when the place is missing.
- Claude's targeted low-credit re-review was CLEAN.
- PR #47 merged to `main` at `58694df`.

### PLAN-UI-MOBILE-006 — PR #49 — DONE

- Product direction: **simple by default, powerful when expanded**.
- Time + interests stay primary; transport, food, start, budget, sightseeing style and partner offers move behind `Dopasuj szczegóły` with a compact selected-values summary.
- No generator/backend/Supabase/request/social contract changes.
- Claude review was CLEAN for semantics, idempotence, value preservation and progressive disclosure.
- After #47 merged, #49 was synchronized with current `main`.
- Delivery hardening is explicit: `enhancements.js?v=22` and service-worker cache v31, so installed clients refresh the shell rather than depending on Cloudflare/browser revalidation behavior.
- Five legacy cache-version assertions were mechanically updated from v30 to v31. GitHub CI #142 and final board-only CI #143 were green.
- PR #49 merged at `c9d2681`.

## Database / hosted state

| Migration | Code on `main` | Applied to hosted Supabase | Evidence |
|---|---|---|---|
| 007–010 | yes | yes | earlier board records |
| 011 | yes | yes, 2026-11-03 | social RPCs answer on hosted |
| 012 | yes (PR #43) | yes, 2026-11-03 | hosted read-only request RPC check succeeded |
| 013 | **yes, fixed on `main` via PR #48** | **yes, 2026-11-03** | Jakub ran 013 in hosted Supabase and confirmed the founder row in `public.app_admins` via SQL Editor |

## Recently completed

- `MIGRATION-013-HOSTED` — DONE — migration 013 applied to hosted Supabase on 2026-11-03; founder admin row confirmed in SQL Editor.
- `PLAN-UI-MOBILE-006` — DONE — PR #49 merged at `c9d2681`; Claude review CLEAN; cache delivery hardened to v22/v31.
- `REQ-UI-003` — DONE — PR #47 merged at `58694df`; Claude targeted re-review CLEAN.
- `REQ-ADMIN-004` — DONE — PR #44 + fix PR #48; final blocker fixed and merged at `d9eb8e8`.
- `SOCIAL-RUNTIME-004 + NAV-MYROUTE-001` — DONE — PR #42 merged at `09dad87`; production smoke remains separate.
- `COORDINATION-RESET` — DONE — PR #45 baseline `0d23fb9`.
- `REQ-DATA-002` — DONE — PR #43; migration 012 hosted DONE.
- `REQ-SPEC-001` — DONE — PR #41.
- `SOCIAL-DATA-003` — DONE — PR #40; migration 011 applied.
- `SOCIAL-SPEC-001` — DONE — PR #39.
- `MAP-PROD-SMOKE-006` — DONE.
- Route Builder / map / covers packages through PR #38 — DONE.

Historical closed/superseded branches and PRs stay as history unless a current task explicitly needs cleanup.

## End-of-task update requirement

Before an agent reports completion to Jakub, it must update this board if the task state changed. At minimum update status, owner, reviewer when applicable, branch/PR, next action, last update and dependency changes. If work is no longer needed, mark `SUPERSEDED` with the reason instead of silently abandoning it.
