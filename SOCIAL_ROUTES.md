# City Route — Social / User Routes MVP

Status: implementation contract for the next product phase.

## Product goal

Turn City Route from a curated route browser into a routes-first network where a signed-in explorer can publish a route, other users can discover it, save it, fork it into their own builder, rate it, and open the author's profile.

This phase does not add groups/chat, payments, creator payouts, comments, DMs or a complex recommendation engine.

## Existing foundations we must reuse

- Supabase Auth already powers real email/password accounts and persistent sessions.
- `profiles` is the canonical public author profile.
- `routes` already supports `route_type = editorial | community`, `owner_user_id`, `visibility`, `status`, `city_id`, `transport`, metadata and RLS.
- `route_stops` and `route_tags` already support user-owned community routes.
- Route Builder already owns the user's city-scoped draft and can create a route object.
- Route cover assignment must continue to follow ADR-010: editorial heroes are dedicated; community/generated routes may borrow an unused stop photo in the currently displayed set, otherwise show a placeholder.

## MVP user flows

### 1. Publish my route

From `Moja trasa` a signed-in user can choose `Opublikuj trasę`.

Required fields:
- name
- city (fixed to active builder city)
- transport
- ordered stops

Optional:
- short description, max 500 chars
- tags from the existing route taxonomy
- visibility: public or unlisted

Rules:
- minimum 2 valid stops
- maximum remains the Route Builder limit
- only known catalogue places may be published in the first social MVP; locally added private places are rejected with a clear explanation until shared user places exist in Supabase
- public publish sets `route_type=community`, `status=published`, `owner_user_id=auth.uid()`
- unlisted routes are readable by direct link and owner but do not appear in discovery feeds
- private drafts are out of scope for public social browsing; local builder persistence remains the draft workflow

### 2. Community discovery feed

`Trasy` gains two clear surfaces:
- `Polecane` / editorial
- `Społeczność` / published public community routes

Community cards show:
- route name
- city
- author nickname
- stop count
- transport
- cover
- average rating and rating count when present
- save count
- fork count when present
- `Zapisz`

Sorts for MVP:
- `Popularne` — deterministic social engagement score
- `Najlepiej oceniane` — minimum 2 ratings before rating can dominate sorting
- `Najnowsze`

City selector always scopes the feed to the active city.

`Popularne` is not an opaque AI ranking. V1 can use a documented deterministic score based on saves, ratings and forks with a recency component. Route starts/completions may be incorporated later when those events are server-backed.

### 3. Save / unsave

Signed-in users can save a public community or editorial route.

- one save per user per route
- unsave is reversible
- `Zapisane trasy` appears in Profile or Trasy
- anonymous users who press Save get an auth prompt, not a fake local social save

### 4. Fork

A signed-in user can choose `Użyj jako bazę` on a public route.

Result:
- copies the ordered stop list into the active city's Route Builder
- copies transport
- name defaults to `Kopia: <route name>` or equivalent editable value
- does not modify the source route
- records `forked_from_route_id` when the fork is later published
- if the user already has a non-empty draft, require confirmation before replacing it

Forking across cities is blocked. The user must first switch to the source route's city.

### 5. Rate

Signed-in users can submit one 1–5 rating per published public route and later change it.

MVP rating rules:
- no anonymous ratings
- author cannot rate own route
- one row per user+route
- rating count and mean are shown separately from external place ratings
- no text reviews/comments in the first social MVP
- editorial routes may be rated too if the data model supports it uniformly

Later we can require server-recorded route completion before rating; that enforcement is not part of the first implementation because route execution events are currently local.

### 6. Author profile

Tapping the author opens a lightweight public profile with:
- nickname
- bio
- stay type when the user chose to expose it in the future; for this MVP do not expose stay by default
- public social links already present in profile
- published routes in the active/current city and an all-cities option
- aggregate route count

Do not expose e-mail.

### 7. Route ownership

On your own published route:
- edit metadata
- unpublish/archive
- delete

Editing route stops uses the existing Route Builder: `Edytuj` loads the route into the builder; publishing again updates the owned route rather than creating accidental duplicates when editing an existing published route.

## Data required beyond current schema

Migration 011 should add only what is missing:

1. `routes.published_at timestamptz`
2. `routes.forked_from_route_id uuid null references routes(id) on delete set null`
3. `route_saves(route_id,user_id,created_at)` with PK `(route_id,user_id)`
4. `route_ratings(route_id,user_id,rating,created_at,updated_at)` with PK `(route_id,user_id)`, rating 1..5
5. indexes needed for city/community feed aggregation
6. RLS so authenticated users manage only their own save/rating; public aggregate data can be read without exposing saver identities
7. a read model/RPC or view returning public community route cards with author nickname and aggregate save/rating/fork stats without N+1 client queries

Prefer a read RPC/view over denormalized mutable counters for the first MVP. No triggers that maintain popularity counters unless a measured need appears.

## Popular sorting v1

The database/client must expose raw component counts as well as any computed popularity score.

Recommended transparent starting formula:

`popular_score = saves_30d * 3 + forks_30d * 2 + ratings_30d * 2 + rating_quality_bonus + recency_bonus`

Where:
- `rating_quality_bonus` is zero until at least 2 ratings exist
- `recency_bonus` is small and capped so a new route cannot outrank strong engagement solely because it is new

If implementing a time-windowed formula makes the read model materially more complex, ship `Najnowsze` and `Najlepiej oceniane` first and keep `Popularne` deterministic using lifetime counts. Document the exact formula in code/tests.

## Client contract

Create a dedicated `social-routes-client.js`; do not spread Supabase social queries across `app.js`.

Expected operations:
- `loadCommunityRoutes({citySlug,sort,limit,cursor})`
- `loadSavedRoutes({userId})`
- `publishRoute({draft,description,tags,visibility,editingRouteId})`
- `archiveRoute(routeId)`
- `deleteOwnedRoute(routeId)`
- `saveRoute(routeId)` / `unsaveRoute(routeId)`
- `rateRoute(routeId,rating)` / `removeRating(routeId)`
- `forkRoute(route)` — pure/local helper may live outside the DB client if it does not need a write until republish
- `loadPublicProfile(userId)`

All methods return normalized application objects, not raw Supabase row shapes.

## Runtime UX boundaries

ChatGPT-owned runtime integration will touch `app.js`, relevant styles and PWA cache only after the DB/client contract is reviewed.

Claude-owned schema/client package must not edit `app.js`.

The first integrated UI should prioritize:
1. publish
2. community feed
3. save
4. fork
5. rating
6. author profile

Do not add groups/chat during this phase.

## Analytics

Keep existing local event logging and add:
- `community_route_view`
- `community_route_publish`
- `community_route_save`
- `community_route_unsave`
- `community_route_fork`
- `community_route_rate`

Do not send e-mail or other PII into event payloads.

## Acceptance criteria

The social MVP is complete when two separate test accounts can demonstrate this sequence on production:

1. Account A builds a Warsaw route and publishes it.
2. Account B sees it in Warsaw `Społeczność` without accessing A's private data.
3. B opens A's public profile.
4. B saves the route and the save survives reload/device session.
5. B forks the route into Route Builder without changing A's route.
6. B publishes the fork and attribution/provenance remains linked.
7. B rates A's route once and can update that rating.
8. A cannot rate its own route and can archive/delete its own route.
9. Switching to Kraków does not leak Warsaw community routes.
10. Anonymous browsing can read public routes but publish/save/rate requires sign-in.

## Explicitly deferred

- comments
- follows/friends graph
- creator payouts
- premium route marketplace
- route collaboration/editing by multiple users
- groups and realtime chat
- notifications
- moderation dashboard
- automatic AI recommendations
- server-verified route completion gating for ratings
