# City Route — release and backlog roadmap (2026-11-09)

**Snapshot, not standing authority:** reconcile this file against fresh GitHub issue/PR states, `AGENT_COORDINATION.md`, `DECISIONS.md`, CI and hosted environments on every handoff. Product owner Jakub decides product scope. The order below reduces the queue without unsafe bulk merges.

## Snapshot

- Starting inventory: 12 open PRs, 32 open issues.
- Cleaned today: PR #110, #126 **MERGED** (docs); PR #52, #83, #139, #141 **CLOSED AS SUPERSEDED** (not merged); Issue #114 **CLOSED** via #126, issues #104 and #112 **CLOSED** after hosted data checks.
- Remaining after cleanup: **6 open PRs** (#125, #143, #151, #154, #163, #164), **29 open Issues**.
- Hosted Supabase (read-only 2026-11-09): Warsaw **308** public places, **67** nightlife, **12** public editorial routes, **50** explicit `image_url`; Kraków **208** public places, **16** public routes, **0** explicit image URLs; Lisbon **188** public places, **0** routes, **0** explicit image URLs. Explicit URL is **not** visual photo coverage because provider/Wikimedia lazy runtime may render additional images. Warsaw provenance check: 308/308 public places recorded via `metadata.source` or `place_sources`.
- Hosted migration ledger has Lisbon 020/021 and push 025/026. `send-cityroute-push` Edge Function active, `push_subscriptions` has 0 rows. **Do not interpret this as proven Web Push delivery**.
- Product gap: 0 published Warsaw community routes (12 Warsaw editorial routes are not community routes); live imagery/device tests and real beta feedback remain open.

## Dependency graph / recommended release train

1. **Lisbon acceptance** — #146: merged city + OSM changes and live DB permit manual pilot *now*. **S** integration/field QA. Confirm city selector, actual mobile experience, place submit→approval→second account, and create 1–2 routes. No new core rewrite. High urgency because pilot is 2026-11-09.
2. **PR #151 review gate** — Issue #153: current head `65d6e1e9`; CI/P0 smoke/Worker green, GitHub reports not directly mergeable. **M**. Independent security/integration QA + resolve main conflict. Dependency for #154.
3. **PR #154 stacked integration** — base is **#151 branch**. CI and browser smoke green. **M**. Merge/reconcile #154 into #151, test combined preview, then merge release branch to main; never separately merge obsolete duplicate versions. This addresses pagination and parts of #116 and #119, *not* guaranteed OG images nor calendar .ics. Check actual share URLs and real Google Takeout/GPX.
4. **PR #125 / Issue #102** — event placeholder/card copy, CI + browser smoke green but PR not directly mergeable with main. **S coding, M integration**. Fold the narrow bug fix into the preceding integration pass or rebase and test independently; do not overwrite `app.js`.
5. **PR #143 Planner V2** — integrates superseded #139 + #141, CI/P0/Worker green but merge-conflicted. **L**. Addresses #134, #135, #136, #138, #140; inspect true feasible time budgets, transport leg behavior, outdoor museum selection, browser tests, rollback `?planner=v1`. Do not claim true street ETA from offline estimate.
6. **PR #164 iPhone UX** — CI green, draft CSS + regression tests, no real device verification. **S**. After #154 (and preferably #143) visually retest 320/375/390px, large text and iPhone 13 Pro Safari/PWA before marking merge-ready. Separate CSS file keeps textual merge overlap low but layout interaction still possible.
7. **PR #163 Web Push** — CI/P0/Worker green; staged backend partially present already. **M/L**. Independent review of HMAC, Vault, RLS and active webhook; ensure Edge Function plus SW client match exact deployed schema, then opt-in and real closed-app iOS push test. No merge or status DONE merely because migrations and function exist.

**Conflict hotspot:** `app.js`, `index.html`, `scripts/build.mjs`, `service-worker.js` are edited by #143, #151/#154 and #163. Designate **one integration owner** and release in a deliberate sequence. Never launch parallel uncoordinated edits to these paths.

## Independent fast wins (can be parallel only with file ownership)

| Scope / issue | Relative effort | Unlock/benefit | Acceptance |
| --- | --- | --- | --- |
| #146 Lisbon on-device acceptance | S | Valid external beta today | Place saved/shared, route plan, cross-account moderation; evidence |
| #108 newcomer copy | XS/S | Reveals people/events | Accurate user-facing first-run copy; screens and no-overflow tests |
| #107 generic side quests | S | Better route relevance | Place-specific prompt, no fake or templated generic task |
| #113 + #103 real Warsaw community routes | S coding / **people-dependent** | Fills empty social feed; affects #115 and retention | 10 actual user-authored and published routes, no fabricated authors |
| #119 calendar .ics remaining half | S/M | Practical export | Date/timezone/venue correct; verify import in Calendar |
| #105 events for “Today” | M/L | Fixes core persona blocker | Live accurate events from permitted primary/authorized sources, timestamps, freshness; #114 source research now done |
| #71 photo coverage + #123 alternate image | M/L | Critical first impression for all 3 active cities | Real photo hit rate by city & source, legal attribution, no wrong-venue images; #123 after trustworthy candidate discovery |
| #106 trust context on place cards | M | More compelling niche recommendations | Real editorial/community provenance, meaningful 'why', no invented quotes |
| #115 home route cards and surprise | M, product approval | Core first-run conversion | Evidence + founder acceptance, real route cards |

## Deferred / product design work

- #137 home city vs planning city (M): independent status/profile product decision; **not** a blocker to Lisbon pilot.
- #116 OG share preview (M): share buttons in #151/#154 do not alone prove bots receive rendered image metadata; separate Worker acceptance.
- #117 Story recap (M): after reliable completion events and sharing.
- #118 district discovery stamps (M/L), #121 retention backlog (L): only after useful content and accurate completions.
- #120 Strava API (M/L, external approval): separate from no-OAuth GPX export #119; don't conflate.
- #9 dual verification (L), #8 full realtime/social/account scope (L): audit what's already merged and identify the residual; do not rebuild entire social stack.
- #10 Warsaw catalogue breadth, #51 frictionless creation/sharing, #122 attractiveness sprint are **umbrella issues**. Track outcome with links to concrete child issues; do not treat them as three new independent implementations.

## Gate and working agreement

- **Jakub validates user-facing effect, not code.** Supply a tested preview link/video and plain-language acceptance summary for substantial product changes.
- Technical agents independently own code review, tests, rollback, CI, data permissions and integration. One owner of conflicted main/runtime files; at most two review loops.
- GREEN reversible docs/tests/content corrections can merge with appropriate checks. YELLOW cross-feature/runtime and auth/provider changes require independent reviewer. RED product/cost/security/destructive changes need founder approval as per `AGENTS.md`.
- Every completed issue receives concrete evidence and a closure comment. When superseded, close the obsolete PR instead of merging both. Do not claim deployment simply from green CI or merged SQL.
- After each integrated release, verify production and PWA cache before opening another broad runtime integration; work on two independent tracks at most.

## Next handoff checkpoint

First choose an integration owner for **#151 -> #154**, and a separate QA/release tester for Lisbon #146. Once integration preview is green, bring in tiny #125 fix and then planner #143. Parallel photo audit may collect source coverage metrics, but avoid competing edits to #151-owned `place-thumb.js`/`worker.js` until released.
