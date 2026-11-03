# Agent Coordination — canonical control plane

This file is the **single source of truth for agent coordination** in City Route App.

Chat messages, old prompts and session memory are advisory only. Before implementation or review work, ChatGPT and Claude must reconcile them with current `main`, this board, open PRs, reviews and CI. Mechanical GitHub state wins over stale chat/board facts; current product/spec decisions still govern scope.

The purpose of this file is to let agents coordinate directly through GitHub so Jakub does not have to act as a message router between them.

## COORDINATION BASELINE — 2026-11-03, `main` @ `0d23fb9`

A full synchronization audit established the baseline at `0d23fb9`: `npm test` 122/122, `npm run build` OK, and PGlite harnesses for 011/012 passed.

**No earlier chat message, prompt or agent memory can reactivate a task by itself.**

## Mandatory sync before any work

Before starting, resuming or reviewing a task, every agent must:

1. Sync/read current `main`.
2. Read this file from `main`.
3. Check open PRs, current heads, latest reviews and CI.
4. Check dependencies and owned files/scope.
5. Reconcile stale board facts with GitHub.
6. Only then continue, review, start, block, supersede or close work.

## Status vocabulary

Use only: `BACKLOG`, `READY`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `CHANGES_REQUESTED`, `MERGE_READY`, `DONE`, `SUPERSEDED`, `ESCALATE`.

- `READY` means dependencies are satisfied and the task may be claimed.
- `IN_PROGRESS` has one implementation owner.
- `REVIEW` waits for the named reviewer.
- `CHANGES_REQUESTED` returns ownership to the implementation owner.
- `MERGE_READY` means required review is clean and required CI is green.
- Code/migration merge state and hosted deployment/migration state are always separate.

## Task selection order

1. `CHANGES_REQUESTED` owned by the agent.
2. `REVIEW` where the agent is reviewer.
3. Existing `IN_PROGRESS` owned by the agent.
4. Highest-priority `READY` assigned/unowned.
5. Then `BACKLOG`.

Never start `BLOCKED`, `DONE` or `SUPERSEDED` work.

## Claiming and ownership

- One implementation task has one implementation owner at a time.
- A separate reviewer may be named.
- Before writing code for a `READY` task, move it to `IN_PROGRESS`, name owner/branch and update `last_update`.
- Do not edit files owned by another active package unless explicitly coordinated.
- Parallel work is allowed only when dependencies and scopes are genuinely non-conflicting.
- If scopes begin overlapping, block/supersede the later package before more code is written.

## Handoff and stale-work rule

An `IN_PROGRESS` task must leave a recoverable GitHub checkpoint: branch, commit or PR plus a clear `next_action`.

A second agent may take over only after checking branch/PR activity and updating the board with the takeover reason. An ended chat session alone is not abandonment.

Checkpoint format:

`CHECKPOINT — <ID> — owner — branch/PR — completed: ... — next: ... — blocker: ... — last_update: YYYY-MM-DD HH:MM UTC`

## Review protocol

- Maximum two full cross-review cycles per package unless materially new code changes the scope.
- Targeted retests after narrow fixes do not require a new full review round.
- Reviewer blockers move the package to `CHANGES_REQUESTED` with exact owner/next action.
- Clean required review + green required CI => `MERGE_READY`.
- After another PR lands on `main`, open PRs re-check mergeability/CI and sync when required.

## User decision boundary

Agents make ordinary implementation decisions autonomously. Use `ESCALATE` only for a real product choice, materially different architecture, destructive/irreversible action, credentials/secrets, production DNS, or hosted database migration/deployment requiring explicit approval.

Template:

`[ESCALATE] <ID> — decision needed — Option A / Option B — recommendation — why Jakub must decide`

## Active board

| Priority | ID | Status | Owner | Reviewer | Depends on | Branch / PR | Next action | Last update |
|---|---|---|---|---|---|---|---|---|
| P1 | REQ-ADMIN-004 | DONE | Claude | ChatGPT | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE | PR #44 + fix PR #48, merged at `d9eb8e8` | No code action. Hosted migration tracked separately. | 2026-11-03 |
| P1 | REQ-UI-003 | REVIEW | ChatGPT | Claude | REQ-DATA-002 DONE; MIGRATION-012-HOSTED DONE; SOCIAL-RUNTIME-004 DONE | `chatgpt/req-ui-003` / PR #47, head `e5a7bf9` | Targeted Claude re-review of resolved-place one-shot/city-scoped fix and post-#48 sync. CI #132 green. | 2026-11-03 |
| P1 | PLAN-UI-MOBILE-006 | REVIEW | ChatGPT | Claude | current planner runtime on `main`; scope separate from REQ-UI-003 request files | `chatgpt/plan-ui-mobile-006` / PR #49, head `36beeec` | Claude UX/code review focused on 375 px hierarchy, value preservation, idempotence and Add Place regression. CI #134 green. Before merge, re-sync if #47 lands and ensure the PWA cache/version delivers the updated `enhancements.js` to existing clients. | 2026-11-03 |
| P1 | SOCIAL-PROD-SMOKE-005 | READY | ChatGPT + Jakub | Claude | SOCIAL-RUNTIME-004 DONE; production deploy of `09dad87` confirmed | no branch | Two-account production smoke: publish → feed → author → save → saved list → mobile nav. | 2026-11-03 |
| P2 | MIGRATION-013-HOSTED | READY | Jakub | — | REQ-ADMIN-004 DONE | merged PR #48 | Apply current `main` `013_app_admins.sql`, then add founder admin row from `REQUESTS_ADMIN.md`. Hosted 013 is not applied yet. | 2026-11-03 |
| P3 | INFRA-CF-PREVIEW-001 | BACKLOG | Jakub | — | Cloudflare dashboard access | — | PR preview builds fail while `main` builds succeed. Treat GitHub test CI as required until preview configuration is fixed. | 2026-11-03 |

## Current package facts

### REQ-ADMIN-004 — DONE

- #44 entered `main` at `47d48a5` before the cycle-1 blocker was fixed.
- Follow-up PR #48 fixed `added` without a linked catalogue place and merged at `d9eb8e8`.
- Server, admin client/form, unit tests and PGlite regression now enforce `place-required` for missing/blank place IDs.
- Migration 013 code is safe on `main`; hosted application is a separate `MIGRATION-013-HOSTED` action.

### REQ-UI-003 — PR #47

- Claude cycle 1 found one blocker in `maybeOpenResolvedPlace()`: a missing resolved place could repeatedly clear Places search/category.
- ChatGPT fixed it so the handoff is one-shot and city-scoped, with a user-facing unavailable toast; branch synced after #48 and preserves both request runtime files and `admin/` build entry.
- Current head `e5a7bf9`; CI #132 green; targeted Claude re-review pending.

### PLAN-UI-MOBILE-006 — PR #49

- User problem: the planner feels more complicated than its actual feature count on a phone because too many equal-weight fieldsets/text blocks are visible at once.
- Product direction: **simple by default, powerful when expanded**.
- Primary decisions are now time + interests; mobile choices stay compact in one horizontal row.
- Transport, food, start, budget, sightseeing style and partner offers are preserved inside a native `details` disclosure with a live compact summary of selected advanced values.
- Manual route building remains available but is visually secondary and moved below the generated-route flow.
- Core planner field names/defaults and `generate()` semantics remain unchanged; implementation is an idempotent enhancement in `enhancements.js` and adds focused regression coverage.
- Current head `36beeec`; CI #134 green; PR #49 mergeable. Claude review pending.
- Merge sequencing note: because `enhancements.js` is PWA-cached, after #47 lands the final #49 sync should preserve/inherit the newer cache version or explicitly cache-bust the enhancement before merge so existing installations receive the UI change immediately.

## Database / hosted state

| Migration | Code on `main` | Applied to hosted Supabase | Evidence |
|---|---|---|---|
| 007–010 | yes | yes | earlier board records |
| 011 | yes | yes, 2026-11-03 | social RPCs answered on hosted |
| 012 | yes (PR #43) | yes, 2026-11-03 | hosted read-only request RPC check succeeded |
| 013 | **yes, fixed via PR #48** | **no** | hosted action is READY and separate from code merge |

## Recently completed

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

Before reporting completion to Jakub, update this board if task state changed. At minimum update status, owner, reviewer when applicable, branch/PR, next action, last update and dependency changes. If work is no longer needed, mark `SUPERSEDED` with the reason.
