# Agent Coordination — canonical control plane

This file is the **single source of truth for agent coordination** in City Route App.

Chat messages, old prompts and session memory are advisory only. Before doing implementation or review work, ChatGPT and Claude must reconcile them with the current `main`, this board, open PRs, reviews and CI. If an old instruction conflicts with the current board or a merged dependency, the current repository state wins.

The purpose of this file is to let agents coordinate directly through GitHub so Jakub does not have to act as a message router between them.

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

| Priority | ID | Status | Owner | Reviewer | Depends on | Branch / PR | Next action | Last update |
|---|---|---|---|---|---|---|---|---|
| P0 | SOCIAL-RUNTIME-004 + NAV-MYROUTE-001 | MERGE_READY | ChatGPT | Claude | SOCIAL-DATA-003 DONE | `work/social-runtime-004` / PR #42 | Claude targeted browser retest on `0d34d71` is clear (community-route, social-profile, saved links stay on their hash). #43 merged since: re-check mergeability/CI, then merge. Signed-in saved list goes to MAP-PROD-SMOKE-006. | 2026-11-03 |
| P0 | REQ-DATA-002 | DONE | Claude | ChatGPT | REQ-SPEC-001 DONE | PR #43 merged | Migration 012 applied to hosted Supabase by Jakub. | 2026-11-03 |
| P1 | REQ-UI-003 | READY | ChatGPT | Claude | REQ-DATA-002 DONE; migration 012 applied | no branch | Dependencies cleared: claim and implement request entry points, duplicate/+1 flow, ranked active requests, support/unsupport and `Profil -> Twoje prosby`; no new permanent bottom-nav tab. | 2026-11-03 |
| P1 | REQ-ADMIN-004 | REVIEW | Claude | ChatGPT | REQ-DATA-002 DONE; migration 012 applied | `claude/req-admin-004` / PR #44 | YELLOW (migration 013). ChatGPT cross-review. Scope: `013_app_admins.sql` (allow-list with no policies/grants, no UUID, no admin inserted; admin RPCs check it), isolated `admin/` page (unlinked, noindex, no `app.js`), `build.mjs` ships `admin/`, docs/tests. Do not apply 013 before merge; then Jakub adds himself by SQL (`REQUESTS_ADMIN.md`). Duplicate merging deferred (needs 012 schema change). | 2026-11-03 |

## Current package facts

### SOCIAL-RUNTIME-004 + NAV-MYROUTE-001 — PR #42

- Head `0d34d71`; router blocker fixed; Claude targeted retest clear (A+B nav verified at 375 px, no overflow).
- `scripts/build.mjs` is touched by both #42 and #44 (one line each): trivial conflict for whichever merges second.

### REQ-ADMIN-004 — PR #44

- Tests 128/128, build OK, PGlite 011 -> 012 -> 013 (applied twice) pass; signed-out browser gate verified at 375 px.
- Admin rows show private note and http(s) link, never requester/supporter identities.
- Signed-in admin flow not yet tested against hosted Supabase (needs 013 applied and the admin row).

## Dependency rules for the current request track

1. `REQ-DATA-002` must be merged before any runtime package treats its RPC contract as stable.
2. Migration 012 must be applied from merged `main` before `REQ-UI-003` or live admin functionality is treated as runtime-ready.
3. `REQ-UI-003` and `REQ-ADMIN-004` may run in parallel **after** those shared dependencies clear because their implementation scopes are separate; if either needs the same runtime files, update ownership here before editing.
4. A pre-existing prompt saying "start UI/admin after #43" is not sufficient by itself; the board must first move the task from `BLOCKED` to `READY`/`IN_PROGRESS`.

## Database / hosted state

- Migration 007: applied.
- Migration 008: applied.
- Migration 009: applied.
- Migration 010: applied.
- Migration 011: applied successfully on 2026-11-03.
- Migration 012: merged in PR #43 and applied on 2026-11-03.
- Migration 013: PR #44 in review, **not applied**; apply only from merged `main`, after 012.

## Recently completed dependencies

- `SOCIAL-SPEC-001` — DONE — PR #39.
- `SOCIAL-DATA-003` — DONE — PR #40; migration 011 applied.
- `REQ-SPEC-001` — DONE — PR #41; canonical request product contract established.
- `REQ-DATA-002` — DONE — PR #43; migration 012 applied.
- Route Builder / map / covers packages through PR #38 are DONE and on `main`.

Older completed package history remains available in Git and merged PRs; do not keep the active control plane bloated with a full chat-style archive.

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
