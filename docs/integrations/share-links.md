# Share Links — route previews (Issue #116)

## User purpose

- **Newcomer / Spontaneous Explorer:** a route sent in WhatsApp or Messenger shows a trustworthy title, short description and real cover; the recipient opens it directly without an account.
- **Author:** a public or unlisted community route can be shared without requiring followers or copying private drafts.
- **Editorial:** only existing published catalogue routes are shareable; generated and device-only routes first require publication.

## Permanent URL contract

| Type | Canonical URL | Receiver target |
|---|---|---|
| Community, published public or unlisted | `/r/community/<UUID>` | `/?shareCity=<city>#community-route/<UUID>` |
| Editorial, published public | `/r/editorial/<city>/<slug>` | `/?shareCity=<city>#route/<slug>` |

Fragment-only (`#route/...`) links **cannot** produce crawler-specific previews because browsers do not send hashes to servers. The Worker returns server-rendered Open Graph and Twitter meta tags at `/r/...` and redirects JavaScript-enabled receivers to the existing app screens. No new routing library, database migration or separate application is required.

## Runtime

1. `share-links.js` uses native `navigator.share` when supported. If unavailable or rejected (other than user cancellation), it offers **Copy link** and **WhatsApp**; keyboard focus and status text remain accessible.
2. Social route cards/details and editorial route details show a **Udostępnij** action. A generated/local-only route has no false public URL.
3. `worker.js` delegates only `/r/...` URLs to `share-preview.js`. The latter calls the existing anonymous, RLS-filtered `community_route` or published editorial `catalogue_routes` Supabase RPC. It never takes the title, image URL or authorization status from URL parameters.
4. For a community route, only `published` + `public|unlisted` is eligible. Archived, deleted and unknown IDs return 404 without private metadata. Unlisted previews have `noindex,nofollow` and `private, no-store`.
5. Cover priority: the editorial route's own first-class hero; then a real, exact-stop catalogue photo with an eligible static, public-storage or permitted hosted source. Google photo proxies and other unverified external image hosts are deliberately excluded. If none exists, use the branded City Route logo, **not** another venue's photo.
6. The main app consumes the `shareCity` hint only for existing launch/next cities and a route deep link. The hint is removed from browser history after initial load. This avoids silently sharing an unavailable cross-city route.
7. `service-worker.js` bypasses `/r/` navigations so route preview HTML **cannot overwrite the cached generic `index.html`**. Route links require an online first open; the main PWA retains its existing offline behavior.

## External services, rights and costs

- **Web Share API:** browser-native; no app registration, approval, credential or paid provider usage. Messenger/Instagram appear only when the device OS/browser offers them; there is **no forced Instagram direct-message integration**.
- **WhatsApp:** ordinary `https://wa.me/?text=...` link; no WhatsApp Business API, token or fee.
- **Supabase:** uses only the existing public publishable key and read RPCs. Expect up to 2 RPC calls per uncached preview (route + relevant city places), with public metadata cached for 60s; no new paid API. Infrastructure/network costs depend on existing Supabase and Cloudflare plan and traffic; **zero added per-1,000 third-party API calls**, not zero general hosting cost.
- **Media:** no download, copying or new storage of Google images, public posts or provider photos. Only pre-existing catalogue/approved static references are used; attribution and original display rights continue to apply.
- **Security:** strict path validation, HTML escaping, no arbitrary photo URL from a query string, no private-draft preview, no secrets or RPC with service-role access.

## Verification / release gates

- Automated tests: `node --test tests/share-links.test.js`; include URL/path validation, public editorial/community, unlisted/noindex, deleted/archived 404, 503 on source outage, XSS escaping, real photo vs logo fallback and disallowed Google proxy.
- Run `npm test` and `npm run build` on the PR; ensure new client JS is copied to `dist/` and listed in the offline precache. Do not merge on CI failure.
- Mobile 320/375/390px: Share button shows, 44px touch targets, native sheet or fallback dialog, `Kopiuj link` works, no horizontal overflow.
- Real phones and two browser sessions: user A publishes (public + unlisted); B opens the `/r/community/UUID` link when signed out and sees the exact route and stops; unlisted is absent from the public feed.
- After preview/staging deployment, **paste the production `/r/...` URL into WhatsApp and Messenger**. Validate actual name/photo preview and destination. Bot caches may delay updates; successful HTML tests do not prove live provider unfurl.
- Confirm Google/Tripadvisor image calls are not introduced and no existing route/session state is lost when opening a link.

## Rollback

Revert this PR. Existing `#route` and `#community-route` navigation continues working; no stored data, Supabase schema or credentials change. Previously shared `/r/...` links will then cease to resolve, so keep the feature once public links have spread.
