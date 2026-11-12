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

## ADR-012 — Planner: hard constraints vs preferences

Status: accepted 2026-11-10 (planner reliability audit).

Hard constraints remove a place before the search: city, explicit exclusions ("Czego nie chcesz" always wins), a known closure at the visit time, the total time budget, reach for the chosen transport, and stays (hotels never become stops). Everything else is a preference that ranks places or shapes the plan. A requested break is a slot, not a filter: when no suitable venue fits, the route is returned without it and says so. Opening hours: editorial pilot first, then OpenStreetMap `opening_hours`; when a place has no readable hours, food and nightlife use typical category hours flagged as unverified, and other places are not limited. An unreadable value is never treated as closed. When no route exists, the planner returns a reason (`no-candidates`, `interests-closed` with the earliest opening, `no-feasible-route`) so the UI can explain it instead of a generic message.

## ADR-013 — Start V3: chosen categories mean "only these"

Status: accepted 2026-11-10; the founder asked to implement the planner audit recommendations.

Start asks only what changes the plan. Selected interests are the plan: with any specific interest the planner uses only those categories (plus the requested break venue), and with "Wszystko po trochu" it mixes freely. When the selection cannot fill the time, the route is shorter and offers "Uzupełnij po drodze" instead of silently adding unrelated stops. Viewing mode is decided by the planner (inside when open, facade only for buildings worth seeing). The coffee break is automatic for daytime plans of 4 h or more and can be switched off. Interest chips are derived from the active city's catalogue (minimum five places). This supersedes the soft "Lubię" wording in issue #172 for Start; exclusions remain hard.

## ADR-014 — One route engine (Planner V2) for every transport

Status: accepted 2026-11-10 (planner audit P2).

Start and the variant reroll use `route-planner-v2.js` for walking, bike and transit, so one set of rules (hours, break slot, exclusions, interests) applies everywhere. Without a supplied leg matrix, transit legs are a labelled door-to-door estimate (10 min access and wait plus 18 km/h ride, walking when quicker), never presented as a timetable. A supplied matrix always wins. The legacy V1 generator in `core.js` is unreachable from the UI and remains only until its regression tests are migrated.
