# City Route App experience architecture

Warsaw prototype. One current intent per screen, secondary information on demand.

| Intent | Entry | Scope |
| --- | --- | --- |
| Plan a walk | Start → Zaplanuj trasę | preferences → generated plan → basket → route execution |
| Choose food | Start → Zjedz coś | cuisine/search → compact result → description/reviews → route add or official menu |
| Find accommodation | Start → Znajdź nocleg | 10 demo properties → compare numeric sources → external reservation |
| Meet people | Start → Spotkaj ludzi | today's sample walks → local demo join → local demo chat |

Primary navigation: Start, Odkrywaj, Moja trasa, Ludzie. Profile from header. Ready-made walks remain in Explore. Places are a catalogue of destinations; Nieoczywiste are small activities anchored to destinations, with community curation planned. These must never be labeled real community recommendations before submissions exist.

## Disclosure and identity

System font stack: platform system UI, Segoe UI, Roboto, Arial. Brand SVGs for descriptive source identification. Card shows title, essential metadata and visibly marked demo blended score. Source details, missing-source explanations, descriptions and personal review are revealed on demand. No source affiliation claimed.

Local stay profile: resident, visitor, temporary 1–12 months. It provides context without hiding features. Local stats count built routes, reviewed places, recommended routes and completed walks. Per-place personal reviews never modify demo external ratings.

## Demo limits

10 restaurants TOTAL across cuisines, not 10 per cuisine. 10 hotel examples, not a verified best-hotel ranking. Source scores remain illustrative; missing Airbnb/Yelp entries are N/A and excluded from normalized mean. Real property reservation occurs externally. Remaining photo placeholders are explicit. Do not fill missing data by inventing an actual rating or listing.

Social join, connection and chat are device-local simulations. No invitation or message is sent. The community ranking stays empty. These are NOT real-time multi-user features.

## Future shared data boundary

Keep catalog places/routes separate from identity/social records. A later authenticated backend may own profiles, friend requests/accepted connections, route ownership/shares, personal reviews, meetup schedules/participants and message threads. Each record must have an owner, stable ID and access checks. Implement actual consent/acceptance for friendship, participant membership for chat, and moderation before launching real community interaction. Preserve local storage or offer explicit migration. No hidden backend dependency in this prototype.

## Continue

Start from GitHub main, read AGENTS.md and STATUS.md, test app locally. Expand seeded restaurants to ten per cuisine only after sourcing actual named venues. Verify source identity and review availability before replacing DEMO labels. Keep genuine source logos and image provenance. Production is independent Cloudflare Workers with automatic main builds.
