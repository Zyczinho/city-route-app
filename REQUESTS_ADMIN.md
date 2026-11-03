# Founder panel for catalogue requests (REQ-ADMIN-004)

An isolated page, `admin/index.html`, that answers "what are users asking us to add most?" for each city. It's not linked from the app, it's `noindex`, and it doesn't load `app.js`. It reuses the app's Supabase session from the same origin: sign in inside City Route, then open `/admin/`.

## Files

- `supabase/migrations/013_app_admins.sql`: the `app_admins` allow-list and the admin RPCs. Depends on 012.
- `admin/index.html`, `admin/admin.js`, `admin/admin.css`: the page.
- `admin/admin-client.js`: the pure data client (no DOM), with CSV export.
- `scripts/build.mjs` ships the `admin/` folder. The service worker doesn't precache it, because the panel is online-only.

## Access model

- `app_admins(user_id)` has RLS enabled, **no policies** and no grants: no client role can read it or write to it.
- `is_app_admin()` (definer, signed-in only) answers yes or no for the current session. The page uses it only to choose what to show.
- `admin_catalogue_requests(...)` and `admin_set_catalogue_request_status(...)` are definers that **check the allow-list themselves** and raise `forbidden` otherwise. Nothing is granted to `anon`.
- Admin rows include each request's private **note** and **source link** (shown only when it's `http(s)`), but **never** the requester, the supporters or any e-mail.
- **No admin UUID** is stored in code or migrations. The migration creates the empty table only.

### Adding the first admin (manual, product owner only)

After 013 is applied, run this in the Supabase SQL editor with the e-mail of the account that should have access:

```sql
insert into public.app_admins(user_id,note)
select id,'founder' from auth.users where email='<your account e-mail>'
on conflict (user_id) do nothing;
```

To remove access: `delete from public.app_admins where user_id=(select id from auth.users where email='<e-mail>');`

## What the panel does

- **Filters:** city (active cities), status (`active` = open + planned (default), open, planned, added, declined, all), kind (places / category gaps), category.
- **Sorts:** most supports, most supports in the last 30 days, newest.
- **Each row:** rank, title, kind, category, created date, private note and link, support count (unique signed-in users), 30-day count and last support.
- **Status change:** open, planned, added or declined. For **added** you must enter the public id of the place now in the catalogue (e.g. `wawel-castle`): a missing or blank id is rejected with `place-required`, and it must be a published place in the request's city (`unknown-place` otherwise). Any other status clears the link. The creator then sees the decision in *Twoje prośby* (`my_catalogue_requests`).
- **CSV export** of the current view (UTF-8 with BOM for Excel). Cells that a spreadsheet could run as a formula (`= + - @`) are prefixed with `'`, so a user-written title can't execute.

## Not in this package

- **Merging duplicate requests.** It needs a `merged` status or a redirect column, i.e. a 012 schema change. Until then, decline the duplicate and link both through the note.
- An audit log of admin actions, and admin-role management from the UI.

## Verification

- `tests/admin-requests.test.js` (in `npm test`): client whitelists and clamps, the place link only for `added`, `isAdmin` for non-admins and signed-out users, error codes, CSV escaping and formula neutralization, and static checks of 013 and the page (allow-list checks, no identities, no grants to anon, no hard-coded UUID, no admin inserted, isolation from `app.js`, shipped in the build).
- `supabase/tests/013_app_admins.pglite.mjs` (optional; PGlite in a temp folder) applies 011, 012, then 013 **twice** on Postgres 16 with the Supabase roles stub. It covers:
  - the empty allow-list; an admin can be added by SQL only
  - anonymous and normal users: no ranking, no status change, allow-list unreadable and unwritable
  - the admin sees ranked rows with note and link, no identities
  - filters and sorts
  - status validation (`invalid-status`, `place-required` for `added` with a missing or blank place, `unknown-place` for another city or an unpublished place, `request-not-found`)
  - an `added` link that clears on other statuses
  - the creator sees the decision, and the public ranking stays active-only
- In a browser at 375 px, signed out: only the sign-in prompt is shown, no RPC is called, there's no horizontal scroll and no console error.

## Applying

Apply 013 **after** 012, and only after review and merge (YELLOW). Then add the admin row as above. Nothing in the main app changes.
