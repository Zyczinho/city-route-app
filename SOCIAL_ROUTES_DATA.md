# Social routes — database and read contract

Data layer for `SOCIAL_ROUTES.md` (SOCIAL-DATA-003): migration `supabase/migrations/011_social_routes.sql` and `social-routes-client.js`. The runtime UI talks only to the client, never to these RPCs directly.

## What 011 adds

| object | purpose |
|---|---|
| `routes.published_at` | first publish time, set by the server; an edit keeps it |
| `routes.forked_from_route_id` | fork provenance; `on delete set null` keeps a fork working when its source is deleted |
| `route_saves(route_id,user_id)` | one save per user per route |
| `route_ratings(route_id,user_id,rating 1–5)` | one rating per user per route; an upsert changes it |
| `community_route_cards` (view) | one row per community route: author nickname, ordered public stop IDs, tags and all aggregates |
| read RPCs | `community_routes`, `community_route`, `author_routes`, `public_profile`, `saved_routes`, `my_route_marks`, `route_ref` |
| write RPCs | `publish_community_route`, `archive_community_route`, `delete_community_route`, `save_route`, `unsave_route`, `rate_route`, `remove_rating` |
| `catalogue_routes` | same signature as 005, now `route_type='editorial'` only |

No denormalized counters and no triggers except `updated_at` on ratings.

## Security model

- **Tables:** saves and ratings have owner-only RLS for select, insert, update and delete. Rows may only target published public routes, and a rating can never be on your own route (`owner_user_id is distinct from auth.uid()`). `anon` has no table rights.
- **Writes:** write RPCs are `security invoker`, so the 003 route policies and the RLS above decide everything. Every write raises `auth-required` without a session, and `EXECUTE` is granted to `authenticated` only. Supabase default privileges grant `EXECUTE` to `anon` explicitly, so 011 revokes from `public`, `anon` and `authenticated` before re-granting.
- **Reads:** read RPCs are `security definer` with `search_path=''`. They're needed because `profiles` (001) is readable only by signed-in users, and anonymous visitors must still see author nicknames.
  - Each one filters visibility itself: feeds return `published` + `public`; `community_route(id)` adds `unlisted` by direct link, and the owner's archived routes for the owner.
  - They expose only `nickname`, `bio` and public social links. E-mail and `stay` are never returned.
  - `public_profile` answers only for authors with at least one public route, or for yourself.
- **The view:** `community_route_cards` is revoked from `public`, `anon` and `authenticated`, so it's reachable only through those RPCs.
- **Unchanged:** the `profiles` RLS from 001.

## Route references

Editorial routes reach clients as public slugs (`coalesce(legacy_id, slug)`, e.g. `old-warsaw`); community routes as UUIDs. Save, rate and fork-source arguments take `(p_city_slug, p_ref)`, and `route_ref()` resolves both forms server-side in one call. It returns only **published public** routes: a UUID matches a community or editorial route, and a slug matches only an editorial route in that city. Guessed slugs or UUIDs of draft, archived or unlisted routes resolve to `null`, so no internal ID leaks. The client never needs a separate lookup.

Unsave and remove-rating fall back to the UUID you passed, so you can still remove your own row after a route was archived or unlisted. That returns only the UUID you supplied.

## Feed card (`community_routes`, `community_route`, `author_routes`)

```
id uuid, city_slug, name, description, transport, visibility, status,
author_id, author_nickname, published_at, created_at, forked_from_id, forked_from_name,
stops jsonb (public place ids in route order), stop_count, tags jsonb,
save_count, saves_30d, rating_count, rating_avg, ratings_30d, fork_count, forks_30d, popular_score
```

- `forked_from_id` and `forked_from_name` are both `null` unless the source is currently published **public**. A public fork of an unlisted source (possible through a direct table insert) never reveals the source's ID or name, and an archived or unlisted source disappears from its forks' cards. The internal `routes.forked_from_route_id` FK is kept.
- Fork counts include only published forks.
- The client maps every row to `{id, uuid, kind:'community', cityId, name, …, author:{id,nickname}, forkedFrom, stops, cats, stats:{…}}`.

One RPC returns a whole page with every aggregate. Inside Postgres, each aggregate is a correlated lateral subquery served by a primary-key or partial index: saves and ratings by `(route_id, user_id)`, forks by `routes_forked_from_idx`, stops by `(route_id, position)`. Button state for a page (saved / my rating) is one more call: `my_route_marks(uuid[])`.

## Sorting

`p_sort`: `popular` (default; unknown values fall back to it), `top`, `newest`. Paging is `p_limit` (1–50) with `p_offset`; the client exposes it as an opaque `cursor`. Ties break on publish time, then id, so the order is deterministic.

```
popular_score = saves_30d*3 + forks_30d*2 + ratings_30d*2
              + (rating_count >= 2 ? (rating_avg - 3) * 2 : 0)        -- -4..+4
              + max(0, 3 - days_since_publish / 7)                    -- 3 → 0 over 21 days
```

- `top` sorts by `rating_avg` only once `rating_count >= 2`; below that a route ranks as 0. The tie-break is `rating_count`.
- `newest` sorts by `published_at`.

## Publish contract (`publish_community_route`)

- **Inputs:** `p_city_slug`, `p_name`, `p_stops`, `p_transport`, `p_description`, `p_tags`, `p_visibility`, `p_route_id` (edit) and `p_forked_from`, a **reference** (editorial slug or community UUID) resolved through `route_ref()`. Editorial forks keep provenance too. It runs as one transaction.
- **Validation:**
  - name 1–80 characters, after collapsing whitespace
  - description ≤ 500 characters
  - transport is `walking`, `bike`, `transit` or `mix`
  - visibility is `public` or `unlisted`
  - 2–20 distinct stops, each a **published public catalogue place of that city**; local or private user places are rejected with `unknown-stop:<id>`
  - tags ≤ 8, matching `^[a-z0-9_-]+$`, de-duplicated
  - the fork source must resolve through `route_ref()` (published public, editorial or community) and be in the same city; otherwise `invalid-fork-source`
- **Result:** a new route gets `route_type='community'`, `owner_user_id=auth.uid()`, `status='published'` and `published_at=now()`. An edit (`p_route_id`) must be yours and in the same city; it replaces stops and tags in place and keeps `id` and `published_at`. Any failure rolls the whole call back.
- **Errors**, mapped by the client to `SocialRoutesError.code`: `auth-required`, `city-not-found`, `invalid-name`, `invalid-description`, `invalid-transport`, `invalid-visibility`, `invalid-stop-count`, `duplicate-stop`, `unknown-stop` (with `detail`), `invalid-tags`, `invalid-fork-source`, `not-owner`, `route-not-found`, `invalid-rating`. An RLS refusal becomes `forbidden`; a failed transport becomes `network`.

## Client (`social-routes-client.js`)

`createSocialRoutesClient({client})` takes any object with `rpc(name, args) → {data, error}`:
- supabase-js with the user's session, for writes and `saved_routes`/`my_route_marks`
- `createRestRpcClient`, for anonymous reads

| method | RPC |
|---|---|
| `loadCommunityRoutes({citySlug, sort, limit, cursor})` → `{routes, nextCursor}` | `community_routes` |
| `loadCommunityRoute(id)` | `community_route` |
| `loadAuthorRoutes({userId, citySlug})` | `author_routes` |
| `loadPublicProfile(userId)` → `{id, nickname, bio, socials, routeCount}` or `null` | `public_profile` |
| `loadSavedRoutes()` → `[{routeId, type, cityId, id, name, savedAt, route}]` | `saved_routes` |
| `loadRouteMarks(uuids)` → `Map(uuid → {saved, rating})` | `my_route_marks` |
| `saveRoute(ref, citySlug)` / `unsaveRoute` | `save_route` / `unsave_route` |
| `rateRoute(ref, rating, citySlug)` / `removeRating` | `rate_route` / `remove_rating` |
| `publishRoute({draft, description, tags, visibility, editingRouteId, forkedFrom})` | `publish_community_route` (validated locally first with the same limits); `forkedFrom` is `forkRoute()`'s `{cityId, ref}` or a bare ref, and `forkedFromRouteId` stays as an alias |
| `archiveRoute(id)` / `deleteOwnedRoute(id)` | `archive_community_route` / `delete_community_route` |
| `forkRoute(route, {cityId, isKnown})` | none: a pure `route-builder-model` draft named `Kopia: …`; cross-city is refused; returns `forkedFrom: {cityId, ref}` for a public source (editorial slug or community UUID), or `null` for unlisted or archived sources |

## Verification

- `tests/social-routes.test.js` (in `npm test`): client normalization, single-call feed and marks, references, local validation, error codes, fork, and static checks of every contract point in 011.
- `supabase/tests/011_social_routes.pglite.mjs` (optional, needs PGlite in a temp folder) runs 011 **twice** on a real Postgres 16. The stub uses the 003 RLS policies verbatim and Supabase roles, `auth.uid()` and default privileges. It replays the SOCIAL_ROUTES.md acceptance flow with two accounts and an anonymous visitor: publish validation, feed and city isolation, unlisted links, editorial-fork provenance, an unlisted fork source never surfacing in public cards or author routes, `route_ref` ignoring draft/unlisted routes, unsave/remove-rating after archive, nickname without opening `profiles`, saves, ratings (no self-rating, upsert), fork provenance, ownership errors, atomic failed edit, archive, delete cascade, and the editorial-only catalogue.

## Applying

Forward-only and re-runnable. Apply to hosted Supabase **only after** review and merge (YELLOW). Existing editorial routes, the live parity check and `catalogue_places` are unaffected; `catalogue_routes` keeps its signature and returns exactly the same editorial rows as today.
