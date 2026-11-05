# City Route — beta user journey & gray-copy audit (2026-11-05)

Source: founder feedback from Przemek + existing app screens and repo. This is a concrete route-by-route code QA checklist, not a claim of physical-device completion.

## End-to-end first-time experience

1. **Start / Ułóż trasę** — headline and primary planning control. Removed the gray paragraph explaining that the planner builds a route. Keep date/venue-hours caveats only in advanced planning because they change the user's decision.
2. **Miejsca / discovery** — search, category chips, genuine ratings and photos; removed the redundant "Find, save or add" explanation under the page title. If there are no matches across the city, show `Nie ma tego miejsca? Dodaj je`; if a result exists in a different selected category, offer `Szukaj we wszystkich kategoriach` instead.
3. **Add Place autocomplete** — local matches and externally sourced suggestions first. Only on completed no-match suggest a custom entry. On network error explicitly tell users online search is unavailable; don't conflate provider outage with zero results. User-entered name is prefilled into the add form.
4. **Location / input** — name and coordinates are still required for local save. Keep actionable location/error messages; remove repetitive "Done, photo and description optional" helper after an otherwise successful lookup.
5. **Photo editor** — choose 1–5 JPEG/PNG/WebP files, cap each at 10 MB, preview, edit 4:3 / square / 16:9 with x/y/zoom, change cover, delete photo, save cropped local JPEGs. Keep original resized source in unsaved draft; no re-compression until save. The saved cover is used on place cards.
6. **Visibility / rights** — explicit unchecked rights checkbox only if user both selects PUBLIC and uploaded at least one photo. Private places don't require rights consent. No rights -> public place can be submitted *without* an image.
7. **Save** — private place has local gallery and cover. Public submission sends only a permitted primary/cover photo to existing Supabase Storage; photos 2–5 remain local and are visibly labeled as such. If local browser storage is full, preserve form and fail before pretending to have saved.
8. **Log in / sign up** — preserve error feedback, show a single unobtrusive `Zalogowano pomyślnie` toast following real sign-in even after Google redirect and local account-scope reload. No success toast merely from navigation/reopening an already signed-in session. Removed outdated gray account-synchronization sales copy.
9. **Profile** — compact identity; real follower/following/accepted friend counters; local activity stats and More collapsed. No redundant account hero. Local activity synchronization limitations remain in accurate help/sources, not in every navigation step.
10. **Guide and booking** — guide is searchable and collapsed, so keep instructional text *inside* opened topics. Booking provider details remain explicit (the app isn't claiming to own inventory); removed generic "everything you pay for is here" paragraph.
11. **Place detail** — show actual description, existing-source attribution, photo gallery for own local places; removed premature generic "editorial review waiting" line before any public submission.

## Copy preservation rules

Retain information about consent, privacy, attribution, moderation, unknown opening hours, unaffiliated external booking and local-vs-cloud limitations when it materially affects a decision. Avoid repeated gray copy that simply narrates the heading or the primary CTA, fake review scores, or a future feature presented as active.

## Technical boundary to be resolved separately

The current hosted bucket `city-route-place-photos` admits one name per pending submission, `user_id/submission_id.jpg`, and the attachment RPC stores one path. This sprint **does not change that policy** or claim public multi-image synchronization.

Phase two (separate scoped PR and explicit production migration approval) needs a moderated gallery relation keyed by the submitted place, strict ownership and upload limits, separate per-photo rights confirmation, new Storage policies, API delivery of approved photo metadata, deletion/rollback and multi-device load, plus real two-account acceptance.

## Acceptance

- Node model/tests and Playwright at 375px: no-match search → prefilled form → 2 photos → cover switch → crop → private save; rights remain unchecked for public selection.
- 320/375/390px no horizontal overflow, usable touch controls and no blocking toast.
- Real Safari iPhone 13 Pro: repeat the journey with actual photographs, confirm correct cropping and no lost state after re-render; test login success after email and Google separately.
- Public two-account beta: share cover with consent; remaining local photos MUST NOT appear publicly until phase two is active.
