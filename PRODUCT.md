# City Route App — authoritative brief v1.3





MVP BUILD BRIEF

City Route App

Plan less. Explore more.

Goal: build a zero/near-zero-cost mobile-first MVP that can be tested immediately by the founder and a small group of friends, while keeping the project fully portable between ChatGPT Work and Claude Code.

NON-NEGOTIABLE DEVELOPMENT RULEGitHub is the single source of truth. Work is an execution environment, not the place where the project lives.Every meaningful working increment must be committed and pushed. If Work ends mid-task, the latest state must already exist in GitHub so Claude Code can continue without rebuilding context.No essential source code, data, configuration or project knowledge may exist only inside a Work session.



Working name: City Route App  |  Working logo: included above  |  Visual system: white, black and 1001 CAVE blue

Architecture reference: reuse proven patterns from Vowl, the existing 1001 CAVE phone-restriction / access-control app, where they reduce setup or handoff risk. Do not copy blindly; preserve City Route App as an independent product and repository.

Visual direction reference





1 / PRODUCT THESIS

What we are validating

City Route App answers one practical question: “I am in this city, I have X time - what is genuinely worth doing, and what is the easiest route to do it?”

The MVP is not a replacement for Google Maps, TripAdvisor, GetYourGuide or Atlas Obscura. It is a decision and execution layer above them: aggregate the strongest signals, let the user pick what matters, turn it into a route, and start moving.

Primary validation questionDo users actually press START and complete routes, rather than only browsing or saving ideas?Founder success signal: the app becomes easier to reach for than opening ChatGPT + several travel websites + Google Maps separately.



Core promise

Minimum planning, maximum useful time in the city.

Use proven routes when you want zero effort.

Use Best of City when you want to compare the strongest sources.

Use Sidequests when you want less obvious things worth doing.

Use Build when you want a custom route for your exact time, budget and vibe.

2 / MVP SCOPE

What V0 contains

Module | V0 behaviour

Explore | Ready-made city routes. Each route shows duration, distance, indicative cost, “free possible” where relevant, stops, basic social proof placeholders, START ROUTE and Google Maps handoff.

Best of City | Aggregated attraction discovery. Filters for Overall, Google Maps, TripAdvisor, GetYourGuide, Atlas Obscura and later Community. In V0 the dataset can be entered manually - no external API dependency.

Sidequests | Interesting things to do beyond standard Top 10 lists: food, hidden gems, culture, views, nightlife, nature and activities. Atlas Obscura-style discovery fits here, with clear source attribution where used.

Build | A simple custom route builder. Ask time, interests, budget, transport, food preference, tourist-vs-local preference and whether partner offers are acceptable. V0 can use deterministic tag-based logic instead of paid AI.

My Route | Shared basket/state across the product. Any attraction or sidequest can be added to My Route. User can reorder, remove, then optimize the sequence.

Route Mode | START ROUTE -> current stop -> Navigate in Google Maps -> Done / Skip -> next stop -> Finish -> Would you recommend? This is the core behavioral test.

Founder Test Mode | No full authentication. Each tester enters a name/nickname or receives a local tester_id. Store test activity locally initially; architecture should allow analytics/backend later.



3 / BEST OF CITY

The aggregator layer

The MVP should already demonstrate that City Route App can organize recommendations from different travel ecosystems without trying to replace those ecosystems.

Source | How V0 uses it | Example signal

Google Maps | Manually stored rating / link-out in V0. | 4.7 stars

TripAdvisor | Manually stored rating/ranking / link-out in V0. | 4.6 stars / #3 attraction

GetYourGuide | Rating where relevant; “Buy ticket” can initially be a simple external link. | 4.8 stars / ticket available

Atlas Obscura | Editorial/discovery signal, not forced into a numeric rating. | Atlas Obscura pick / featured

Community | Blank or test-only in V0; becomes proprietary signal later. | 8.9/10 / 94% recommend

Recommended Best of City filters: Overall | Google Maps | TripAdvisor | GetYourGuide | Atlas Obscura | Community

Important product ruleDo not invent a common numeric rating where a source does not provide one. Atlas Obscura can be shown as “Featured” or “Pick”.All source-derived data must be attributed. V0 should use manual seed data and external links rather than scraping or over-engineering integrations.



4 / BUILD AND ROUTE EXECUTION

Custom route builder

How much time? 1h / 2h / 4h / half day / full day

What matters? food / culture / sightseeing / hidden gems / mix

Budget? low / medium / premium

Transport? walking / bike / public transport / mix

Food style? quick bite / sit-down / none

Tourist level? must-sees / balanced / avoid tourist traps

Partner offers? yes / no

V0 route generation should work with the local places dataset and simple scoring/tag logic. Paid AI is explicitly optional for the first version. The purpose is to validate the UX and the behavior, not model quality.

My Route -> Optimize -> Start

DiscoverBest of City / Sidequests | Add+ Add to My Route | OptimizeOrder stops | StartRoute Mode | CompleteRecommend?

5 / SEED DATA AND VALIDATION

Initial content target

1 launch city: Warsaw.

10-15 ready-made routes.

About 30 Best of City attractions with manually seeded source signals.

About 30 Sidequests across several categories.

Optional Amsterdam sample content for travel testing.

Events to measure

Event | Why it matters

route_view | Interest

route_start | Intent becomes action

stop_complete | Real execution

stop_skip | Route quality problem signal

route_complete | Primary success metric

recommend_yes/no | Post-experience quality

add_to_route | Discovery usefulness

build_generate | Demand for customization

buy_ticket_click | Future monetization intent

MVP go / kill signalThe app succeeds if founder/testers actually use it while outside and complete routes.If people only browse, save and say “cool idea” but do not press START, the core concept is not yet validated.





6 / TECHNICAL ARCHITECTURE

Build for continuity, not for Work dependency

ChatGPT Work / Claude Code  ->  Two interchangeable execution environments.

GitHub - city-route-app  ->  Single source of truth for code, product docs, data and handoff state.

main branch  ->  Always deployable and stable.

work/* or claude/* branch  ->  Short-lived branch for active changes. Push frequently.

Cloudflare Pages  ->  Connected to GitHub. Production deploy from main; branch previews where available.

Repository skeleton

city-route-app/  index.html  styles.css  app.js  data/    routes.json    places.json    rankings.json    sidequests.json  assets/    logo.png    icons/    images/  manifest.webmanifest  service-worker.js  PRODUCT.md  AGENTS.md  STATUS.md  CHANGELOG.md  README.md

Do not create Work-only infrastructureThe app must run from repository files and documented environment settings.Do not make the product dependent on a temporary Work filesystem, hidden browser state or inaccessible local assets.No secrets in GitHub. If a secret/API key is ever needed later, document its variable name and configure it in Cloudflare/environment settings.



7 / REUSE THE EXISTING 1001 CAVE BUILD PATTERN

Use the previous app as a technical/process reference

Before inventing a new setup, inspect Vowl, the existing 1001 CAVE phone-restriction / access-control app (the NFC / app-limiting project). Reuse the parts of its architecture and development workflow that are already proven: repository conventions, PWA structure, GitHub-to-deploy flow, service worker/manifest patterns, documentation, branch discipline and Work-to-Claude handoff. The goal is to reduce duplicated setup work and keep the same resilient development model across 1001 CAVE products.

Reuse principles

Inspect the existing Vowl project before deciding the City Route App project structure.

Reuse proven patterns, scripts and conventions when they are generic and applicable; do not create unnecessary dependencies between the two apps.

City Route App must remain independently runnable and deployable from its own city-route-app repository.

If the prior project already solved GitHub -> Cloudflare deployment, PWA installation, service worker, asset paths, cache/versioning or handoff documentation, prefer adapting that solution rather than rebuilding it from zero.

Document in STATUS.md which prior patterns were reused and any intentional deviations.

Register City Route App in 1001 CAVE Studio

The 1001 CAVE Studio home/project screen is the portfolio and idea registry for all current product concepts. During the first build session, locate the existing Studio project and add City Route App as a new product/idea card using the Studio's existing component and data conventions. Do not redesign the Studio just for this task.

Studio field | Value

Name | City Route App

Status | MVP / Validation

Category | Travel / Local discovery / Routes

Tagline | Stop planning. Start exploring.

Short description | Aggregate the best city recommendations, turn them into routes, and start exploring with minimal planning.

Links | Link to the City Route App product brief/repository immediately; add the live Cloudflare URL when the first deploy exists.

Studio integration rule: the Studio card is a registry/entry point, not the source of truth for City Route App code. The app code, product docs and handoff state stay in the city-route-app repository. If Studio and City Route App are separate repos, commit and push the Studio card change in the Studio repo separately and record both commit references in STATUS.md.

8 / WORK -> CLAUDE CONTINUITY PROTOCOL

Mandatory handoff behavior

1 | Before changing code - Pull/fetch the latest repository state. Read PRODUCT.md, AGENTS.md, STATUS.md and the recent CHANGELOG.md entries.



2 | During a task - Use a short-lived branch such as work/explore-ui or claude/route-builder. Commit after each working milestone, not only at the end.



3 | After a feature works - Push the branch. Merge into main only when the relevant flow has been tested and main remains deployable.



4 | If Work quota/session is about to end - Immediately commit all usable progress, even if unfinished. Push the active branch. Update STATUS.md with exact current state, what works, what is incomplete, next files to touch and last tested URL/flow.



5 | When Claude takes over - Pull the exact active branch named in STATUS.md, run the documented app, inspect the latest commit and continue from the listed next step. Do not recreate the project from scratch.



6 | When Claude finishes - Commit/push changes, update STATUS.md and CHANGELOG.md. Merge to main only after a working checkpoint.



STATUS.md must always contain

Current branch and latest pushed commit.

Current task and target outcome.

What is already working.

What is incomplete / broken.

Exact next 1-5 steps.

Files most likely to change next.

How to run/test the project.

Any external configuration already completed (Cloudflare project, deploy URL, environment variables).

9 / FIRST WORK SESSION

What Work should build first

Priority | Task

P0 | Create or confirm GitHub repository city-route-app and place the product documentation inside it.

P0 | Set up mobile-first PWA shell, working logo, white/black/blue design system and bottom navigation.

P0 | Create seed JSON datasets and one complete vertical slice: Explore -> Route detail -> Start -> Navigate -> Done -> Finish.

P1 | Add Best of City with manual rankings and source filters: Overall, Google Maps, TripAdvisor, GetYourGuide, Atlas Obscura, Community.

P1 | Add Sidequests and Add to My Route.

P1 | Add Build form and simple deterministic route generation.

P1 | Add Founder Test Mode and basic local event logging.

P0 | Connect GitHub to Cloudflare Pages and verify deploy from main.

P0 | Create/update README.md, PRODUCT.md, AGENTS.md, STATUS.md and CHANGELOG.md before ending the session.

P0 | Inspect Vowl, the existing 1001 CAVE phone-restriction / access-control app, and reuse applicable architecture/process patterns instead of recreating solved setup.

P0 | Add City Route App to the main 1001 CAVE Studio products/ideas screen using the existing Studio card/data pattern; include repo/product link now and live URL after deployment.

10 / EXPLICIT NON-GOALS FOR V0

Do not spend the first build on these

Full user authentication

Real-time social / Live routes

Chat or messaging

Merchant dashboard

Cashback settlement

QR reward infrastructure

Automatic TripAdvisor / Atlas Obscura scraping

Complex external APIs

App Store / native app packaging

Paid AI dependency

Payments inside City Route App

11 / FUTURE MONETIZATION - ARCHITECTURE SHOULD NOT BLOCK IT

Monetization paths after validation

Affiliate tickets: Buy Ticket links for attractions/tours via partners such as GetYourGuide or Booking when commercially available.

Verified merchant visits: Restaurants/bars/venues fund perks or pay for verified customers delivered by City Route App.

Sponsored routes: Clearly labeled branded city experiences.

Creator marketplace: Premium routes with revenue share.

City Route Pro: Later subscription for advanced AI, offline, personalization and premium features.

12 / INSTRUCTION TO CHATGPT WORK

Start building from this brief

First check two existing assets before coding: (1) Vowl, the 1001 CAVE phone-restriction / access-control app, for reusable architecture/process patterns, and (2) the 1001 CAVE Studio home/project registry so City Route App can be added as a new product card.

WORK EXECUTION INSTRUCTIONTreat this document as the MVP product specification and continuity contract.First inspect whether the GitHub repo city-route-app already exists. If it exists, continue it; do not create a duplicate. If it does not exist and you have permission, create it.Persist source code and project state to GitHub continuously. Do not wait until the end of the Work session to push.Keep main deployable. Use a short-lived work/* branch for unfinished changes and record it in STATUS.md.Connect the repo to Cloudflare Pages when the first working vertical slice exists.Prioritize a usable mobile V0 over integrations. Manual seed data is acceptable and preferred for the first validation.Before ending for any reason, perform the handoff protocol in Section 7 so Claude Code can continue immediately.



CITY ROUTE APP

Stop planning. Start exploring.


## Owner scope update — 2026-11-02
Manual route authoring (sequential add + drag/drop + accessible reorder) alongside local algorithm; broader Warsaw catalogue of restaurants, bars, clubs, museums, monuments and hotels, excluding everyday utilities. Real accounts requested for friend testing; groups and chats future. Separate editorial and community verification requires actual review records, never inferred from imported source listings. Official event/venue ticket page is primary; actual secondary sellers are disclosed separately; no invented partnership or availability. Free admission must be evidenced and distinguish outside stops from interiors. Maps import should resolve location and ultimately name/photo with provenance.
