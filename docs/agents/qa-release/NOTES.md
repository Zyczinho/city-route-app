# QA / Release — notes

Short, dated lessons this role must know on its next run. Newest first. Update in the same PR as the work.

- 2026-11-06 — QA-131: production smoke on main must compare full SHA-256 of built `dist/app.js` against live `/app.js`; a `city-route-vNN` substring is not proof of a fresh deploy. The verifier retries cache-busted URLs and rejects 200/HTML fallbacks, 404 and stale JS. It reports expected vs observed hashes and uses no paid provider or secrets. See `scripts/verify-production-app.mjs`.


- 2026-11-05 — `mobile-smoke` fails intermittently at `.social-detail h1` on the second load of a community route (service worker controlled), passing on rerun. Open: find the cause; it may affect real users.
- 2026-11-05 — PWA cache name now gets a content hash at build time (`scripts/cache-version.mjs`); feature PRs no longer need to bump `city-route-vNN`.
- 2026-11-05 — After merge, verify production by fetching `/service-worker.js` and checking the new cache name before testing.
- 2026-11-05 — `production-smoke.yml` matches the base name (`city-route-vNN`) as a substring of the hashed name; without a base bump it no longer proves a fresh deploy. Follow-up: compare the full built name or a commit marker.
