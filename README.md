# City Route App

1001 CAVE mobile-first Warsaw route discovery and execution MVP. GitHub is the source of truth.

## Run

No runtime dependencies. Run `python3 -m http.server 4180` (Windows: `py -m http.server 4180`) and visit http://localhost:4180. Use HTTP localhost or HTTPS for PWA support, not file://.

## Validate and deploy

`npm test` runs logic/data tests. `npm run build` copies only public app assets into dist/. No install required.

Cloudflare Pages: connect Zyczinho/city-route-app, production branch main, framework None, build command `npm run build`, output `dist`. No environment variables or paid API needed. Alternative matching Vowl: Workers Builds, build `npm run build`, deploy `npx wrangler deploy` (wrangler.jsonc provided). These are alternative deployment paths; do not configure both unless needed.

Read PRODUCT.md, AGENTS.md and STATUS.md before editing. DATA_SOURCES.md lists where every rating and photo comes from. Keep meaningful increments pushed. No backend, auth or payments. Browser-local test data is not synchronized and can be exported as JSON.

## Production

https://city-route-app.jakublojek.workers.dev

Deployed independently on the owner's Cloudflare Workers account, using Workers Builds with build command `npm run build` and deploy command `npx wrangler deploy`. `wrangler.jsonc` serves `dist/`. No ChatGPT Work session is required to keep this deployment available. GitHub remains canonical. Confirm automatic main-branch triggers in Cloudflare build settings; first deployment was manually initiated. The Pages instructions above remain an optional alternative, not the current production path.

## Events endpoint

`worker.js` serves `dist/` and one endpoint, `/api/events` (Ticketmaster Discovery API, cached for an hour). Set the secret `TICKETMASTER_API_KEY` in Cloudflare → Workers → city-route-app → Settings → Variables and Secrets (type: Secret). Optional `TICKETMASTER_AFFILIATE`: an Impact deep-link template containing `{url}`. Without the key the app shows an honest empty state. The static app still works without the Worker.
