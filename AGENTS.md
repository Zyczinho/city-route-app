# Agent handoff

GitHub Zyczinho/city-route-app is the sole source of truth. Start by fetching origin, reading PRODUCT.md, STATUS.md, CHANGELOG.md and the current code. Continue the named branch; never recreate the application.

Use short-lived work/* or claude/* branches. One writer per feature. Test coherent changes, update STATUS and CHANGELOG, commit and push immediately. Never force push. Merge tested milestones to main. If interrupted, push a clearly marked checkpoint and exact next steps.

Keep vanilla HTML/CSS/JS, JSON data and localStorage. No paid APIs, backend or framework without a real need. Preserve local state schema or migrate it. Bump the service-worker cache version after cached assets change. Cache only this app's files, do not delete unrelated caches. All assets must live in the repo or have documented provenance. Do not fabricate source ratings or community results.

Test route execution and reload/resume, filtering, basket ordering, generator constraints, event logging, keyboard access and mobile layout. Run npm test and npm run build. Cloudflare deployment must publish dist/, never the repo root. Document deployment status honestly. GitHub contents/tree APIs are acceptable when Git CLI authentication is unavailable; update refs with expected_sha and no force.
