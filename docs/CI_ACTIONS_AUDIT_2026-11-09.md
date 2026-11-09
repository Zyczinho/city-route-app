# GitHub Actions cost audit — 2026-11-09

## Scope and evidence

Repository: `Zyczinho/city-route-app`. This is a snapshot of Actions history at audit time, **not** the complete account billing ledger. Usage warning: account's included 2,000 minutes exhausted; reset on 2026-12-01. No budget or billing settings were changed.

GitHub Actions history from 2026-11-02 to 2026-11-09 included approximately 1,777 runs (history continued changing during audit). Runs, not minutes:

| Workflow | Runs |
| --- | ---: |
| CI | 749 |
| P0 browser smoke | 406 |
| Cloudflare Worker build diagnostic | 280 |
| Provider preview diagnostics | 112 |
| Production rollout verification | 107 |
| All others, including old/removed workflows | 123 |

Five largest recurring workflows: 1,654 / 1,777 = 93% of runs. CI had 186 failed runs; P0 browser smoke had 153 failed runs. A failed run is evidence of a failing check at that commit, not necessarily a broken latest main. The GitHub run timing API may return 0 billable milliseconds; do **not** equate these counts or wall-clock durations with exact billed minutes.

## Current workflow inventory (10 files)

- `ci.yml`: unit tests + build for PRs. Previously repeated after every merge on main.
- `production-smoke.yml`: on main change, build and verify deployed files; now includes `npm test` on the same runner.
- `p0-browser-smoke.yml`: UI/browser regressions, only relevant PR paths; now canceled when superseded and skipped while PR is draft.
- `cloudflare-build-diagnostic.yml`: Worker dry-run on relevant Worker/build configuration changes; pure `index.html` change no longer triggers a separate Worker dry-run; can still be invoked manually.
- `provider-preview-diagnostic.yml`: targeted provider preview checks; skip drafts and superseded PR runs.
- `friends-db.yml`, `reviews-db.yml`, `shared-place-db.yml`: SQL/migration contract tests on their narrow file paths; unchanged.
- `public-gallery-sql.yml`: SQL security tests on PR changes or manual dispatch; removed overlapping branch push trigger.
- `lisbon-osm-import.yml`: limited to one import branch/manual dispatch and writes back generated data. Leave its no-cancel behavior intact to avoid truncating a write operation.

## Savings and quality rules

1. **Consolidate main checks**: previously each main push started both CI and production verification (where both were configured). `npm test` is retained in production verification; no longer launch duplicate main CI runner. This should save roughly one runner job per qualifying main push; exact savings depend on current billing rules.
2. **Cancel superseded PR runs** before completion with workflow-specific concurrency groups. Already completed runs are not refunded.
3. **Draft PRs** still receive fast CI, but defer browser/Worker/provider diagnostics until ready for review. `ready_for_review` is an explicit trigger; later sync commits run normal checks.
4. **Documentation-only main commits** no longer trigger production verification. This is safe for plain Markdown changes because they do not alter the built assets.
5. **Pre-push discipline**: test/build locally, group edits into coherent batches, avoid repeated red PRs caused by half-finished commits.
6. **Keep SQL gates** scoped to migration/security files and preserve production SHA verification.

## Validation after applying PR

- Create/change a draft PR touching `app.js`: CI should run; P0 browser smoke should be skipped.
- Mark that draft ready: P0 should execute on the same PR head.
- Change `worker.js`: Cloudflare diagnostic should run (ready PR).
- Change only `index.html`: build + UI checks should run, but no extra Worker dry-run.
- Merge an application PR: a **single** `Production rollout verification` runner should run build, verify live assets, and run tests on main. No separate CI run should be started for this main push.
- Change only Markdown in main: no production verification run.
- Change public-gallery SQL in an existing PR branch: SQL test should run only for pull_request, not also for push.
- Review in GitHub Actions after sufficient PRs to compare run counts and billed-minute usage.

## Limitations / rollback

These changes do not restore already exhausted Actions minutes and do not modify account spending limits. Required-check / branch-protection settings could not be read through the current GitHub App permissions; verify status requirements before merging if custom branch protection exists. A git revert of this optimization PR restores all previous workflow triggers.
