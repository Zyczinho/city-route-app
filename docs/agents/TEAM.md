# City Route agent team (v1)

Eight role-based agents develop City Route in parallel. Every role works the same way in Claude Code (subagents in `.claude/agents/`) and in ChatGPT/Codex (read the same role file named below). Roles are about **what an agent owns**, not which model runs it.

`AGENTS.md` (risk levels, anti-loop, merge gates) still applies to every role. This file adds who does what.

## Source of truth

- **GitHub Issues** hold the work: one issue per problem or task, labelled `agent:<role>`, plus `persona:*`, `severity:*`, `type:*` where relevant.
- **Pull requests** hold the changes. A PR names the issue it closes.
- `AGENT_COORDINATION.md` holds rules, ownership transfers and the founder priority lock, not a task list.
- Chat transcripts are never a source of truth.

## Roles

| Role | File | Writes code? | Main output |
|---|---|---|---|
| Coordinator | `.claude/agents/coordinator.md` | No | Prioritised, assigned issues; ownership conflicts resolved |
| Auditor | `.claude/agents/auditor.md` | No | Audit findings as GitHub Issues, per persona |
| UX Editor | `.claude/agents/ux-editor.md` | Yes | UI/UX PRs that close audit and user-feedback issues |
| API Integrator | `.claude/agents/api-integrator.md` | Yes | Integration cards, then integration PRs (maps, photos, Strava, events) |
| Source Scout | `.claude/agents/source-scout.md` | Docs only | Vetted recommendation sources in `docs/sources/SOURCES.md` |
| Place Curator | `.claude/agents/place-curator.md` | Data | Catalogue PRs: places with coordinates, category, licensed photo, provenance |
| QA / Release | `.claude/agents/qa-release.md` | Tests | Test/smoke fixes, mobile checks, production verification after merge |
| Reviewer | `.claude/agents/reviewer.md` | No | One consolidated PR review (BLOCKER / NON-BLOCKER / INFO) |

## Flow

```
Real users + Auditor ──► Issues ──► Coordinator (priority, owner, label)
                                         │
              ┌──────────────┬───────────┼──────────────┬─────────────┐
          UX Editor    API Integrator  Place Curator ◄── Source Scout   QA
              └──────────────┴───────────┼──────────────┘
                                   PR (own branch)
                                         │
                              Reviewer + QA gates
                                         │
                           Jakub merges (human gate)
                                         │
                         QA verifies production, closes issue
```

## File ownership (one writer per area)

| Area | Owner | Notes |
|---|---|---|
| `*.css`, `index.html` markup, `docs/CITY_ROUTE_DESIGN_SYSTEM_V1.md`, `assets/icons/` | UX Editor | Lucide only, 44 px targets, 320/375/390 px |
| `worker.js`, `geocode.js`, `place-enrichment.js`, `maps-preview.js`, `*-client.js`, `supabase/` | API Integrator | Paid APIs, keys and schema changes are RED/YELLOW per `AGENTS.md` |
| `data/`, `assets/images/`, `scripts/*import*`, `scripts/*curation*`, `DATA_SOURCES.md` | Place Curator | Never fabricate ratings, coordinates or photos |
| `docs/sources/` | Source Scout | No scraping; licence and terms first |
| `tests/`, `.github/workflows/`, `scripts/build.mjs`, `scripts/cache-version.mjs` | QA / Release | Owns flaky-test fixes and release checks |
| `auditors/`, `docs/personas/` | Auditor (personas changed only with Jakub's approval) | |
| `AGENT_COORDINATION.md`, `docs/agents/` | Coordinator | |
| `app.js` and shared runtime modules | Shared | Smallest possible diff; Coordinator assigns one writer at a time |

Two agents needing the same file is a Coordinator decision, never a race.

## Parallel work rules

- Each agent works on its own branch and worktree (`claude/ux-…`, `claude/api-…`, `claude/places-…`), one issue per PR.
- Start: `git fetch`, read the assigned issue, `AGENT_COORDINATION.md`, your role file and your `docs/agents/<role>/NOTES.md`.
- End: tests + build pass, PR opened and linked to the issue, NOTES.md updated with anything the next run must know.
- **PWA cache:** `scripts/build.mjs` adds a content hash to the service-worker cache name, so a feature PR no longer has to bump `city-route-vNN`. Bump the base number only for an intentional cache reset (QA / Release).
- Founder priority lock in `AGENT_COORDINATION.md` beats every role's own backlog.

## Cadence

| When | Who | What |
|---|---|---|
| Weekly | Auditor | Four persona audits of production → issues |
| Weekly | Source Scout | New candidate sources → `docs/sources/SOURCES.md` |
| Daily or after each merge | QA / Release | Production check (photos, icons, Add Place, community routes) |
| On demand | UX Editor, API Integrator, Place Curator | Take `agent:*` issues in priority order |
| Every PR | Reviewer | One review, at most two cycles |

Recurring runs can be scheduled as cloud routines (Claude Code `/schedule`) or started by hand; both read the same files.

## Learning with the project

- Each role keeps `docs/agents/<role>/NOTES.md`: decisions, rejected options, gotchas found in real runs (for example, Wikimedia thumbnails moved to `thumb.wikimedia.org`, use Google's first photo as the main photo).
- Personas, design system, sources registry and integration cards are versioned files; agents read them at start instead of relying on chat memory.
- Changing a persona, the founder priority lock or a role's ownership needs Jakub's approval in a PR.

## Human gates (Jakub)

Merge to `main`, paid APIs and keys, publishing user-visible content from new sources, persona changes and anything RED in `AGENTS.md`.
