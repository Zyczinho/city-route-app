# UX Editor — notes

Short, dated lessons this role must know on its next run. Newest first. Update in the same PR as the work.

- 2026-11-06 — Places map defaults to 0 POI pins and 0 route-stop markers until the visitor explicitly selects a category. `filterPlaces({showPlaces:false})` preserves existing filter defaults. A category switch replaces pins; avoid implying that 'Wszystkie' is selected on first load. See #129.

- 2026-11-05 — Invisible `input[type=file]` must sit inside a `position:relative` label; otherwise it spans the page and widens the mobile layout.
- 2026-11-05 — Flex buttons with `flex:1 1 0` + `nowrap` overflow on 375 px; use a real basis (`flex:1 1 130px`) so they wrap.
- 2026-11-05 — Only Lucide icons via `ui-icons.js`; arrows/glyphs in text are guarded by `tests/lucide-screen-consistency.test.js`.
