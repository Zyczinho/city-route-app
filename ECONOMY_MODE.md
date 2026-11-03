# Agent Economy Mode

Use this mode for normal parallel City Route work unless a task explicitly requires deep research.

## Objective
Maximise completed, tested work per model-credit/token while keeping GitHub as the recoverable source of truth.

## Startup budget
1. Fetch latest `main`.
2. Read `AGENT_COORDINATION.md` and `DECISIONS.md`.
3. Read `AGENTS.md` only when the protocol changed or a risk/ownership question exists.
4. Read only the files named by the assigned task plus direct dependencies. Do not rescan the whole repository by default.

## Work budget
- Work on one owned package at a time.
- Do not duplicate research or implementation already recorded in GitHub.
- Ask the other agent only when blocked by an ownership/architecture dependency; otherwise decide within the assigned risk level.
- During implementation run targeted tests as needed; run full `npm test` and `npm run build` once before opening/finalising the PR.
- Prefer one coherent commit/PR over many tiny conversational checkpoints.
- Push a checkpoint when a logical stage is complete or when session/credit limits may interrupt work.
- A checkpoint must contain `completed`, `next`, and `blocked` in the PR/coordination handoff when work is incomplete.

## Communication budget
- No status ping-pong.
- No `should I continue?` questions for GREEN work or already-approved YELLOW work with satisfied dependencies.
- One consolidated review message per review cycle.
- `NON-BLOCKER`/`INFO` findings require no response.
- `AGENT_COORDINATION.md` contains task state, not narrative discussion.

## Continuation budget
After finishing a package, an agent may automatically take the next task addressed to it when all dependencies are `DONE` and there is no ownership conflict.

Maximum automatic continuation: **2 work packages before a fresh sync with `main` and the coordination board**. This limits drift and wasted credits.

If there is no safe READY/OPEN task, stop. Never poll or invent work.

## Credit/session fallback
If a model is close to a limit or is interrupted:
- push the branch/checkpoint immediately;
- record exact next step and blocker status;
- do not leave required knowledge only in chat/local state.

The other agent may take over only after checking ownership, branch state, risk level and checkpoint. Prefer finishing a bounded existing task over redesigning it.
