# Route Builder v1 — specification

Status: implementation-ready spec (BUILDER-SPEC-001). Pure model: `route-builder-model.js` (BUILDER-MODEL-002). Runtime wiring, map rendering and persistence calls belong to the runtime owner.

## Goal

A routes-first manual builder. In one city, the user:
- adds places one after another
- removes and reorders them, by drag-and-drop or keyboard
- sees the numbered stops on the map
- keeps the draft per city across reloads and city switches
- saves it as their own route (publishing comes later)

The builder replaces nothing: it formalises today's "Moja trasa" basket so every entry point (place sheet, list, map, generated route) changes the draft through the same operations.

## Current behaviour this must stay compatible with

- `state.basketsByCity[cityId]` is an ordered array of place IDs, persisted in `localStorage['city-route-v1']`. `state.basket` mirrors the active city's array.
- Add/remove/up/down and pointer drag change `state.basket`; the drag reorders through `core.moveStop(ids, fromId, toId)`.
- Editing and city switching are blocked while a route session is live (`isLive()`).
- `saveRoute()` copies the stops into `state.myRoutes` with `cityId`.
- Places can disappear between catalogue versions. Kraków retired 17 slugs in migration 007, and user places can be deleted.

## State shape

```js
// one draft per city; plain JSON, safe to persist
Draft = {
  version: 1,
  cityId: 'krakow',
  stops: ['wawel-castle', 'plac-nowy'],  // ordered, unique place IDs; order is the route
  name: '',                               // optional; '' until the user names it
  transport: 'walking',                   // walking | bike | transit | mix (same set as routes)
  revision: 3,                            // +1 on every change that alters the draft
  updatedAt: '2026-11-03T10:00:00.000Z'   // set by the caller (model takes `now`), never read from the clock inside the model
}
```

### Persistence contract (v1, no storage migration)

- `basketsByCity[cityId]` stays the canonical stop list, so old clients and the live-route flow keep working. The model reads it with `hydrateDraft` and writes it back with `serializeDraft(draft).stops`.
- The optional metadata (`name`, `transport`, `revision`, `updatedAt`) lives in a new sibling object `state.builderMetaByCity[cityId]`. It is ignored by code that doesn't know it.
- Hydration never throws on bad input. It returns a valid draft plus a report `{dropped:[ids], deduped:[ids], crossCity:boolean}` so the UI can say "2 miejsca nie są już dostępne".
- `version` allows a later move to a single `drafts` store; unknown versions are hydrated as v1 where possible, or to an empty draft.

## Operations (pure, in `route-builder-model.js`)

Every operation takes a draft and returns `{draft, changed, error?}`.
- It never mutates its input.
- When `changed` is false, the returned draft is the same object (cheap equality for re-render guards).
- `revision`/`updatedAt` change only when `changed` is true.
- `error` is a machine code; the runtime maps it to Polish copy.

| operation | behaviour | no-op / error |
|---|---|---|
| `createDraft(cityId, opts)` | empty draft | throws on missing `cityId` (programmer error) |
| `hydrateDraft(raw, {cityId, isKnown, now})` | accepts a stop array, a `{stops,...}` object or garbage; keeps known IDs in order; drops duplicates and unknowns | returns a report, never throws |
| `addStop(draft, place, {at, now})` | appends (or inserts at index) | `duplicate` (no-op, `changed:false`), `cross-city`, `limit`, `invalid` |
| `removeStop(draft, id)` | removes | `changed:false` if absent |
| `moveStop(draft, id, toIndex)` | moves to an absolute index, clamped | `changed:false` if same position or absent |
| `moveStopBy(draft, id, delta)` | keyboard/arrow move (±1) | `changed:false` at the edges |
| `moveStopBefore(draft, id, targetId)` | drag-and-drop drop target, same semantics as `core.moveStop` | `changed:false` if the same or absent |
| `clearDraft(draft)` | empty stops, keep name/transport | `changed:false` if already empty |
| `setName`, `setTransport` | trimmed name ≤ 80 chars; transport whitelist | `invalid` for an unknown transport |
| `serializeDraft(draft)` | plain JSON for storage / `saveRoute` | — |
| `toRoute(draft, {id})` | `{id, cityId, name, stops, transport}` for the existing route views | — |

Rules:
- **Unique stops.** The same place is never twice in one draft; adding it again is a no-op that returns `duplicate`, so the UI can say "Już w trasie".
- **City isolation.** A place whose `cityId` differs from the draft's returns `cross-city` and changes nothing. Places without `cityId` count as the draft's city, the same as `forCity()` legacy data.
- **Limit.** `MAX_STOPS = 20`. Above 9 stops, a single Google Maps link can't hold the whole route; the runtime should split the Maps export rather than block building.
- **Determinism.** The same input always gives the same output. There's no randomness, no `Date.now()` inside the model (`now` is passed in), and no reordering except the requested move.

## Events (logged by the runtime, not the model)

`builder_add`, `builder_remove`, `builder_move` (with `method: drag|keyboard|buttons`), `builder_clear`, `builder_save`, `builder_hydrate_dropped`. Each one carries `{city_id, place_id?, from?, to?, stops}`. The existing `add_to_route` event stays for backward-compatible analytics and gains `source: sheet|list|map|builder`.

## Interaction

### Add
- **Entry points:** place sheet, list row, map card ("Dodaj do trasy"), Nearby results, and the "Ułóż trasę" generated result (replace or append, with explicit choice).
- **Feedback:** a toast with the stop number ("Dodano jako 4. przystanek"), and the map card switches to "W trasie" (`isInRoute`).

### Reorder by pointer or touch
- Drag only by the visible handle, so scrolling stays scrolling.
- The row lifts and the drop position shows as a line between rows.
- Auto-scroll near the edges of the scroll container.
- The drop commits through `moveStopBefore`. A cancel (pointer leaves the window or Escape) restores the order.

### Reorder by keyboard (WCAG 2.1.1 / 2.5.7)
- **Up/down buttons:** the per-row "Wyżej" / "Niżej" buttons stay, so a single tap or press is always available as a non-drag alternative.
- **Handle as a toggle:** the drag handle is a `button` with `aria-pressed`. Space or Enter picks the stop up. ↑/↓ moves it (`moveStopBy`), Home/End moves it to the first/last position, Space or Enter drops it, and Escape cancels to the original index.
- **Announcements:** an `aria-live="polite"` region speaks every step, e.g. "Plac Nowy, przystanek 3 z 5" and "Kolejność zapisana".
- **Focus:** focus stays on the moved row's handle after every re-render.

### Remove and clear
- Remove is immediate, with "Cofnij" in the toast for 5 s. The runtime keeps the previous draft; the model needs no history.
- Clear asks for confirmation when there are more than 2 stops.

### Mobile (375 px first)
- The stop list sits under the map, with a sticky summary bar: number of stops · distance · time, plus the "Start" and "Zapisz" actions.
- Touch targets are at least 44 px. The drag handle sits on the leading edge and doesn't steal horizontal swipes.
- Numbered markers must not cover the OSM attribution.

### Live route
While `isLive()`, the builder is read-only: no add, remove or move, and no city switch. The UI shows why ("Najpierw zakończ aktywną trasę").

## Map integration (`map-view.js`, owned by the runtime/map side)

New controller method, proposed: `setRouteStops(places)` draws numbered markers in draft order and a straight polyline between consecutive stops. Passing `[]` clears them. Selection, the card and `isInRoute` keep working. The order comes from the draft only; the map never reorders.

## Walking-time provider boundary

Today, `core.summary()` estimates straight-line distance ×1.3 with fixed speeds. The builder asks through one interface so a real router can replace it later:

```js
estimate(stops, transport, {signal}) -> Promise<{legs:[{km, minutes}], km, minutes, source:'estimate'|'provider'}>
```

- **Cache:** results are cached by `cityId|transport|stops.join(',')`.
- **Stale results:** a newer revision aborts the older request, so a late result is never shown for an old order (the same race as PR #28 Nearby).
- **Failure:** the runtime falls back to `summary()` and labels the result "szacunkowo".

## Save, publish and covers

- **Save:** "Zapisz" calls the existing `saveRoute(toRoute(draft))` into `myRoutes`. The draft stays, so the user can keep editing.
- **Publish:** shared/community routes need accounts and moderation; they're out of v1 scope. When they arrive, the payload is `serializeDraft` plus owner, `route_type='community'`.
- **Covers (ADR-010):** user and draft routes get their cover from `assignRouteCovers` over the full visible route set, never a photo already shown by another route.

## Acceptance (for the runtime PR)

1. Add 5 places from three entry points; the order shown equals the add order.
2. Reorder by drag, by buttons and by keyboard only; reload, and the order persists.
3. Switch Warsaw → Kraków → Warsaw: each city keeps its own draft; a Kraków place can never land in the Warsaw draft.
4. A retired or deleted place ID in a stored draft is dropped on load, with a one-line notice. Nothing crashes.
5. Read-only while live; editable again after finishing.
6. Screen reader announces moves; no step requires a drag.
7. At 375 px the summary bar, handles and attribution are all usable.
