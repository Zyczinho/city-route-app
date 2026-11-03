# City Route — Intent-led discovery, nightlife and pricing (product design v1)

Date: 2026-11-03. Status: PRODUCT PROPOSAL; no runtime feature, pricing or payment has been deployed through this file.

## North star
Ask "Po co dziś otwierasz City Route?" rather than "Jaką trasę chcesz zaplanować?".
User selects **current intent**, not a permanent identity. One person can change intent at any time.

## Entry architecture
- First visit: a lightweight 1-screen choice ("Co chcesz dziś odkryć?") with four intent tiles and a prominent "Pomiń, pokaż mi aplikację". No login or location permission required.
- Subsequent visits: optionally remember last intent and city locally, but never force a remembered persona. Show persistent "Zmień sposób odkrywania" access from routes header and Profile. User-requested discoverability: "Kim jestem? / Dla mnie" explanation can live as a subview in Profile or header rather than sixth overcrowded bottom tab.
- Bottom navigation stays five existing tabs: Ułóż trasę, Trasy, Moja trasa, Społeczność, Miejsca.
- City picker defaults to existing city selection; don't silently assume location. Discover and execute without sign-in; authentication only for publishing, saving account-wide, joining communities, creating events.
- Focus the entire onboarding on time-to-first-relevant-action. Use one follow-up question per intent (not multi-step forms).

## Four intents and personalized paths

### 1. Poznaj swoje miasto (newcomer / Erasmus / resident)
Question: "Co najbardziej chcesz robić?" categories: Poznać ludzi / Wydarzenia / Spacery / Jedzenie i bary. Optional neighborhood.
Results: city-scoped upcoming verified gatherings, local walks, creators and communities. CTA "Zobacz dzisiejsze propozycje" then "Dołącz" or "Rozpocznij trasę".
UX must expose empty states when there are no real upcoming meetups. Existing profiles/community modules may be reused; do not pretend events and chats work if backend missing.

### 2. Mam tylko kilka godzin (time-boxed visitor)
Question: "Ile masz czasu?" 1h / 2h / 4h / Cały dzień, optionally "Gdzie zaczynam?" later.
Results: up to 3 routes ranked by feasible completion time, transport, estimated cost, opening hours where verified; include classics and no-friction ready-made routes. Hero CTA "Rozpocznij" in one additional tap. Avoid pseudo-precision on estimated time.
Do not require AI or signup. Deep-link existing route detail/start/resume workflow.

### 3. Pokaż mi coś lokalnego (authenticity seeker)
Question: "Jaki klimat?" Jedzenie / Sztuka i kultura / Mniej znane dzielnice / Nocne życie.
Results: city-scoped editorial 'lokalnie' routes plus real authored published community routes and profiles. Show attribution: route source, author, verified published date/last check, ratings with genuine counts; never show invented visitor count or verified badges. CTAs "Przejdź trasę" and "Użyj jako bazę".
A route with only a category 'lokalnie' is not automatically verified as local-created. Define creator credibility/review policy before adding certification.

### 4. Gdzie dziś wyjść? (nightlife / immediate event)
Question: "Na co masz ochotę?" Techno / House / Live / Bar / Bez znaczenia.
Results: ranked **events** before venues. Event card should show start/end, precise date (local city timezone), address, artist/genre, age/ticket/access conditions where known, ticket price source and last checked timestamp; fall back to venues only with clear distinction.
Never infer "good party tonight" from static venue Google rating. Current Ticketmaster endpoint is a partial international source, optional key; small independent nightlife requires human editorial/organizer/partner submissions and verification. Do not display fabricated event/activity. Show honest empty state and options for curated bars if no trustworthy events.
Deferred event creation: authenticated organizers submit title, venue, times, category, visibility, capacity/tickets, confirmation and source links; moderation/abuse/reporting; group RSVP/join and per-event chat require separate approved schema/RLS.

## Result screen design (one reusable intent result shell)
Header city / switch intent / explanation in 1 line.
1) Hero "Najlepiej dopasowane teraz" — 1 main actionable route/event.
2) Up to 3 curated alternatives, ranked by intent not opaque popularity.
3) Editorial & local creators (genuine author attribution only).
4) Explore on interactive map, respecting category and city.
5) Edit preferences or create your own route.
Keep recommendation explanation visible ("Dlaczego widzisz tę trasę?").
Never mix paid placement into organic ranking without clear label and methodology.

## Current architecture mapping
- `app.js` routesView, existing route category `lokalnie`, route details and route execution; changes to shared runtime only after P0 production startup/hotfix is verified and board task claimed.
- `data/routes.json` and Kraków city routes use existing editorial route records; no duplicate content or fabricated author social proof.
- `route-builder-model.js` / `map-view.js`: reuse existing ordering, stop markers and map.
- `social-routes-client.js` and `social-routes-enhancements.js`: actual public creators/published routes only when social production smoke passes.
- `community-enhancements.js`: groups are distinct from public routes, mark unavailable flows honestly.
- `events.js` + `worker.js`: Ticketmaster-backed events when configured; add provider-specific status and last-verified display.
- New UI isolated in dedicated `intent-discovery.js/css`; keep core app state `basketsByCity` untouched; local lightweight preferences with versioned key `city-route-intent-v1`; avoid nav MutationObserver loops, avoid rewriting `nav-enhancements.js` without current owner clearance.
- Do not build pricing or billing in this package; proposal only.

## Monetization hypotheses (not available for purchase)
Free: browse places/routes, simple planner, start basic routes, public community discovery.
1-day pass: **4.50 PLN / rolling 24h** after activation, not calendar-day expiry; advanced itinerary options and offline/premium content only if implemented and valuable.
Monthly Explorer: **15 PLN / month**; annual Explorer: **99 PLN / year** (test price, not committed).
Creator Pro: e.g. **49 PLN / month** for genuine professional tools/insights only after creators have demand; core publishing stays free.
Business/Organizer: e.g. **249 PLN / month** for verified event pages, audience analytics or performance leads; separately labeled sponsored placement, no paid organic ranking manipulation.
Taxes, mobile-store commissions, fixed payment fees, refunds and chargebacks can make 4.50 PLN transaction unprofitable. Validate unit economics and paywall conversion before implementation. Day pass and monthly can cannibalize each other; compare cohorts and attach premium value first. No payment promises or false 'free' labels.
The buying person can differ from user: visitor, creator, organizer, restaurant/hotel.

## Event data model (future separately approved package)
`event(id, city_id, venue_place_id nullable, organizer_id nullable, title, genre_tags, start_at, end_at, timezone, price_amount, currency, ticket_url, event_url, source_type, source_url, last_verified_at, status, moderation_state, created_at)`.
Future RSVP and chat require auth+RLS, spam limits, moderation, user consent, and cancellation handling. Do not embed in route records.

## Acceptance metrics / test
- Funnel: intent shown → selected → result viewed → route/event clicked → route started → completed / external ticket click → return 7d.
- Segment and city are explicit analytics dimensions; ensure no email or sensitive profile data in events.
- Test thresholds are hypotheses: >=70% intent selection on exposure, >=40% relevant result click, >=20% route starts, validate after 30+ independent testers.
- Switching intents does not change active route, city-scoped saved drafts, or account data.
- Cached/offline PWA remains bootable on fresh and previously installed clients.
- No fake ratings, fake completion counts, fake event availability, or blocked no-account browsing.
- Run npm test, npm run build and manual 375px navigation QA plus full route start/resume after runtime PR.

## Delivery boundaries / dependencies
1) **INTENT-SPEC-010** docs proposal + owner review. This branch makes NO production changes.
2) **INTENT-UX-011** onboarding, results and intent switch, AFTER PWA-RECOVERY-009 + NAV-HOTFIX-008 production smoke, UX-CLEANUP-007 acceptance, and concurrent catalogue PR #52 scope reconciliation. This package cannot edit another agent's owned runtime concurrently.
3) **EVENTS-LOCAL-012** new nightlife/event ingestion and organizer workflow: separate moderated data model + sourcing plan, later.
4) **PRICE-VALIDATION-013** price/paywall research and payment implementation only after clear premium benefits and actual conversion evidence.
