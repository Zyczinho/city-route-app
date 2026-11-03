# Catalogue requests — database and read contract

Data layer for `REQUESTS.md` (REQUESTS-DATA-002): migration `supabase/migrations/012_catalogue_requests.sql` and `requests-client.js`. The runtime UI talks only to the client.

## What 012 adds

| object | purpose |
|---|---|
| `catalogue_requests` | one request: city, kind `place`/`category_gap`, title, `normalized_key`, optional category/note/source URL, status `open/planned/added/declined`, creator, optional `resolved_place_id`, timestamps |
| `catalogue_request_supports(request_id,user_id)` | one support per user per request; the creator's support is inserted with the request |
| `catalogue_request_key(text)` | duplicate-discovery key: lowercase, Polish/European diacritics folded, punctuation collapsed. A trigger keeps `normalized_key` equal to it on every title write. |
| `catalogue_request_cards` (view) | safe public card plus aggregates (`support_count`, `supports_30d`, `last_supported_at`) |
| read RPCs | `catalogue_requests_ranked`, `similar_catalogue_requests`, `my_catalogue_request_marks` |
| write RPCs | `create_catalogue_request`, `support_catalogue_request`, `unsupport_catalogue_request`, `delete_my_catalogue_request` |

There are no counter columns: support numbers are always aggregated from support rows (one row = one signed-in user). There's no unique constraint on `normalized_key`, because two different places may share a name; duplicates are *suggested*, never merged.

## Security model

- **Tables:** `anon` has no table rights. `authenticated` may select and insert its **own** requests and supports, delete its own support, and update only the columns `title`, `category_id`, `note` and `source_url` of its own request.
  - **Status, resolution, city, kind and creator are not writable by any client role:** there's no column privilege, and the insert policy forces `status='open'` and no resolution.
  - A user may edit or delete their own request only while it's `open` **and no other user supports it**, so shared demand is preserved. This check reads other users' supports through the definer helper `catalogue_request_has_other_supporters(id)`, because plain RLS would hide those rows from the creator and make the check always pass.
- **Supports:** allowed only while a request is `open` or `planned`, checked with the definer helper `catalogue_request_supportable(id)`.
- **Public reads:** definer RPCs with `search_path=''`. The card never contains `note`, `source_url`, `created_by`, supporter identities or e-mail. `resolved_place_id` is exposed as the **public place id** (slug), and only while that place is published public. The view is revoked from `public`, `anon` and `authenticated`.
- **EXECUTE:** revoked from `public`, `anon` and `authenticated` (Supabase default privileges grant it to `anon` explicitly), then re-granted. Ranking and similar-requests go to both roles; marks, writes and the two helpers go to `authenticated`.
- **Abuse limit:** at most 20 requests per user in 24 hours (`rate-limited`). A deleted request no longer counts toward that limit.
- **No admin UUID anywhere.** Status changes are a service-role/SQL operation until an admin-role contract is approved (see below).

## Read contract

`catalogue_requests_ranked(p_city_slug, p_kind=null, p_category=null, p_status='active', p_sort='popular', p_limit=20, p_offset=0)`
- `p_status`: `active` (open + planned), `open`, `planned`, `added`, `declined` or `all`.
- `p_sort`: `popular` (support count, then newest) or `newest` (created, then support count). The final tie-break is `id`, so the order is deterministic. `p_limit` is 1–50.
- Row: `id, city_slug, request_kind, title, normalized_key, category_id, status, resolved_place_id (public place id), created_at, updated_at, support_count, supports_30d, last_supported_at`.

`similar_catalogue_requests(p_city_slug, p_title, p_kind=null, p_category=null, p_limit=5)` returns open/planned requests in the city with a `similarity` score:
- exact key = 1.0
- one key a prefix of the other = 0.8
- otherwise 0.7 × the share of the new title's words (3+ letters) found in the request
- +0.1 for the same category

Results below 0.35 are dropped; ordered by similarity, then support count.

`my_catalogue_request_marks(uuid[])` (signed-in) returns `{request_id, supported, mine}` for a whole page in one call.

## Write contract

- `create_catalogue_request(p_city_slug, p_kind, p_title, p_category=null, p_note='', p_source_url=null)` → uuid. It validates:
  - the city isn't hidden
  - the kind
  - the title (2–120 characters, with at least one letter or digit)
  - the category is active in `place_categories`; it's **required** for `category_gap`
  - the note is ≤ 500 characters
  - the URL is `http(s)://` and ≤ 500 characters
  - the rate limit

  The request and the creator's support are inserted in one transaction.
- `support_catalogue_request(id)`: idempotent; `request-not-supportable` once the request is added or declined.
- `unsupport_catalogue_request(id)`: removes only your own support.
- `delete_my_catalogue_request(id)`: own, open and no other supporters, otherwise `not-deletable`.

Errors are mapped by the client to `RequestsError.code`: `auth-required`, `city-not-found`, `invalid-kind`, `invalid-title`, `invalid-category`, `category-required`, `invalid-note`, `invalid-url`, `rate-limited`, `request-not-supportable`, `not-deletable`. An RLS or privilege refusal becomes `forbidden`; a failed transport becomes `network`.

## Client (`requests-client.js`)

`createRequestsClient({client})` takes any object with `rpc(name, args) → {data, error}`: `createRestRpcClient` for anonymous ranking, or supabase-js with the session for writes and marks.

| method | RPC |
|---|---|
| `loadRequests({citySlug, kind, category, status, sort, limit, cursor})` → `{requests, nextCursor}` | `catalogue_requests_ranked` |
| `findSimilarRequests({citySlug, title, categoryId, kind})` | `similar_catalogue_requests` (skipped for empty titles) |
| `createRequest({citySlug, kind, title, categoryId, note, sourceUrl})` → id | `create_catalogue_request` (validated locally first) |
| `supportRequest(id)` / `unsupportRequest(id)` | `support_catalogue_request` / `unsupport_catalogue_request` |
| `deleteMyRequest(id)` | `delete_my_catalogue_request` |
| `loadMyRequestMarks(ids)` → `Map(id → {supported, mine})` | `my_catalogue_request_marks` |

A request object is `{id, cityId, kind, title, categoryId, status, resolvedPlaceId, createdAt, supports, supports30d, lastSupportedAt, similarity?}`. `requestKey()` mirrors the SQL key for client-side previews.

## Founder operations (SQL editor, until an admin contract exists)

Run these as the service role or the SQL editor owner; no client role can do this.

```sql
-- What are users asking for most in Warsaw? (includes the private note and link)
select r.id,r.request_kind,r.title,r.category_id,r.status,r.note,r.source_url,
       count(s.user_id) as supporters,max(s.created_at) as last_support
from public.catalogue_requests r
join public.cities c on c.id=r.city_id and c.slug='warsaw'
left join public.catalogue_request_supports s on s.request_id=r.id
where r.status in ('open','planned')
group by r.id order by supporters desc,r.created_at desc;

-- Change status; link the place once it exists
update public.catalogue_requests set status='planned' where id='<request id>';
update public.catalogue_requests set status='added',resolved_place_id=(select id from public.places where slug='<place slug>') where id='<request id>';
update public.catalogue_requests set status='declined' where id='<request id>';
```

## Verification

- `tests/requests.test.js` (in `npm test`): row normalization without private fields, key folding parity with SQL, the single-call ranking with whitelisted filters/sorts/cursor, duplicate lookup, local validation, support/marks, error codes, and static checks of the 012 contract.
- `supabase/tests/012_catalogue_requests.pglite.mjs` (optional; PGlite in a temp folder) applies 011, then 012 **twice**, on Postgres 16 with the 003 RLS verbatim and Supabase roles/default privileges. It replays the REQUESTS.md acceptance flow with three accounts and an anonymous visitor:
  - create validation, key normalization, creator auto-support, no status writes
  - city isolation and safe anonymous cards, plus duplicate lookup that folds diacritics and avoids false matches
  - support/unsupport idempotency and only-own rows
  - shared demand protected from the creator's edit/delete
  - the rate limit
  - service-role lifecycle with the public resolved-place id, filters, sorts and paging
  - the 011 catalogue unaffected

## Applying

Forward-only and re-runnable. It depends on 003 (cities, places, place_categories) and 001 (`set_updated_at`). Apply to hosted Supabase **only after** review and merge (YELLOW). Existing Places, Route Builder and Social Routes data and RPCs are untouched.
