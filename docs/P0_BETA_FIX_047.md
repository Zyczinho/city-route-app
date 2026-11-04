# P0 beta hotfix — account isolation, direct place bookmarks, blue community save, photo fallback

## Scope

- **ACCOUNT-ISOLATION-047:** separate activity by browser-local guest and Supabase user scopes. Switching guest → A → B → A restores the matching isolated `city-route-v1` activity store. First sign-in from legacy guest state **does not silently transfer activity**. Original guest data is copied before account switch; a voluntary import button is offered when the destination account is empty. Import retains the untouched guest copy and a pre-import backup.
- **Nickname:** Supabase trigger-created `u_<uuid>` is a technical fallback, not an intentional public name. Display a normal 'Odkrywca' placeholder and invite a chosen nickname; do not propagate placeholders into uniqueness-constrained profiles.
- **Places UI:** direct labeled `Zapisz / Zapisane` buttons on place cards; the existing bookmark action saves/un-saves without opening modal; color and accessible pressed state are updated by the existing render.
- **Social routes UI:** once server save/unsave succeeds, sync all related buttons' aria-pressed/text immediately in cards and detail views. Saved = clearly blue. While the mutation is pending, disable the button against duplicate clicks.
- **PHOTO-COVERAGE-039, subset:** real image failure is represented by an explicit accessible placeholder, never a broken icon or unrelated unlicensed stock.

## Photo audit (source files, not a live remote-device claim)

- `data/places.json`: 50 Warsaw seed places; all 50 have an explicit `image` and the referenced local asset exists on `main`.
- `data/cities/krakow/places.json`: 208 Kraków seed places; all 208 lack `image`/`photoCandidates` fields. Their photos cannot be assumed present even if a paid/on-demand provider responds at runtime.
- Actual live Supabase row count can differ from static seed; user-contributed and enriched places need separate identity-by-identity photo sourcing and rights checks.
- The `photo-fallback.js` guard only repairs broken image presentation, **not** missing curated photos.
- Do not scrape Google/Tripadvisor image URLs or store provider images outside license/contract terms. Founder should prioritize a rights-verified set for Kraków and real mobile tests to distinguish absent photo vs HTTP/CORS failure.

## Acceptance gate

1. `npm test`, `npm run build`, mobile browser smoke and production cloud build green.
2. Guest with history → Google A new account → no inherited counters → sign out to guest → originals intact → Google B new account → no A data → Google A again → A returns.
3. Explicit import when account empty → original guest copy remains and account has correct previous history. Import is blocked if account contains an activity.
4. Technical `u_<uuid>` nickname is never treated as chosen name; existing valid account nickname is not overwritten by guest nickname without explicit import.
5. Place item button toggles directly without modal and stays in saved filters appropriately.
6. Community card/detail button displays distinct blue pressed state; repeated clicks while awaiting API do not duplicate mutations; if API rejects, do not falsely claim saved.
7. Failing image becomes truthful placeholder and no authorization-protected source is copied to local photo assets.

## Still not solved by this PR

- **ACCOUNT-SYNC-048**: actual cross-device, Supabase-backed synchronization of trips, visits, ratings, user places and bookmarks (requires dedicated ownership/schema design, never silently enabled).
- **FRIEND-BETA-SMOKE-030** and **PLACE-COMMUNITY-019**: two independently authenticated real-user production test of friends, profile privacy, approvals, reviews and shared routes; cannot claim passed from a single device screenshot.
- **PHOTO-COVERAGE-039**: 208 Kraków places need authorized photos and end-device checks.
- **EVENTS-SOCIAL-MVP-043**: event creation/RSVP/reaction feature depends on separate forward migration and two-user acceptance. Not part of this account/UI hotfix.
- **PROVIDER-BETA-ACTIVATION-036**: external official API keys, quota and contracts are independent and should not be turned on just for photos.
