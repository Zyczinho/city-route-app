# City Route — Durable Technical Decisions

Only durable architectural decisions belong here. Product priorities remain owned by Jakub.

## ADR-001 — GitHub main is the source of truth

Status: accepted.

All agents start from the latest `main`. Chat transcripts are not authoritative project state. Parallel work happens on isolated branches and returns through PRs.

## ADR-002 — Multi-city core is generic

Status: accepted.

Warsaw and Kraków are city datasets on top of one City Route runtime. Adding a city must not require city-specific branches such as `if (city === 'krakow')` in shared core logic. City-specific concepts belong in data, tags, collections or route content.

## ADR-003 — Supabase is the catalogue source of truth

Status: accepted.

Published catalogue data is read Supabase-first. JSON remains seed/fixture/fallback where required for resilience/offline behaviour. Catalogue cutovers require live parity verification.

## ADR-004 — Spatial queries use PostGIS

Status: accepted.

Coordinates and nearby discovery use PostGIS/geography in Supabase. Generic spatial functions/RPCs should be reused across cities rather than implementing per-city distance logic.

## ADR-005 — User route basket is city-scoped

Status: accepted.

A user's `Moja trasa` basket is stored separately per active city. Switching cities must not destroy or mix another city's basket.

## ADR-006 — Applied database migrations are immutable

Status: accepted.

Never edit a migration that has already been applied to production. Corrections are delivered as new forward migrations. Prefer additive and backwards-compatible migrations.

## ADR-007 — Agents use bounded collaboration

Status: accepted.

Agent collaboration is asynchronous through GitHub. A PR receives at most two agent review cycles: consolidated review → fix pass → final re-review. Remaining material disagreement is escalated rather than continued as an endless agent loop.

## ADR-008 — Product owner vs technical autonomy

Status: accepted.

Jakub owns product direction, priorities and material UX/business trade-offs. Agents autonomously decide reversible technical implementation details inside an agreed goal. Destructive, costly, security-sensitive or product-direction changes require Jakub's approval.

## ADR-009 — One owner per parallel workstream

Status: accepted.

When multiple agents work concurrently, each feature/file area has one active owner. Another agent reviews rather than independently rewriting the same area. Ownership transfer must be explicit in `AGENT_COORDINATION.md`.

## ADR-010 — Editorial routes own unique hero images

Status: accepted.

Every editorial route must have its own first-class hero image rather than deriving the route cover from the first stop with an image. Hero images must be unique across routes within the catalogue: two routes may share stops, but they must never render the same hero asset/URL. Route-image validation must fail on duplicate hero images. Image selection should prefer high-quality, attractive, legally usable sources and preserve source/credit/licence metadata where applicable. POI images may still be reused inside place detail views; the uniqueness rule applies to route hero images.

## ADR-011 — Evidence-first P0 incident circuit breaker

Status: accepted 2026-11-09 at Product Owner request after issue #200.

When a real user reports the same core-flow failure after **two attempted fixes**, the Coordinator freezes speculative implementation and invokes the single Incident Debugger. The agent must preserve the exact failure as a regression, identify a falsifiable causal mechanism and verify failure-before/success-after on the same real data path before merging. CI green, production parity and real-user acceptance are different gates. The canonical procedure is `docs/qa/DEBUGGING_PROTOCOL.md`. Documentation and test evidence live in GitHub; chat history is not the persistent source of truth.
