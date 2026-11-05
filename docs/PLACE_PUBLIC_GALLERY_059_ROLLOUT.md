# PLACE-PUBLIC-GALLERY-059 — staged, review before deployment

**Code owner:** ChatGPT / integration. **Status:** PR staged; production schema unchanged until approved by founder.
**Based on:** City Route `main` at 2026-11-05 after #94. Existing single-photo flow preserved.

## Audyt izolowanej migracji — 2026-11-05

**SQL executed successfully in isolated PostgreSQL 17 in GitHub Actions.** Production is PostgreSQL 17.11, checked read-only. The CI creates a production-aligned *minimal fixture* for `auth.uid()`, `storage.objects`, existing place submission, city and canonical place tables and applies the exact staged SQL with `psql -v ON_ERROR_STOP=1`. Test cases: owner uploads + attaches two extras, explicit rights check, outsider cannot attach or write in owner's folder, anon cannot SELECT pending metadata, admin can list and exclude photo 3, original approval updates photo 2 while leaving rejected 3 hidden. Test workflows CI, P0 browser smoke, and Cloudflare Worker build diagnostic also PASS for PR #95 after correction.

Detected and fixed a real blocking SQL syntax error: reserved result column `position` in `RETURNS TABLE` required quoting. The SQL integration test additionally required `::smallint` casts on literal call arguments to match the existing typed RPC signature; this was a test invocation correction, not a production migration change.

**Boundary:** this is PostgreSQL SQL/RLS execution against a schema fixture, not a complete Supabase hosted clone nor a live Storage HTTP transfer. Supabase project currently reports *no registered migration history and no development branches*. Do not infer that new branches automatically mirror manually applied production DDL. There were zero changes to the hosted production schema.

**Known privacy characteristic, unchanged from existing cover:** `city-route-place-photos` is a PUBLIC bucket. An unlisted, pending or rejected blob can still be retrieved if its direct path is known; metadata visibility RLS does not protect bucket bytes. The founder must explicitly accept this limitation for the current MVP or choose private staging storage before approving production deployment.

Run evidence: `.github/workflows/public-gallery-sql.yml`, `tests/sql/public-gallery-fixture.sql`, `tests/sql/public-gallery-security.sql`. Run exact branch HEAD checks on PR #95 before production `Run`.

## User story

1. User selects **public** place and uploads up to 5 own JPEG/PNG/WebP files in the existing editor, picks cover, crops and explicitly confirms rights.
2. Saved local `place.image` is the chosen cover and `place.images` contains up to 5 cropped JPEGs.
3. Submission is created through the *existing* `create_place_submission` RPC. Cover is uploaded to the **unchanged** `user/submission.jpg` path using `attach_place_submission_photo`.
4. Additional photos are uploaded sequentially into `user/submission-2.jpg` ... `user/submission-5.jpg`; each registered with `attach_place_submission_gallery_photo` after Storage verifies ownership, exact path, active pending submission and consent. Retry tracks uploaded positions and skips duplicate uploads.
5. Moderator at `/admin/place-submissions.html` reviews the cover plus all extras, can exclude or restore individual extras while pending, and approves or rejects the original place through the existing admin RPC.
6. **On original approval**, the new synchronous trigger marks only non-rejected extra gallery rows as approved. Rejection or merge do not publish extras.
7. On other users' devices, the public place detail queries extra rows through RLS and displays a thumbnail strip with the cover in position 1. Missing new schema gracefully falls back to the original single-cover behavior.
8. Place catalogue and cards keep using existing `image_path` for the cover, avoiding changes to heavily tested ranking/list RPCs.

## Security and privacy

- This is a **public upload with explicit permission** workflow, not a private photo draft sharing product.
- **Important:** existing bucket `city-route-place-photos` is public. Even before review, a known direct object URL is technically readable. Database RLS and gallery UI prevent unapproved photos from being *listed* in the public catalogue but do **not** make the blob private. This matches the preexisting cover model. For stricter pre-moderation confidentiality introduce a **private staging bucket + trusted publish/copy process** in a separate design (additional backend complexity). Do not claim private bucket semantics.
- Pending metadata is visible only to its owner and an authorized app admin; public RLS verifies approved status and the canonical published place's `metadata.communitySubmissionId`.
- Rejected extras stay unlisted; cleanup of rejected/storage-orphan blobs requires an authorized server-side lifecycle job to avoid accidental deletion. Explicitly schedule separate cleanup work before scaling.
- Existing place owners and historical one-cover submissions are unaffected.
- The new upload policy has no UPDATE/DELETE or upsert path. Image count limited to slots 2–5, plus the existing cover; 3 MB per JPEG from existing Storage bucket setting.
- No service-role or secret keys in browser and no user_metadata authorization.

## Release sequence — do not change order

1. **Review staged SQL** in `scripts/staged-place-public-gallery-20261105.sql` against current hosted schema and security advisors. Run on an isolated clone/test database and verify all SQL, RLS and RPC behavior; CI's static SQL tests alone are insufficient.
2. Founder approves deploying the additive SQL to **City Route App** Supabase. Apply it once, using controlled migration management (or SQL Editor after reconciliation with manually applied 014–016); capture read-only verification results and correct drift in migration ledger.
3. Verify bucket Storage policy, owner A vs B cross-access, failed rights, exact paths, admin per-image exclusion, rejected place invisible, approved place with 1–5 photos and absence of cross-user access. Test unauthenticated public read.
4. Merge/deploy frontend PR and confirm Cloudflare Worker **serves v59**, in particular updated `place-contributions.js` and gallery runtime on a fresh install/PWA refresh.
5. iPhone 13 Pro + a second signed-out and signed-in device: select 5 photos, reorder and crop, submit, moderate, publish; verify gallery order and stable cover, then try without approval and after rejection.
6. Add Storage orphan cleanup and quota/usage monitoring before wider beta, or switch to private staging if stronger privacy is required.

## Rollback

- Code: revert frontend PR to v58; prior cover-only workflow stays live.
- Schema: **do not drop the table or objects automatically**, as it could orphan moderated photos. Stop new uploads by disabling the *new* gallery INSERT policy/RPC grants, preserve existing cover policy, then migrate/back up entries before cleanup.

## Acceptance checklist

- [ ] Existing published place with only a cover still shows its photo.
- [ ] User A cannot upload/attach photos for user B's pending submission.
- [ ] Anonymous user cannot read pending gallery rows via Data API.
- [ ] Public catalogue does not show submitted extras until approved and moderation status approved.
- [ ] Moderator can exclude photo 3 and approve the place with cover, 2, 4 and 5 only.
- [ ] Switching thumbnail updates full photo and `aria-pressed`.
- [ ] Repeated submit retries only failed positions; Storage path collisions do not create duplicates.
- [ ] Local-only private place never calls the gallery RPC.
- [ ] All pages have no horizontal overflow on 320/375/390px.
- [ ] SQL advisors, Node tests, Cloudflare build, mobile browser smoke and two-account hosted beta pass.
