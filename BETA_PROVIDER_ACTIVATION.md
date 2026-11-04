# City Route — 50-user provider API activation gate (2026-11-04)

## Critical contract

**New places are saved locally immediately. Public places require an authenticated account,
submission, and moderator approval before other users see them.** Google/Tripadvisor ratings
and photos are displayed as live ephemeral provider content when available; they are NOT
stored as permanent Supabase blobs or provider review copies.

Code supports Google Places API (New), licensed Tripadvisor Terra, and **Tripadvisor
Content API (self-serve)**. Without configured Cloudflare secrets and explicit feature
flags, paid providers remain OFF. Existing static catalog and local place saves continue.

## Zero-surprise-cost setup for the first 50 testers

1. Google Cloud: create a separate Maps Platform project **CityRoute-Beta** (avoid sharing
quotas with other apps), enable **Places API (New)**, attach billing, create a *server-only*
API key and restrict it to Places API (New). Keep the key only in Cloudflare secret
\`GOOGLE_PLACES_API_KEY\`, never GitHub or the client. Where feasible, restrict the key
further; Worker egress IPs are not fixed, so application IP restrictions need care.
2. Google Cloud > Maps Platform > Quotas (also APIs & Services > Enabled APIs > Places
API New > Quotas): set a **hard daily request quota of 25/day or lower** for every
billable method used; verify the appropriate *billable request* limits and service SKUs
in your actual project. Monthly Enterprise free usage is 1,000 **per SKU**; 25 ×
31 = 775 as a safe illustrative upper bound **per method**, assuming one billing
event per request. Verify all other usage before assuming $0. Set cloud budget alerts,
but note **budget alerts do not stop API traffic**. Google daily quota is the real
provider-side backstop. Do not enable costly reviews/Autocomplete initially.
3. Tripadvisor: prefer self-service **Content API** for small beta if new sign-ups are
still available (provider is migrating to Terra). Tripadvisor advertises first
5,000 API calls/month free after account + payment card registration and selecting
maximum daily budget. Set the **lowest allowed daily budget/call limit**, and stop
before provider-confirmed free volume; actual budget limits depend on account plan.
Store key in Cloudflare secret \`TRIPADVISOR_CONTENT_API_KEY\`.
4. Cloudflare Dashboard > Workers & Pages > **city-route-app** > Settings >
Variables and Secrets:
  - Secret \`GOOGLE_PLACES_API_KEY\` = your Google server API key
  - Plain text \`GOOGLE_PLACES_BETA_ENABLED\` = \`on\` (only after quotas)
  - Plain text \`GOOGLE_PLACES_DAILY_CAP\` = \`25\` (per-isolate safety net, NOT global hard cap)
  - Secret \`TRIPADVISOR_CONTENT_API_KEY\` = Content API partner key
  - Plain text \`TRIPADVISOR_CONTENT_BETA_ENABLED\` = \`on\` (only after daily budget)
  - Plain text \`TRIPADVISOR_CONTENT_DAILY_CAP\` = \`50\` (per-isolate safety net, NOT global)
  - Leave \`GOOGLE_PLACES_AUTOCOMPLETE\` **off**.
  - Leave \`GOOGLE_PLACES_INCLUDE_REVIEWS\`, \`TRIPADVISOR_CONTENT_INCLUDE_REVIEWS\`,
  and \`TRIPADVISOR_TERRA_INCLUDE_REVIEWS\` **off** until provider review licensing
  and cost are checked. Terra key is unnecessary for Content API mode.

**Do not claim a guaranteed zero-dollar bill.** Real provider request quotas and
third-party terms take precedence over Worker in-memory counters; a separate worker
instance starts with a new in-memory budget.

## End-to-end Julian test

- Julian opens City Route, creates account and logs in.
- Miejsca > Dodaj własne miejsce > enters exact name of existing restaurant (e.g.
  a Warsaw noodles restaurant), chooses its location and selects "Zaproponuj społeczności".
- On save, confirm **Zapisane** contains the local place, thumbnail automatically
  comes from Google/Tripadvisor with attribution when API match exists, Google and
  Tripadvisor show official numeric rating and number of opinions, and violet
  City Route rating remains separate. If no match, explicitly show no external rating.
- Moderator signs in and approves the submitted place; verify a **second account**
  can now see it in Miejsca. Before approval, the second account should NOT see it.
- Check the Cloudflare logs (key/ratelimit errors) and Google Billing + Quotas and
  Tripadvisor dashboard metrics for total request count.
- Confirm same-place match: unrelated nearby restaurant must not receive the rating.
- Cross-device bookmarks are still local-only. Public approval is not an instant
  publish action.

## Trusted references

Google: https://developers.google.com/maps/billing-and-pricing/manage-costs
https://developers.google.com/maps/billing-and-pricing/pricing

Tripadvisor self-serve: https://www.tripadvisor.com/business/solutions/hotels/content-api
https://tripadvisor-content-api.readme.io/reference/searchforlocations
https://tripadvisor-content-api.readme.io/reference/getlocationdetails
https://tripadvisor-content-api.readme.io/reference/getlocationphotos

Terra is a different partner entitlement: https://docs.terra.tripadvisor.com/docs/overview
