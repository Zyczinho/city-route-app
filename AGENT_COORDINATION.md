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
- `REVIEW` — implementation complete; waiting for the named reviewer.
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
| P1 | REQ-ADMIN-004 | REVIEW | Claude | ChatGPT | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE | `claude/req-admin-004` / PR #44, head `fc7d230` | ChatGPT cross-review, cycle 1/2 (YELLOW, migration 013). Synced with `main` after #42: the `scripts/build.mjs` conflict is resolved (social files + `'admin'`), 134/134, build OK. | 2026-11-03 |
| P1 | REQ-UI-003 | READY | ChatGPT | Claude | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE; SOCIAL-RUNTIME-004 DONE | no branch | All dependencies are met (#42 merged at `09dad87`). Claim it here (`IN_PROGRESS`, branch) before coding. Scope: request entry points, duplicate/+1 flow, ranked active requests, support/unsupport, `Profil -> Twoje prośby`; no new permanent bottom-nav tab. Shares only `scripts/build.mjs` with #44. | 2026-11-03 |
| P1 | SOCIAL-PROD-SMOKE-005 | READY | ChatGPT + Jakub | Claude | SOCIAL-RUNTIME-004 DONE; production deploy of `09dad87` confirmed | no branch | First confirm that Cloudflare deployed `09dad87`. Then, with two test accounts: publish a route, open it from the Społeczność feed, open the author's profile, save the route and check the signed-in `#social-saved` list, and check the mobile nav. | 2026-11-03 |
| P2 | MIGRATION-013-HOSTED | BLOCKED | Jakub | — | REQ-ADMIN-004 merged | PR #44 | After merge, apply `013_app_admins.sql` from merged `main`, then add the admin row with the SQL in `REQUESTS_ADMIN.md`. Not applied: at the reset, `is_app_admin` doesn't exist on hosted (PGRST202). | 2026-11-03 |
| P3 | INFRA-CF-PREVIEW-001 | BACKLOG | Jakub | — | Cloudflare dashboard access | — | The "Workers Builds: city-route-app" check fails on every PR branch, while builds of `main` succeed (e.g. `0d23fb9`). Classified as a deployment-configuration problem (non-production branch builds), not an app regression: GitHub `test` passes and the local build is OK. The build log is behind the Cloudflare login and hasn't been read. Until fixed, treat GitHub `test` as the required CI. | 2026-11-03 |

## Current package facts

### REQ-ADMIN-004 — PR #44

- Scope: `supabase/migrations/013_app_admins.sql`, `admin/` (unlinked, noindex, no `app.js`), `scripts/build.mjs` (+`'admin'`), `REQUESTS_ADMIN.md`, tests and the PGlite harness. It doesn't touch the main runtime.
- Tests 128/128 and build OK. Trial merge with current `main` is clean. PGlite 011 -> 012 -> 013 (applied twice) passes.
- Process note: this was implemented before the canonical board existed. Under the new board, its dependencies (012 merged and applied) are now met, so `REVIEW` is the correct state. No hosted change was made.

## Dependency rules for the current request track

1. #42 is merged, so REQ-UI-003 is unblocked. REQ-UI-003 and REQ-ADMIN-004 can run in parallel: they share only `scripts/build.mjs`, and whichever PR merges second resolves that line.
2. Live admin use needs MIGRATION-013-HOSTED. Live request UI needs only 012, which is DONE.

## Database / hosted state

| Migration | Code on `main` | Applied to hosted Supabase | Evidence |
|---|---|---|---|
| 007–010 | yes | yes | earlier board records |
| 011 | yes | yes, 2026-11-03 | earlier board record; social RPCs answer on hosted |
| 012 | yes (PR #43) | **yes, 2026-11-03** | Jakub confirmed in chat. At the reset, a read-only anon call to `catalogue_requests_ranked('warsaw')` returned 0 rows without error, while a control call to a missing function returned PGRST202. |
| 013 | no (PR #44, in review) | **no** | at the reset, `is_app_admin` returns PGRST202 on hosted |

## Recently completed

- `SOCIAL-RUNTIME-004 + NAV-MYROUTE-001` — DONE — PR #42 merged 2026-11-03 (`09dad87`). The production smoke is SOCIAL-PROD-SMOKE-005.
- `COORDINATION-RESET` — DONE — PR #45 (baseline at `0d23fb9`).
- `REQ-DATA-002` — DONE — PR #43 merged 2026-11-03; MIGRATION-012-HOSTED DONE.
- `REQ-SPEC-001` — DONE — PR #41.
- `SOCIAL-DATA-003` — DONE — PR #40; migration 011 applied.
- `SOCIAL-SPEC-001` — DONE — PR #39.
- `MAP-PROD-SMOKE-006` — DONE — manual production smoke after #36/#37/#38. Any later mention of "MAP-PROD-SMOKE after #42" is stale: that check is now SOCIAL-PROD-SMOKE-005.
- Route Builder / map / covers packages through PR #38 — DONE.

Historical, no action:

- Closed PRs #29 (temporary hosted Nearby smoke, never meant to merge) and #33 (superseded coordination notes).
- About 45 remote branches belong to merged or closed PRs. None has commits after its PR's head, and none lacks a PR. Leave them as history; deleting them is not part of any task.

## End-of-task update requirement

Before an agent reports completion to Jakub, it must update this board if the task state changed. The final message should be a human summary of the GitHub state, not the only place where state exists.

At minimum update:

- `status`
- `owner`
- `reviewer` when applicable
- `branch / PR`
- `next_action`
- `last_update`
- dependency changes

If a task became unnecessary, mark `SUPERSEDED` with the reason instead of silently abandoning it.
