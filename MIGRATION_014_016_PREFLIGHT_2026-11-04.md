# Preflight — Supabase 014 → 015 → 016 — 2026-11-04

**Result:** BLOCKED for hosted DDL. **Read-only inspection only. No backup export was performed and no production database object/data was modified.**  
**Environment:** Supabase `City Route App` project `ycfhpvtsnsmzdmpvliif` (PostgreSQL 17, region eu-west-3, organisation `City Route` Free).  
**Source:** integrated draft [PR #69](https://github.com/Zyczinho/city-route-app/pull/69); migration files `014_place_submissions.sql`, `015_friends_unique_nicknames.sql`, `016_cityroute_ratings_and_route_feedback.sql`.

## 1. Backup / restore gate — NOT SATISFIED

- Connected Supabase organization is **Free**. Current Supabase documentation says managed daily backups are provided to **Pro, Team and Enterprise**, not Free: https://supabase.com/docs/guides/platform/backups . Free projects should export an off-site logical dump.
- This connector provides no backup-list or backup-download action. **No managed backup or prior manual dump could be verified**. A user-owned manual dump may exist separately, but that was not visible or verified.
- **No `pg_dump` or Supabase CLI export was run**. No backup archive exists as a deliverable from this inspection.
- Before hosted migrations, create and inspect an off-platform `roles.sql`, `schema.sql`, `data.sql` export with Supabase CLI over an approved secure connection, and confirm it includes the expected public tables and auth-user state. Keep credentials and dumps **out of GitHub and chat**. On supported platforms Supabase CLI requires Docker.
- Document backup timestamp, file sizes/checksums, row-count snapshots and storage bucket state, and validate a restore into a disposable *compatible* Postgres/Supabase environment. **A file existing is not proof of a restorable backup.** Because database backups do not cover file bytes stored by Storage API, Storage objects need a separate plan if used in the future.
- Recommended verified CLI pattern (read-only against the source; use your own confidential `SUPABASE_DB_URL` in an authenticated terminal):
  ```bash
  supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f roles.sql
  supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
  supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f data.sql
  ```
  Check the installed CLI's `supabase db dump --help` before execution. Official guide: https://supabase.com/docs/guides/self-hosting/restore-from-platform .
- **Stop condition:** Do not use SQL Editor, `apply_migration`, `db push` or merge #69 to production until restore readiness is verified.

## 2. Production snapshot (read-only on 2026-11-04)

| Probe | Result |
| --- | --- |
| Project health | ACTIVE_HEALTHY |
| Organization plan | Free |
| PostgreSQL | 17.11 / PostGIS 3.3.7 in `extensions` |
| Database size / public-table size | approximately 21 MB / 1608 kB |
| `public.places` | 275 rows |
| `public.routes` | 27 rows |
| `public.profiles` / `auth.users` | 1 / 1 |
| `public.app_admins` | 1 row; admin moderation account present |
| `public.route_ratings` / `catalogue_requests` | 0 / 0 rows |
| Public nick collisions after lowercase+trim | 0 groups |
| Invalid-length or surrounding-whitespace nicks | 0 |
| Storage buckets / Storage objects | 0 / 0 |
| `place_submissions`, `friend_connections`, `place_reviews` | all three ABSENT |
| Supabase migration history | `list_migrations=[]`; `supabase_migrations` schema and `schema_migrations` table absent |
| Branches | no Supabase development branches |

**Interpretation:** Previous 001–013-era schema was already applied (likely via SQL Editor or another path), but without tracked Supabase migration history. Do **not** re-run historical 001–013 migrations just to backfill the empty history.

## 3. Dependencies for the three migrations

**014 (shared place submissions):**
- Required: `public.cities`, `public.place_categories`, `public.places`, `public.app_admins`, `public.catalogue_requests`, `public.catalogue_request_supports`, `auth.users`, `storage.buckets`, `storage.objects`, `public.catalogue_request_key(text)`, `catalogue_request_validate(...)`, `create_catalogue_request(...)`, `is_app_admin()`, `set_updated_at()`, PostGIS `st_point` / `st_dwithin`. **Present** in actual production catalogs.
- `st_dwithin(geography,geography,double precision,boolean DEFAULT true)` provides the 3-argument variant via its default parameter. Exact 3-argument `to_regprocedure` probe is not a defect.
- Migration itself creates the missing `city-route-place-photos` Storage bucket. **The bucket is public**, so a guessed image URL may be accessible even while a submission is pending; this is a deliberate policy decision, not a backup. User consent must be clear.
- Migration replaces the previously deployed `create_catalogue_request(...)` RPC to remove the old 20/day quota, without deleting rows. Existing function's identity args/return value are compatible.
- Post-migration acceptance: only creator can see pending submissions, admin-only approval, no public duplicates in nearby places, private duplicates preserved, photo RLS and bucket URL semantics.

**015 (friends and unique nicknames):**
- Required: `auth.users`, `profiles(id,nickname,created_at)`, `set_updated_at()`, `handle_new_user()` and existing `on_auth_user_created` trigger. **Present**.
- Migration includes a data-changing `UPDATE` that renames secondary duplicate case-insensitive nicknames to `u_<uuid>`. Snapshot shows **0 collisions**, so no row is currently expected to change, but rerun the collision probe immediately before release.
- Migration replaces the signup trigger function. Existing implementation only inserted `profiles(id,nickname)`, so no other trigger behavior appears to be lost.
- Unique index `lower(btrim(nickname))` prevents case/space-variant duplicates. Verify signup, invitation RLS and group chat continuity after migrating.

**016 (independent City Route reviews and route feedback):**
- Required: `places(id,city_id,slug,legacy_id,created_by,status,visibility)`, `cities(slug)`, `route_ratings(route_id,user_id,rating)`, `routes(owner_user_id)`, `route_ref(text,text)`, `set_updated_at()`. **Present**.
- Creates `place_reviews`, adds `route_ratings.feedback` as a not-null empty text by default, and creates server functions for independent City Route rating aggregation and route-author-only feedback. No new average is blended into external Google/Tripadvisor values.
- Verify RLS against real accounts on hosted data before exposing UI.

**Note on existing security warnings:** Supabase Security Advisor currently reports `set_updated_at()` without fixed `search_path` and existing exposed SECURITY DEFINER functions. These are pre-existing issues and must be reviewed separately; do not change them blindly inside the migration preflight. A fresh advisor run after migrations is required: https://supabase.com/docs/guides/database/database-linter .

## 4. Release blockers / action list

1. **BLOCKER:** No verified restorable pre-migration backup. Obtain/validate external dump and record backup evidence.
2. **BLOCKER:** No realistic production-schema clone dry-run yet. Isolated fixture CI for 014, 015 and 016 has passed, but it cannot prove compatibility with every live trigger, extension, storage policy and role.
3. **REVIEW:** Empty migration history despite installed 001–013-era schema. Decide consistent deployment/version tracking for 014+; do not replay old SQL.
4. **REVIEW:** Public photo bucket available before moderation (product choice). Confirm this is acceptable and covered by UI consent.
5. **REVIEW:** Existing advisor warnings and anon-callable SECURITY DEFINER functions need role-by-role review, not a mass revoke.
6. **LATER:** Hosted two-account-plus-outsider end-to-end smoke of public-place proposals/moderation, friends, ratings and feedback, followed by Cloudflare release after explicit approval.

## Decision

**NOT READY to execute production migrations.** Schema/dependency read-only inspection is substantially complete and found no obvious missing base relation/function, but backup/restore assurance and full-schema dry-run are mandatory before approval. Existing production app and database remain unchanged.
