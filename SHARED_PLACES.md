# City Route — shared community places (P0 PLACE-COMMUNITY-019)
Date: 2026-11-03. **Draft PR #60. Not yet applied to the hosted database.**

## User journey
1. Anyone may add **unlimited private, offline/local-first** places without an account, including two copies of the same place. No duplicate check and no automatic upload for private places.
2. Selecting **Zaproponuj społeczności** opts in to a submission. If signed in, a validated RPC submits a **pending** place; if signed out, it is kept locally and the user can sign in, open its detail and tap **Wyślij do społeczności**. The form needs no mandatory photo or rating.
3. The contributor sees moderation statuses from **Moje zgłoszenia miejsc** on Profile.
4. Authorized admin opens `/admin/place-submissions.html` and approves, rejects, or merges a duplicate by canonical catalogue ID. An administrator rechecks duplicate matches at approval. Public catalogue has one canonical place, even if many private copies exist. Private notes/URLs do not appear in public lists. An admin decision is checked again on the server on every action.
5. Approved places become ordinary published `public.places` rows, exposed by the **existing** `catalogue_places()` RPC, so any other visitor can search, see on the map, and add them to a route. Existing public-route code accepts their canonical IDs. A local route containing such a place maps its local ID to the canonical ID when sharing after approval; nonapproved local points cannot be published.

## Database design
Migration `supabase/migrations/014_place_submissions.sql` after `013_app_admins.sql`:
- `place_submissions`: author UUID, city, name and folded duplicate key, category, PostGIS location, source URL and short note, optional creator-photo object path, pending/approved/rejected/merged status, resolved canonical place UUID. Owner-only RLS SELECT. **No browser direct write grants**.
- Explicit security-definer RPCs: `create_place_submission`, `my_place_submissions`, `attach_place_submission_photo`, `admin_place_submissions`, `admin_review_place_submission`.
- Creator must be authenticated; city must be launched/next; coordinates must be valid and within city radius; name/category/source validated. **No daily submission limits or quotas.** The same normalized name within **150 m** of a pending/published place is rejected for community submissions only; distinct private local entries are never blocked. The per-city/name advisory lock is used by both submission and admin approval to prevent concurrent publication of duplicates.
- Approval creates the canonical `public.places` record only after authorized review; reject/merge does not create a duplicate. Server-side admin allow-list `app_admins` reused from 013. No automatic external photo scraping.

### Images
Contributors can keep local photos private. If they have rights, a checked photo-consent box permits uploading **their own compressed JPG** to a dedicated public Supabase Storage bucket. 3 MB maximum; owner-only one upload per proposal with a deterministic UUID path; no user delete/update policies. The bucket is public, so **the direct object URL can be opened after upload, even while its corresponding submission is pending**. This is disclosed next to the checkbox. The public catalogue displays an approved proposal photo only after moderation; otherwise the local image stays on-device. No copying or rehosting Google Places imagery.

## Release sequence — mandatory
1. Review PR #60 and test migration SQL in a development/staging Supabase database if available. Check the existing admin allow-list from 013 and current postgis schema, storage schema, and auth policies.
2. Take a database backup/snapshot and **apply migration 014** to the correct hosted Supabase project. Do not run it more than once without checking state. Confirm bucket restrictions and RLS.
3. With two different accounts, test: anonymous local save; sign-in → proposal → pending state; second account cannot SELECT pending proposal; admin sees queue; approve; second account can see the place after catalogue reload; duplicate submission returns a helpful error; accepted photo displays only with author rights.
4. Test merge with a real existing canonical place, rejected status and a route with a newly approved stop. Check storage object MIME/size constraints.
5. Once schema and browser tests are successful, merge PR #60, watch GitHub CI and Cloudflare Workers main build, verify PWA cache **v36** and both Warsaw/Kraków.
6. Keep `INFRA-CF-PREVIEW-001` separate: Cloudflare branch preview failures don't prove app failure; real main production deploy should succeed like last release.

## Pending limitations
- The contribution database is **not live** until migration 014 is applied and PR #60 merged; simply checking a GitHub branch cannot test hosted row security.
- Ratings made on a local place stay local; they are **not** included in public Google/Tripadvisor scores.
- Photo moderation is manual; abuse/report functionality and copyright takedown process can be extended in a later release.
- Publishing a community route requires every stop to resolve to an approved catalogue place. Existing local saved routes continue working on their original IDs.
- No paid Google Places autocomplete is enabled.
