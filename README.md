# City Route App

1001 CAVE mobile-first Warsaw route discovery and execution MVP. GitHub is the source of truth.

## Run

No runtime dependencies. Run `python3 -m http.server 4180` (Windows: `py -m http.server 4180`) and visit http://localhost:4180. Use HTTP localhost or HTTPS for PWA support, not file://.

## Validate and deploy

`npm test` runs logic/data tests. `npm run build` copies only public app assets into dist/. No install required.

Cloudflare Pages: connect Zyczinho/city-route-app, production branch main, framework None, build command `npm run build`, output `dist`. No environment variables or paid API needed. Alternative matching Vowl: Workers Builds, build `npm run build`, deploy `npx wrangler deploy` (wrangler.jsonc provided). These are alternative deployment paths; do not configure both unless needed.

Read PRODUCT.md, AGENTS.md and STATUS.md before editing. Keep meaningful increments pushed. No backend, auth or payments. Browser-local test data is not synchronized and can be exported as JSON.
