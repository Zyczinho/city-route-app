# City Route — Requests / missing-place demand

Status: implementation contract for a parallel product package.

## Product goal

Give users a structured way to tell City Route what is missing from a city catalogue, and turn repeated requests into a ranked demand signal for the founder/content team.

This is not a generic support inbox. It is a catalogue-demand system.

## What users can request

Two request kinds are required from day one:

1. `place` — a specific missing POI, for example "Kebab King on Marszałkowska", "Palace X", "Bar Y".
2. `category_gap` — a broader catalogue gap, for example "more kebabs", "more bars", "more clubs", "more viewpoints".

Both are scoped to a city.

## User flow

From Places/Discover there is a visible entry point such as `Brakuje czegoś? Zgłoś`.

The form contains:
- city (fixed to active city)
- request kind: specific place / more of a category
- title (required)
- category (optional for a specific place, required for category gap when possible)
- short note (optional)
- optional Google Maps / official / venue URL for a specific place

Before creating a duplicate, the UI should show likely existing open requests for the same city and let the user support one instead.

Submitting/supporting requires a signed-in account. Public browsing of the ranked request list may remain anonymous.

## Demand / support model

A request has one creator and many supporters.

- creator automatically counts as one supporter
- one support per user per request
- user can remove support
- the main ranking is support count, with newest as a secondary sort
- do not create mutable counter columns for MVP; aggregate from support rows unless measured performance requires counters later

Example:
- "More kebabs" — 104 supporters
- "Club XYZ" — 71 supporters
- "More cocktail bars" — 39 supporters

This is the key founder signal: the number should represent unique signed-in users, not clicks.

## Status lifecycle

`open` -> `planned` -> `added` or `declined`

When a specific place request is fulfilled, it may link to the new `places.id` as `resolved_place_id`.

For category gaps, `added` means the team considers the gap materially addressed; it does not need to link to one place.

Only trusted/admin tooling changes status in the first version. Regular users can create/support/remove their own support, but cannot mark requests planned/added/declined.

## Founder panel

The first founder surface can be simple and operational rather than a full admin dashboard.

Required views:
- top open requests for active city, ranked by support count
- filters: specific places / category gaps / category
- counts per request
- newest requests
- statuses open/planned/added/declined
- direct source URL when provided

The founder should be able to answer: "What are users asking us to add most?" in one screen.

Do not expose private user identities in aggregate ranking. The founder panel does not need a supporter-name list for MVP.

## Database contract — migration 012

Prefer two tables:

### `catalogue_requests`
- `id uuid primary key`
- `city_id uuid not null references cities(id)`
- `request_kind text check in ('place','category_gap')`
- `title text not null`
- `normalized_key text not null`
- `category_id text null references place_categories(id)`
- `note text not null default ''`
- `source_url text null`
- `status text check in ('open','planned','added','declined') default 'open'`
- `created_by uuid not null references auth.users(id)`
- `resolved_place_id uuid null references places(id) on delete set null`
- `created_at`, `updated_at`

Use a normalization strategy for duplicate suggestions, but do not rely on a rigid unique constraint that would incorrectly merge genuinely different places with similar names. The server should return likely duplicates and let the client support an existing request.

### `catalogue_request_supports`
- `request_id uuid references catalogue_requests(id) on delete cascade`
- `user_id uuid references auth.users(id) on delete cascade`
- `created_at`
- primary key `(request_id,user_id)`

## RLS / privacy

- public/anon may read safe request cards and aggregate support counts
- only authenticated users may create a request or support/unsupport
- a user may delete/edit only their own request while it is still `open` and before it has meaningful third-party support; otherwise preserve the shared demand record
- users can manage only their own support row
- no public endpoint exposes supporter identities or e-mail
- founder/admin status mutation must not be granted to normal authenticated users

Do not hard-code an admin UUID in client code. If admin mutation is not cleanly available yet, ship the read/rank + user request/support path first and leave status changes as a documented SQL/admin operation until an admin-role contract is approved.

## Client boundary

Create `requests-client.js`. `app.js` must not contain raw Supabase request queries.

Expected operations:
- `loadRequests({citySlug,kind,category,sort,limit,cursor})`
- `findSimilarRequests({citySlug,title,categoryId,kind})`
- `createRequest({citySlug,kind,title,categoryId,note,sourceUrl})`
- `supportRequest(requestId)`
- `unsupportRequest(requestId)`
- `loadMyRequestMarks(requestIds)`

All methods return normalized application objects.

## Runtime UX

Initial UI can live inside `Miejsca` / Discover rather than adding another bottom-nav tab.

Recommended entry points:
- top or bottom of Places: `Brakuje miejsca? Zgłoś`
- request sheet/page with two choices: `Konkretne miejsce` / `Brakuje kategorii`
- ranked `Najczęściej zgłaszane` list with support button

Do not add a sixth permanent bottom-nav tab for Requests. The mobile navigation is already crowded.

## Analytics

Add local events:
- `catalogue_request_view`
- `catalogue_request_create`
- `catalogue_request_support`
- `catalogue_request_unsupport`

Never log e-mail or free-text note contents into analytics payloads.

## Acceptance criteria

1. User A requests a missing place in Warsaw.
2. User B sees the same/open request and supports it instead of creating a duplicate.
3. The support count becomes 2 and survives reload/device session.
4. B can remove support and the count drops.
5. A can also create a category-gap request such as "more kebabs".
6. Warsaw requests never appear in Kraków ranking.
7. Anonymous users may browse counts but cannot create/support.
8. No endpoint exposes supporter identities.
9. Existing Places, Route Builder and Social Routes behaviour is unchanged.

## Explicitly deferred

- free-form product bug/support tickets
- comments on requests
- notifications when a request is fulfilled
- automatic place ingestion from a request
- public moderation disputes
- complex admin roles/dashboard if a safe minimal admin path is not already available
