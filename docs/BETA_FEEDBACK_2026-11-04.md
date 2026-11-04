# Pierwsza fala feedbacku beta — 2026-11-04

**Status:** PRODUCT TRIAGE, proposal only, not a runtime implementation or authorization to incur paid API costs.  
**Source:** screenshots of two testers + direct discussions summarized by founder + a family member's remark. Small qualitative sample, not quantitative evidence.

## Actual qualitative signals

| Signal | What testers reported | Interpretation / evidence limit |
|---|---|---|
| Time-specific feasibility | App should account for a specific date, weekday vs weekend and venue opening times; several conversations repeated the opening-hours need, especially if entering attractions | Repeated feedback; core route reliability gap, highest product priority |
| Multi-day | Trip from date to date rather than one day | Schedule by day; do not describe current generator as multi-day-capable |
| Exact inputs | Ability to type a specific amount rather than only choose brackets; optionally edit cost per activity | Existing planner uses 25/100/unlimited presets and seeded place costs; show estimates and allow overrides |
| Images | Some images do not appear on a tester's phone | Reproduce with city, place/route IDs, device, network, browser, HTTP/CORS and cache before deciding whether issue is missing content vs broken image |
| Google login | Manual account signup perceived as high friction | Add Supabase Google OAuth only after the owner configures Google OAuth client, redirect URIs and credentials; don't expose client secret |
| Onboarding | Tester didn't discover the existing guide; founder wants a short feature tour | The #about guide and entry above planner exist but have low discovery; separate **first-launch** onboarding, dismissible and nonblocking |
| Visual identity | One tester dislikes generic-looking interface | One subjective signal; perform brand/typography differentiation and check with multiple testers before redesigning functional UI |
| Route description freeze | Tester reported crashing/freeze while adding route description, then said it works | Could relate to resolved COMMUNITY-DETAIL-FREEZE-044 (PRs #80–#82); retest actual publish/edit flow with repro before claiming new bug |
| Map performance | Tester appreciated Google map loading | Positive signal to preserve in future changes |
| Paid results and sorting | Founder reports request to avoid TripAdvisor-like paid visibility affecting default ranks | Keep organic relevance and paid placement separate; any future paid promotion clearly marked and optionally hidden; never imply official TripAdvisor ranking if only a snapshot exists |
| Social discovery | Founder wants to reuse previously discussed social features | Existing mutual friend requests / groups / chats / routes are at varying QA stages; one-way **follow** must remain separate from accepted **friends**; no fabricated leaderboards or fake counts |

## Proposed order of work (not yet scheduled)

### P0-A — Verify reliability and photos before inviting a wider beta

- Investigate images failing on real tester devices and distinguish (a) genuinely missing photos, (b) HTTP/CORS error, (c) incorrect URL, (d) unsupported source/API credential not configured, and (e) stale PWA assets.
- Provide a graceful placeholder for a missing image, never silently substitute a random unrelated stock photo.
- Connect to existing PHOTO-COVERAGE-039 and PLACE-AUTO-PHOTO-032; do not duplicate their owner scope or violate Google/Tripadvisor content terms.
- Retest public route **publish with description → feed → open detail → back → open again** and retain screenshots/device details. Community detail freeze has an existing separate resolved incident.

### P0-B — Time-aware route feasibility (new feature)

**User input (minimal-first):**
- Today, specific date, date range (multi-day in second phase); optional start time and daily end time. Optional limit in PLN.
- For each stop requiring opening access, user chooses **enter / see from outside** (reasonable default by category, editable).
- Dates and timestamps use the destination city time zone, not browser-computer default; handle DST and visits crossing midnight.

**Data:** Opening hours provenance, last verified timestamp, weekly regular hours, special/holiday closures and available booking/last admission where independently verified. Unknown remains `unknown`, not `open`.
- Short path: start with curated and verified opening hours for a small pilot set of museums/attractions; no blanket claim that all Warsaw or Kraków sites have hours.
- Google Places (New) supports `regularOpeningHours` and `currentOpeningHours`; latter covers next 7 days including certain exceptions and triggers Enterprise field billing. Official reference: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places and https://developers.google.com/maps/documentation/places/web-service/data-fields
- API rollout requires founder approval of keys, paid quota and usage model; cached/retained content must respect provider conditions.

**Algorithm:** For each ordered stop calculate arrival (start time + prior visit duration + travel estimate), check that the user can complete the proposed visit before verified closure and minimum duration, reject or reschedule closed stops; when hours unknown, preserve the stop with a clear warning, not a fabricated confirmation. Distinguish exterior viewing vs ticketed entry and actual admission deadline. Output an explicit daily timeline. Integrate with routing time estimates in ROUTING-TIME-020 rather than silently assuming real street times.

**Acceptance cases:**
1. Museum 10:00–17:00, duration 60min, expected arrival 16:30 → not offered for full interior visit at that slot; suggest 16:00 or another day/place.
2. Same museum with 'outside only' → opening hours don't block an exterior sightseeing stop when public access permits.
3. Monday weekly closure → not scheduled on that Monday.
4. Holiday exception → override regular weekly schedule for supported next-seven-day dates.
5. Hours missing → badge 'Godziny wymagają sprawdzenia'; no 'otwarte' claim.
6. 2-day weekend trip → daily routes don't cross into the wrong day; report budget by day/overall.

### P1-A — Reduce signup friction

- Supabase Google OAuth button prominent on login/signup; keep email/password and allow guest plan + navigation without account.
- Configure Google client/server in Supabase dashboard and authorized redirect URLs for Cloudflare hostname, verify account linking, return from provider, mobile Safari/Chrome and local route preservation before deploy.
- Security-critical credentials remain server-side; do not implement fake social login in frontend.
- Official docs: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

### P1-B — First-launch onboarding, not duplicate About page

- Three concise slides or a single screen: 'Znajdź miejsca' → 'Ułóż trasę na swój czas' → 'Zapisz i podziel się', each with a real CTA.
- No login, geolocation or API call required to browse. `Pomiń` always visible; show only on first launch with versioned local flag; guide remains available in Profile or planner.
- A/B-style lightweight comparison with 5–8 beta users: can they tell how to add a place, create and open a route within the first minute?

### P1-C — Exact budget and flexible durations

- Optional numerical `Maksymalnie X PLN` instead of only three bracket values; allow detailed estimated price per stop and user override for personal planning (overrides do not mutate shared catalogue prices).
- The current `core.js` generator filters by `prefs.budget` with a 25 / 100 / unlimited cap; migration to optional `budgetPln` should preserve existing presets and tests.
- All prices are estimates where authoritative ticket/venue data is missing.

### P2 — Organic discovery vs promotions, design identity, social follow

- Apply existing design spec `docs/DISCOVERY_RANKING_V0.1.md` only after founder acceptance: relevance, rating, number of reviews, near me, local gems; separate sponsored results, clearly labeled. Never let payment manipulate organic rating/recommendation.
- UX: visual differentiation in typography, editorial covers, spacing and feature hierarchy; test two candidate treatments instead of an indiscriminate wholesale redesign.
- Social: existing accepted friendship status remains bilateral; future one-way follow is distinct and can drive creator feeds, explicit public content and genuine counts. Social leaderboards are later-stage, not beta reliability work. Community events are tracked separately in EVENTS-SOCIAL-MVP-043.

## Suggested iteration sequence

1. **Beta reliability gate:** photo load/route publication smoke, 2 real users and 1 iPhone/Android, with exact repro + network diagnostics.
2. **Time-aware v0:** single-day start date/time + visit type + verified pilot hours, 4–6 deterministic test cases; no chargeable requests required.
3. **Onboarding / Google OAuth:** first-run tutorial and external sign-in with real provider credentials + persistence checks.
4. **v1 advanced planning:** two-day itinerary, custom PLN cap, daily timeline.
5. **Design + discovery + social iteration:** after testers can complete a full route reliably.

## Success measures for next testing wave

- % new testers who get to a first generated/started route; abandonment at login; broken images by page; % suggested indoor venues closed at calculated visit time; route start/finish and actual user feedback.
- Record observed counts and reproduce issues; do not extrapolate conversion rates or universal preferences from only two early testers.

## Coordination safeguards

This file records founder feedback; **do not mark any feature implemented on its basis alone**. Before opening implementation work, reconcile `AGENT_COORDINATION.md`, current `main`, open PRs and active owners. Each implementation feature gets a scoped workstream and tests. Do not alter hosted Supabase schema or enable paid Google APIs without product/credential approval.
