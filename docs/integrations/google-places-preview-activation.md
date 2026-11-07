# CityRoute — activate Google Places only for PR #151 Preview

Status: **SAFE PREPARATION ONLY**. The repository has no Google API key and cannot read one from Cloudflare. Do NOT enable paid traffic until provider-side quotas are configured.

Target:
- Worker: city-route-app
- Preview name: work-external-integrations-mvp-20261107
- Preview URL: https://work-external-integrations-mvp-20261107-city-route-app.jakublojek.workers.dev
- Source: branch work/external-integrations-mvp-20261107, wrangler.jsonc → previews.vars
- Production (main) must remain unchanged.

## 1. Hard provider-side safety gate BEFORE enabling

Google Cloud Console → select a dedicated small-test Maps Platform project/key, or verify the existing project has room for the tests and no other apps share the quota.

1. Enable only **Places API (New)** for a restricted server-side key. Never publish the key in GitHub, browser JS, an issue, screenshot or chat.
2. Inspect **Google Maps Platform → Quotas** for ALL billable methods/SKUs: Text Search, Place Details Pro (name/location confirmation and ratings) and Place Photos media. Check whether the project exposes a **hard daily cap** for these methods. Some Places New APIs expose only per-minute quotas — these are not equivalent to daily dollar ceilings.
3. If hard daily quotas can be configured across all billable methods, set conservative provider-enforced limits (e.g. 25 requests/method/day or lower) and verify they are effective. Otherwise **keep GOOGLE_PLACES_BETA_ENABLED=off**. Worker counters are per isolate and Cloudflare may run many isolates.
4. Budget alerts notify; they do NOT automatically disable API calls. Existing Google keys shared by other apps may share quotas and cost.
5. Leave Google Autocomplete, text reviews, and Tripadvisor OFF for this test.

## 2. Add the existing key only to this one Preview

Cloudflare Wrangler 4.135.0+ (login to the correct Cloudflare account on your trusted machine):

    npx wrangler@latest preview secret put GOOGLE_PLACES_API_KEY --name work-external-integrations-mvp-20261107 --worker-name city-route-app

The command prompts for the key interactively; never put its value on the command line. It modifies only the named Preview, not Production or Previews Base.

Dashboard alternative: Workers & Pages → city-route-app → select the specific Preview via the breadcrumb → Settings → Variables and Secrets → add Secret GOOGLE_PLACES_API_KEY. Do not select Production, and do not import all Production secrets.

If an existing production secret value is unknown, Cloudflare cannot reveal it as plaintext. Create a separately restricted Places API (New) key in Google Cloud after setting provider-side quotas.

## 3. Activate only after hard quotas are effective

In the branch's wrangler.jsonc → previews.vars, change ONLY GOOGLE_PLACES_BETA_ENABLED from off to on. Keep the rest:

    GOOGLE_PLACES_DAILY_CAP = 5
    GOOGLE_THUMBS_DAILY_CAP = 5
    GOOGLE_PLACES_AUTOCOMPLETE = off
    GOOGLE_PLACES_INCLUDE_REVIEWS = off

The 5 limits are a **per-instance soft brake**, not a shared global hard budget. wrangler.jsonc is authoritative on redeploy, so dashboard-only variable toggles may be overwritten.

Read-only no-charge diagnostic:

    GET https://work-external-integrations-mvp-20261107-city-route-app.jakublojek.workers.dev/api/provider-status

Expect google.photos=ready and google.ratings=ready only when the key is present and the flag is on; otherwise no-key, disabled or quota. This route returns no secret and consumes no Google API credits.

## 4. Measured validation

1. Start with ONE real venue that has Google Photos and ratings; then up to 3–5 venues while monitoring Google Cloud quotas and billing.
2. For a thumbnail, HTTP 302 means redirected photo URI. HTTP 404 with x-thumb-status differentiates no-key, disabled, quota, no-match, no-photo and unavailable.
3. On /api/place-enrichment verify status, providerStatus and real Google rating/reviewCount, with an exact place match. Do not display fake ratings.
4. Validate licensed Commons fallback and attribution. Do not persist Google photo bytes or review texts in Supabase.
5. Compare Google Cloud usage/billing before and after. Do NOT claim $0 until provider-side billing confirms it.

## 5. Shutdown / rollback — Preview only

Fast off: commit GOOGLE_PLACES_BETA_ENABLED=off in the Preview branch, redeploy. Definitive off: revoke/disable the test key in Google Cloud. To delete only this Preview secret:

    npx wrangler@latest preview secret delete GOOGLE_PLACES_API_KEY --name work-external-integrations-mvp-20261107 --worker-name city-route-app

Never run production wrangler secret put/delete for this task.

## Current state

- Safety vars and 5-call soft limits: committed; paid calls OFF.
- Secret attached to PR Preview: **not performed** — no connected Cloudflare administration / secret access.
- Google Cloud hard quotas: **not verified**.
- Google Places paid enrichment on PR Preview: **not active**.
- CI and runtime status diagnostics: available; rerun after the secret and flag are configured.

Official references:
- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing/
