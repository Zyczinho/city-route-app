# Discovery Ranking v0.1 — Warsaw (PRODUCT PROPOSAL, NOT IMPLEMENTED)

**Status:** DRAFT / requires Product Owner acceptance before changing ranking UX, schema, or algorithms.
**Owner:** ChatGPT (spec only), reviewer/product owner: Jakub. **Task:** DISCOVERY-AUDIT-028.
**Scope:** Place discovery, recommendation shelves and generator inputs; excludes route travel-time optimisation, external-provider live API setup and modifying star ratings.

## Problem

A single descending ranking on Google/Tripadvisor stars or number of reviews amplifies already-famous places and obscures interesting local places. Quality of a venue (customer rating) is not the same thing as **worth visiting for this person at this moment**. A one-day visitor must still see essential Warsaw sights before niche markets, while residents and long-stay visitors need genuine discovery. A new community place with few reviews should be findable **without fabricating or inflating scores**.

Existing baseline as of 2026-11-04:
- `core.js`: `combinedRating` uses external review-count weighted average; `smoothedRating` uses a 4.3 prior and weight 200; `generate` combines user interests, tourist-level preference, smoothed quality, cost and geographic feasibility. This is **not** already a raw global popularity rank.
- `data/rankings.json`: snapshot, not live provider data.
- `data/taxonomy.json`: top-level venue types; `hidden_gem` is currently a type, but for discovery should usually be a **cross-cutting descriptor**, not a substitute for a place's real category.
- `#60` pending shared-place moderation; `#66` pending friends; `#67` pending City Route ratings separate from external Google/Tripadvisor mean. **Do not silently activate those drafts**.

## Core design: three interpretable discovery lanes, not a single universal leaderboard

1. **Klasyki miasta**: representative first-time essentials (Old Town, Royal Łazienki, etc.). Based on a curated essentials list and user intent, **not** automatic biggest reviewCount.
2. **Lokalne perełki**: genuinely interesting places with a local story, sometimes few/mixed reviews; an editorial or trusted-community endorsement has a visible **reason**, **source** and **freshness**.
3. **Odkryj coś innego**: niche, unusual, activity-led and emerging community places for people explicitly open to discovery.

These lanes are **overlapping labels**, not mutually exclusive categories: one place can be a classic and a local favourite. The category remains what the place objectively *is* (market, park, cafe, museum, landmark); lane/experience tags describe *why visit* (vintage, weekend-only, hidden, local, iconic, family-friendly, etc.). In particular, do not classify all markets as restaurants or events just to fit the current taxonomy.

Expose lanes as optional filters/shelves **inside Miejsca**, not as more permanent bottom-nav tabs. Offer "Wszystkie" / explicit user filtering. Change the default order only after an accepted product decision and tests.

## Ranking pipeline (v0.1 proposal)

**Stage A — retrieve and validate candidates**
- Filter by city, actual place category, user search intent, geographic scope, accessibility, relevant price range, open hours and date; distinguish permanent venue vs scheduled/seasonal market vs one-off event.
- A place closed today is not presented as "open now"; keep it discoverable for another date if useful. Missing hours => "hours unconfirmed".
- Deduplicate canonical *public* venue records from community and editorial submissions (pending moderated), while allowing unlimited private entries. Never collapse distinct tenants just because they share one address.
- Apply a minimum data-quality gate: verifiable name, location, basic description of experience, category and provenance. For local markets, include which days they operate and when this was last confirmed.

**Stage B — interpret user intent before scoring**
- User intent is contextual, not an immutable demographic: first-time essentials; general exploration; resident's new finds; niche/food/nightlife/markets; date/time; trip length; budget; preferred area.
- For no explicit intent, start with a **balanced but classic-first mix**; let users deliberately choose "Lokalnie" and "Odkryj coś innego".
- Retrieval searches over both top city sights and candidate long-tail venues. New published places are eligible even without ratings.

**Stage C — score within relevant candidates (conceptual dimensions, not final production weights)**
- **Fit to intent (40%)**: "I have 24h" should prefer broad essentials; "I want a flea market" should not recommend a stadium.
- **Value of visit / experience (25%)**: distinctiveness, compelling why-go, useful experience and editorial/community endorsement with recorded evidence.
- **Quality/confidence (20%)**: unaltered external ratings, review recency and cautious small-sample smoothing; optional separate City Route rating signal only when its schema is released. Count supports uncertainty, it is **not** itself a linear popularity bonus.
- **Practicality (15%)**: proximity, visit duration, opening schedule, seasonal availability, price and accessibility.
- The above are **initial hypotheses** for offline evaluation. Do not hardcode as final weights until persona audits and comparison against existing `core.js` results.
- **Popularity** is at most a *capped, low-weight tie-breaker*, never a proportional reward for 30,000 vs 50 reviews.
- A 3.2-rated market can rank well for "vintage market this weekend" because its *fit and discovery value* may be high, but must still display the honest 3.2 and a reason for the recommendation. Don't secretly override or hide poor reviews.
- The **editorial recommendation score is NOT a star rating** and must not be blended into Google, Tripadvisor or City Route community averages.

**Stage D — diversify final list and route suggestions**
- Re-rank selected candidates to avoid repeated nearly-identical places, neighbouring duplicates and dominant tourist categories; prefer category and area diversity when user intent permits.
- Offer example *soft display targets* for 10 suggestions (not quotas): first-time 7 classics / 2 local / 1 unusual; Erasmus long-stay 3 / 4 / 3; resident 1 / 5 / 4. Fill only with genuinely eligible candidates; reallocate a lane's slot if quality/availability fails.
- Keep **explicit search results truthful** to search intent: searching `Targ na Kole` must not bury an exact match under ten better-rated attractions.
- The `Zoptymalizuj trasę` control orders an *already selected set of stops* by travel efficiency and must not silently substitute these places with other ranked recommendations.

**Stage E — learning from evidence without untraceable self-reinforcement**
- Track impressions by lane and rank, detail opens, saved places, started/completed routes, "not interested", confirmed hours, reports of bad data.
- New places need controlled exposure in relevant contexts to collect meaningful feedback, **without guaranteeing high placement**. Keep a floor of **candidate eligibility** and limited discovery opportunities; do not reward clickbait.
- Measure per-intent quality and diversity: essentials coverage for first-timers; unique places surfaced; local venue exposure; downstream saves/completions; reports/negative outcomes. Never optimise only CTR.
- Build replayable ranking fixtures and persona comparisons before any online A/B test. Log ranking config version and explanations for a proposed recommendation.

## Editorial & community endorsement rubric — distinct from public reviews

Editors and community moderators both use the same transparent **0–2 evidence rubric**:
- **Reason to go** (0/1/2): concrete experience vs generic listing.
- **Distinctiveness** (0/1/2): specific local flavour, not a clone.
- **Trust and verifiability** (0/1/2): credible source, real location, currently existing.
- **Usefulness** (0/1/2): clear access, hours, context, budget; especially for tourists.
- **Persona fit** (0/1/2): who benefits and why, including when *not* to recommend.

The 0–10 rubric is an **internal discovery recommendation signal**, never displayed as a 1–5 consumer star score. An editor or approved community curator signs the evaluation, with timestamp, rationale and review date. Multiple editors may disagree; document evidence, not fabricate consensus.

A submitted venue may pass public-place moderation yet still have **no editorial endorsement** and remain accessible through search, category and geographic browsing. Moderation approval ≠ guaranteed promotion. Community authors should receive attribution and a chance of discovery through relevant retrieval, not a fixed rank boost per submission.

## Example — Targ na Kole vs Stadion Narodowy (illustrative only)

The values `3.2/5, 50 reviews` and `4.7/5, 30,000 reviews` are **hypothetical, not verified**.

- **24h first-time visitor**, neutral intent: a national landmark can feature early; a weekend flea market might appear in one optional local suggestion if its schedule fits.
- **Warsaw resident**, request `targi staroci w weekend`: Targ na Kole (if currently operating and verified) should match strongly; Stadion Narodowy is irrelevant, irrespective of its review volume.
- **Erasmus student**, request `interesting affordable Saturday`: local market may be a leading option with its accessibility, cost and scheduling clear.
- **Explicit sorting "Najwyżej oceniane"**: preserve truthful ratings and show the relevant sample size/source; explain that this ordering can differ from `Polecane dla Ciebie`.

## Technical change boundary / future work

1. **DISCOVERY-AUDIT-028:** approve this design and the four auditor cards; no production changes.
2. **RANKING-ENGINE**: create independent `discovery-ranking.js` with pure deterministic ranking + explanation metadata, tests/fixtures comparing 24h tourist, Erasmus, Warsaw local and explicit niche search. Do not alter external rating aggregation.
3. **DISCOVERY-UI:** implement lanes/sorts within Miejsca and route generator; keep existing nav and PWA. Test desktop, 375px, offline, up to 5k candidates, no empty/false states.
4. **EDITORIAL-DATA:** extend tags with true marketplace/market type and schedule semantics after data-schema review; community review provenance and audit trail. Respect pending PR #60.
5. **RANKING-EVAL:** log/explain candidate selection, audit versions; roll out gradually after explicit product acceptance.

**Open product decisions:** names of lanes; default proportion for a neutral new user; threshold for editorial promotion; how to handle missing opening hours; whether a person can choose explicit `Tylko klasyki` / `Tylko lokalne`.
