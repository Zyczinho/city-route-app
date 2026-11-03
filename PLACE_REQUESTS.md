# Place requests and "Moja trasa" visibility — product spec

Status: proposal from the product owner (Jakub, 2026-11-03), written up for review. Two independent parts:

1. **Prośby o miejsca:** users tell us what's missing; we see a ranked list.
2. **"Moja trasa" in mobile navigation:** make the user's own route easy to find.

## Part 1 — Place requests ("Prośby")

### Why

The catalogue is curated and will always have gaps ("za mało kebabów", "nie ma klubów", "brakuje Pałacu X"). Users can already add a private place for themselves, but that never reaches the shared catalogue. A request does. When 100 people ask for the same place, we know it matters.

Two paths stay separate:
- **Dodaj miejsce:** the existing flow. A private/local place for my own routes, available immediately.
- **Poproś o miejsce:** a request to City Route to add something for everyone. It's counted and ranked, and we decide.

### What a user can request

| kind | example | fields |
|---|---|---|
| `place` | "Kebab u Ahmeda, Bemowo" | name (required, 2–80), optional category from the taxonomy, optional area, optional Google Maps/OSM link or map pin, optional note ≤ 280 |
| `category` | "Za mało kebabów", "Nie ma klubów" | category (required), optional area, optional note ≤ 280 |

The city is always the active city.

### Flows

1. **Entry points**, all prefilled where possible:
   - Miejsca, search with few or no results: *Nie ma tego, czego szukasz? Poproś o miejsce* (prefilled with the query).
   - Miejsca, end of a category list: *Za mało miejsc w tej kategorii? Daj znać* (a `category` request for that category).
   - The place sheet of a **user-added** place: *Poproś o dodanie dla wszystkich* (prefilled name, category and pin).
   - Profil → *Twoje prośby*: the user's requests and their status.
2. **Votes instead of duplicates.** While the user types a name, the form shows matching open requests in the city with their counts: *12 osób też o to prosi — Dołącz*. Joining is one tap ("+1"). The same person can vote for a request only once.
3. **Status the user sees.**

   | status | what the user sees |
   |---|---|
   | `open` | Czeka |
   | `planned` | W planach |
   | `added` | Dodane, with a link to the new place |
   | `rejected` | Nie dodamy (short reason, e.g. closed, outside the city, not a place) |
   | `merged` | the user is shown the request it was merged into, and keeps their vote |

4. **Sign-in required** to request or vote, like publish/save/rate. An anonymous tap opens the sign-in prompt, never a fake local request.

### Admin ranking panel

A separate, isolated admin page (for example `admin.html` plus its own module, not inside `app.js`) for City Route staff:
- **The list:** requests per city, ranked by **votes** (all-time and last 30 days), with kind, category, area and first/last request date.
- **Filters:** city, kind, category, status.
- **Detail:** notes and links. Requester identities are hidden; only counts are shown.
- **Actions:**
  - set status (`planned`, `added` + link to the place, `rejected` + reason)
  - merge duplicates (votes move to the kept request, and each user still counts once)
- **CSV export** of the ranking.

**Access:** an `app_admins(user_id)` allow-list checked by the admin RPCs. Adding the first admin, Jakub's account, is a manual one-line SQL step done by Jakub. It's documented and never automated.

### Privacy and abuse limits

- **Visibility:** other users see only a request's display name, category, area, status and vote count, and only for `open`/`planned` requests (needed for "+1"). Notes, links, pins and who requested or voted are visible only to the requester (their own) and to admins.
- **Limits:** one vote per user per request. At most 20 new requests per user per day, enforced server-side. Name 2–80 characters, note ≤ 280.
- **Duplicate detection:** a normalised key (lowercase, no diacritics, collapsed spaces) per city, kind and category.
- **Moderation:** admins can `rejected`/hide offensive text. No automatic AI moderation in v1.

### Data (migration after 011, Claude-owned data package)

- `place_requests(id, city_id, kind, name, name_key, category_id, area, note, source_url, location geography null, status, resolution_note, resolved_place_id, merged_into, created_by, created_at, updated_at)`
- `place_request_votes(request_id, user_id, created_at)` with PK `(request_id, user_id)`. The requester's own request counts as their first vote.
- `app_admins(user_id)`

**RLS:** users insert their own requests and votes; delete only their own vote; read only their own rows. Everything else goes through RPCs:
- `request_place(...)`: atomic. It creates the request, or returns the existing matching open request and adds a vote. Rate-limited.
- `vote_request` / `unvote_request`
- `similar_requests(city, query)` for the "+1" suggestions
- `my_requests()`
- admin-only RPCs: `admin_request_ranking`, `admin_set_request_status`, `admin_merge_requests`, gated by `app_admins`

A client module, `place-requests-client.js`, mirrors the social client pattern: normalized objects, error codes, no DOM.

### Analytics

`place_request_create`, `place_request_vote`, `place_request_unvote`, plus admin actions. No PII in payloads.

### Acceptance

1. Users A and B request the same missing kebab in Warsaw (one creates, one joins). The admin sees one request with 2 votes.
2. A requests "więcej klubów" in Kraków. It doesn't appear in Warsaw.
3. Anonymous users can't request or vote. A non-admin gets `forbidden` from admin RPCs.
4. Merging two duplicates leaves each user's vote counted once.
5. The admin marks a request `added` and links the new place. A sees *Dodane* with the link.
6. Notes and requester identities never reach non-admin users.

### Out of scope for v1

Notifications/e-mails, a public "most wanted" board for everyone, automatic place import from a link, and paid boosts.

## Part 2 — "Moja trasa" in mobile navigation

### Problem (checked on production at 375 px, 2026-11-03)

The bottom bar has five equal tabs, about 71 px each: *Ułóż trasę · Trasy · Miejsca · **Moja trasa** · Zarezerwuj*. "Moja trasa" is fourth, with the same weight as the rest, and only gets colour once the basket has stops. With an empty basket it looks like any other tab, so even the founder struggled to find it.

### Proposal (recommended: A + B)

- **A. Make it the centre action.** Order: *Ułóż trasę · Trasy · **Moja trasa** · Miejsca · Zarezerwuj*.
  - "Moja trasa" is the middle tab, visually raised: filled cyan circle and icon, slightly larger.
  - A **badge with the number of stops** appears once there is at least one stop.
  - The existing states stay: cyan when stops are chosen, red "Na żywo" when a route is live.
  - It is always visible, even with an empty route, so people know where routes are built.
- **B. Reduce crowding.** Move *Zarezerwuj* out of the bottom bar into the header menu (next to Profil), leaving 4 bottom tabs with more room per label.
- **C. Smaller variant.** Keep the order but show the stop-count badge and a permanent cyan outline on "Moja trasa".

**Feedback:** adding a place from a sheet, list or map shows the toast *Dodano jako 3. przystanek · Zobacz trasę*, which links to "Moja trasa".

**Acceptance:**
- At 375 px "Moja trasa" is identifiable within one glance.
- The badge updates on add/remove.
- The live state is unchanged.
- Keyboard focus order follows the visual order.
- The OSM attribution and map card still aren't covered.

## Ownership

| item | owner | risk |
|---|---|---|
| REQ-SPEC-001: this spec | Claude, ChatGPT reviews | GREEN, docs |
| REQ-DATA-002: migration, RLS, RPCs, `place-requests-client.js`, PGlite harness | Claude | YELLOW |
| REQ-UI-003: entry points, form with "+1" suggestions, *Twoje prośby* | ChatGPT (runtime, `app.js`) | YELLOW |
| REQ-ADMIN-004: isolated admin page | Claude (new files only) | YELLOW |
| NAV-MYROUTE-001: bottom-bar change | ChatGPT (runtime, `app.js`/styles) | the product owner asked for it; option to be confirmed by Jakub |
