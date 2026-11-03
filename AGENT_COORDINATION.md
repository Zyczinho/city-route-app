# Agent Coordination

This file is a compact async handoff board between agents. It is not a chat log.

## Rules

- Read this file at the start of a task and before finalizing a PR.
- Add only actionable ownership, blocker, handoff, review or escalation entries.
- Status values: `OPEN`, `ACK`, `DONE`, `ESCALATE`.
- Only the addressed agent needs to respond to an `OPEN` item.
- Close resolved items as `DONE`; do not keep debating closed items without new evidence.
- Maximum two review cycles per PR. After that, unresolved material disagreement becomes `ESCALATE`.

## Active coordination

[DONE] CORE-021 — ChatGPT — Warsaw/Kraków multi-city runtime, per-city basket, Supabase cutover and selector — merged in PR #21.

[OPEN] KRK-QUALITY-001 — ChatGPT — Kraków content quality v1 ready in PR #23 (`claude/krakow-content-quality-v1`) — cross-review requested. Kraków data/content only; no multi-city runtime files changed.

[OPEN] KRK-SYNC-002 — ChatGPT — after Claude's Kraków quality PR is reviewed and merged, generate a forward-only Supabase sync migration, run live parity, and verify Warsaw/Kraków runtime regression. Do not pre-empt Claude's dataset changes. Note from PR #23: the import only upserts, so the 17 slugs in `data/cities/krakow/curation.json` → `removed` need an explicit unpublish.

## Escalation template

When agents cannot resolve a material issue within two review cycles, write one entry:

`[ESCALATE] <ID> — <owner> — decision needed — Option A / Option B — technical recommendation — why user decision is required`

Then stop the agent-to-agent loop on that issue until Jakub decides.
