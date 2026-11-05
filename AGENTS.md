# Agent handoff and collaboration protocol

GitHub `Zyczinho/city-route-app` is the sole source of truth. Start every task by fetching the latest `origin/main`, reading `AGENT_COORDINATION.md`, `DECISIONS.md`, and the relevant current code. Read `PRODUCT.md`, `STATUS.md`, `CHANGELOG.md`, or broader repository context only when the assigned task requires them. Never recreate the application from memory.

For normal parallel work use `ECONOMY_MODE.md`: keep context narrow, avoid duplicate research/status ping-pong, run targeted tests while developing and full test/build before PR, checkpoint only at logical boundaries or before a likely session/credit interruption, and automatically continue only through bounded READY work.

## Agent team (v1)

Work is split across eight role-based agents (Coordinator, Auditor, UX Editor, API Integrator, Source Scout, Place Curator, QA / Release, Reviewer). Read [docs/agents/TEAM.md](docs/agents/TEAM.md) for roles, file ownership and flow, then your role file in `.claude/agents/<role>.md` and your notes in `docs/agents/<role>/NOTES.md`. ChatGPT/Codex agents follow the same role files. Work items live in GitHub Issues labelled `agent:<role>`.

## Roles

Jakub is Product Owner. He decides **what** the product should do, priority, positioning, monetization, and meaningful UX/product trade-offs.

Agents decide **how** to implement an already agreed goal. Technical implementation details that are reversible and consistent with the existing product direction should normally be resolved without asking Jakub.

Current default split:
- ChatGPT: architecture, runtime, Supabase/data layer, migrations, integrations, cross-feature integration and final technical review.
- Claude: implementation workstreams, repository audits/refactors, frontend/content/data-quality work assigned to its branch, and independent review.

The split is not permanent. Every sprint/PR must declare its owner and file/workstream boundaries.

## Branch and ownership rules

- Use short-lived `work/*`, `claude/*`, `fix/*`, or `chore/*` branches.
- One feature/workstream has exactly one owner at a time.
- One writer per file area whenever parallel work is active. Do not edit another agent's protected files unless the coordination log explicitly transfers ownership.
- Never commit directly to `main` for feature/runtime/schema work. Documentation-only coordination/protocol updates may be committed directly when they do not change application behaviour.
- Never force-push.
- Before opening/finalizing a PR, update from latest `main` and confirm no parallel work was overwritten.
- GitHub is authoritative. Do not rely on another agent's chat transcript as source of truth.

## Anti-loop rule

Agent-to-agent discussion must converge, not continue indefinitely.

1. Reviewer leaves **one consolidated review** with findings labelled `BLOCKER`, `NON-BLOCKER`, or `INFO`.
2. Owner makes one coherent fix pass and replies with what changed.
3. Reviewer may perform **one final re-review**.
4. If a material disagreement remains after the second review cycle, STOP the agent loop. Record both options plus recommendation in `AGENT_COORDINATION.md` and escalate to Jakub only if the decision affects product direction, irreversible state, cost, security, or cannot be resolved safely.
5. `NON-BLOCKER` and `INFO` comments never require an answer before merge.
6. Do not create a new PR solely to answer another agent's stylistic preference.

Maximum autonomous review exchange for one PR: **2 review cycles**.

## Risk levels and autonomy

### GREEN — agent may decide and execute
- tests and test coverage
- documentation
- bug fixes with clear expected behaviour
- refactors that preserve behaviour
- data cleanup/corrections with provenance
- retry, caching and fallback improvements
- accessibility fixes
- internal file/module structure
- reversible performance improvements

Requires: branch, tests/build, coherent diff.

### YELLOW — cross-agent review before merge
- runtime behaviour changes
- state/storage migrations
- Supabase schema/RPC changes
- service-worker/cache behaviour
- auth/community behaviour
- catalogue import logic
- external API/provider integration
- changes spanning multiple architectural modules

Requires: green CI + explicit reviewer pass + rollback/recovery path where relevant.

### RED — Jakub approval required before execution/merge
- destructive database migration or deletion of user data
- changing product scope, navigation hierarchy or primary user flow in a material way
- introducing paid infrastructure/API commitments
- secrets, permissions or security-policy changes
- force push/history rewrite
- removing major functionality
- irreversible production operation

Agents may investigate and propose RED changes but must not execute them autonomously.

## Merge gates

A PR that changes application behaviour may merge only when:
- scope matches the assigned workstream;
- changed files do not violate parallel ownership;
- `npm test` passes;
- `npm run build` passes;
- relevant regression/smoke coverage exists;
- no unresolved `BLOCKER` remains;
- database changes are new forward migrations — never rewrite an already-applied migration;
- cached assets changes bump the service-worker cache version when required;
- fallback/offline behaviour is preserved unless explicitly changing it;
- the change is reversible by reverting the PR or by a documented forward migration.

For data/import changes, preserve source/provenance and never fabricate ratings, reviews, coordinates or community results.

## Production safety

- Prefer additive migrations and backwards-compatible changes.
- Do not couple deploy and destructive cleanup in one step.
- Keep JSON fallback/seed behaviour where the current architecture requires it.
- Validate live Supabase parity after catalogue migrations before runtime cutover.
- If a production regression is found, prefer reverting the smallest responsible PR over stacking speculative fixes.
- Never silently delete or rewrite persisted local user state; migrate it or maintain backwards compatibility.

## Communication protocol

Use `AGENT_COORDINATION.md` only for actionable cross-agent handoffs, ownership, blockers and decisions awaiting review. Keep entries short. Do not use it as a chat transcript.

Format:

`[OPEN|ACK|DONE|ESCALATE] ID — owner — topic — requested action`

Examples:
- `[OPEN] TECH-014 — Claude — planner/tag mismatch — ChatGPT architecture review requested`
- `[ACK] TECH-014 — ChatGPT — fix belongs in category→intent mapping; runtime PR planned`
- `[DONE] TECH-014 — ChatGPT — merged in PR #27; Claude can continue`

An agent should respond only to `OPEN` items addressed to it, not every historical entry.

Use PR comments for code-specific review. Use `DECISIONS.md` for durable architectural decisions. Once an item is recorded as `DONE`, do not reopen it without new evidence.

## Independent product auditor personas

Canonical consumer personas are **v1.0** in [docs/personas/CITY_ROUTE_PERSONAS_V1.md](docs/personas/CITY_ROUTE_PERSONAS_V1.md); they replace the consumer personas 01–03 below. For discovery/ranking changes, first read [AUDITORS.md](AUDITORS.md) and use the four role-specific Markdown files in `auditors/` as **independent product-review lenses**, not autonomous coders. Each audit is tied to an exact commit and real evidence; report up to three findings with impact and a regression case. Archive insights and proposed persona updates in `auditors/AUDIT_LOG.md`. Persona "learning" means versioned changes reviewed by the Product Owner, not hidden memory or automated re-training. See the draft [discovery ranking proposal](docs/DISCOVERY_RANKING_V0.1.md); no production ranking change is authorized merely by adding docs.

## Visual design and photo work

For every UI, layout, icon, profile, route action, onboarding or photo discovery change, **read `docs/CITY_ROUTE_DESIGN_SYSTEM_V1.md` first**. It defines the agreed blue-and-white visual direction, the **single Lucide icon family**, mobile touch targets, independent follower/friend counters and photo attribution rules. Preserve app semantics: optional sections collapsed, no invented sponsored options, route stop removal reversible from its source card, and real photo source/identity match.
When modifying asset names, verify the corresponding `assets/icons/ui/*.svg` exists and is included in the deployed `dist/assets`. Run unit CI and mobile smoke; never claim a photo fill rate from static implementation alone.

## Existing project constraints

Keep vanilla HTML/CSS/JS unless a separately approved architectural change says otherwise. Preserve the current Supabase + static `dist/` deployment model. No paid API, backend replacement or framework without a demonstrated need and appropriate approval.

Test route execution and reload/resume, filtering, per-city basket ordering, generator constraints, event logging, keyboard access and mobile layout when relevant. Cloudflare deployment must publish `dist/`, never the repo root. Document deployment status honestly. GitHub contents/tree APIs are acceptable when Git CLI authentication is unavailable; update refs with expected SHA and no force.
