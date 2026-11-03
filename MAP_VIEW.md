# Map view module

`map-view.js` + `map.css` render City Route places on an interactive map. The module is self-contained; wiring it into the Places flow, build and service worker is MAP-INTEGRATE-002.

## API

```js
import {createMapView} from './map-view.js';

const view = createMapView({
  container,                 // empty element; the module owns its children
  places,                    // City Route place objects (id, name, lat, lng, categoryId, area, description)
  city,                      // {name, center:{lat,lng}, defaultZoom}
  filter,                    // optional {categories?, groups?}
  onSelect: place => {},     // marker/list selection; null when the card closes
  onAddToRoute: place => {}, // "Dodaj do trasy" on the place card
  onDetails: place => {},    // "Szczegóły": open the app's own place sheet
  onViewportChange: ({center, zoom, bounds}) => {},
  onNearbyChange: centerOrNull => {}, // optional hook for server-backed Nearby
  isInRoute: place => false  // shows "W trasie" instead of the add button
});
await view.ready;            // 'map', or 'list' when the map could not load
view.setPlaces(next); view.setCity(nextCity); view.setFilter({groups:['food']});
view.setNearby({lat, lng});  // 500 m radius around a point; null turns it off
view.select(id); view.destroy();
```

Pure helpers (`filterPlaces`, `nearbyPlaces`, `categoryGroup`, `placeLabel`, `boundsOf`, `cardHtml`, `listHtml`) are exported for the runtime and for tests. The "W pobliżu" button uses the current map centre. Pass the user's location with `setNearby` when the app has one. MAP-DATA-001 can replace the client-side radius with the PostGIS nearby RPC by passing its results through `setPlaces`.

## Provider and fallback

- Leaflet 1.9.4 is loaded lazily from unpkg, pinned with SRI hashes; it is loaded only when a map view is created. Tiles come from `tile.openstreetmap.org` and show the © OpenStreetMap attribution. No API key is used.
- If Leaflet fails to load or times out (8 s), or tiles keep failing, the same places are shown as an accessible list. The toolbar can also switch between map and list at any time.
- OSM's public tile server suits an MVP with modest traffic. A tile provider or self-hosted tiles are needed before heavy production use (OSM tile usage policy).

## Accessibility

- Markers are focusable Leaflet markers with a `title`/`alt` label (name, area, distance).
- The place card is a non-modal dialog; Escape closes it. A polite live region announces counts and fallbacks.
- The nearby toggle exposes `aria-pressed`. Reduced-motion users get no card animation or marker scaling.

## Integration notes (MAP-INTEGRATE-002)

- Load `map.css` after `styles.css`. It uses the existing tokens.
- Leaflet and tiles are cross-origin and are not cached by the service worker; offline use falls back to the list.
- Set `--cr-attribution` on the container if the attribution height changes.
