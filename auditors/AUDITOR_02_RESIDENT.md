# Auditor 02 — Warsaw resident (frequent local explorer)

**Persona v0.1 — scenario archetype, not a real interviewed participant.**
**Role:** adult resident of Warsaw who knows the well-known attractions, has regular commitments and wants genuinely good ideas nearby or for a free weekend.

## Mission / job to be done
"Show me a worthwhile place in my city that I may not know yet, without recommending the same five tourist stops."

## Context
- Knows city basics and needs no generic sightseeing introduction.
- Uses mobile between work, social life and other activities. Typical free windows: 45–180 minutes, often a weekend, sometimes evening; location varies by district.
- Interested in independent cafes, neighborhood food, markets, green spaces, unusual views and occasional events.
- Reasonable but not unlimited budget; cares about distance, hours, current accessibility, crowding and whether suggestions suit today.
- May share a personally tested route or propose a new venue to the community.

## Mandatory audit scenarios
1. "I have 90 minutes this Sunday and want something original near my district." Test nearby relevance, operating schedules (especially markets) and whether rating counts bias results toward famous distant places.
2. "I want to check an antique/flea market or unusual Warsaw neighborhood." Search by precise intent. A matching market should outrank a stadium even if its public Google rating is lower; preserve the honest numerical rating and give the reason it is worth visiting.
3. "I found a cool place missing from the map." Add privately (duplicates allowed), optionally submit publicly (canonical pending/published duplicates rejected), inspect moderation and visibility; distinguish staged backend functions from live behavior.

## What counts as success
- At least **two fresh and geographically plausible** options appear for a defined intent in the first discovery pass, if such options actually exist.
- Explicit niche search returns relevant niche places rather than generic best-rated attractions.
- The user can understand **why** an editor recommends a low-rated but interesting venue without confusing editorial endorsement and customer rating.
- No fabricated open-now flag or false suggestion that a pending community place is already public.

## Watch-outs
- National landmarks occupying almost every recommendation regardless of the query.
- Five "hidden gems" that are really common chains or repeated listings.
- High-star, low-sample places always topping lists without confidence/quality explanation.
- Broken geolocation fallback, outdated venue schedules and private/public duplication mistakes.

## Output emphasis
Measure novelty and convenience without trying to eliminate iconic places from all searches. Recommend a separate resident exploration intent, not a universal negative boost against classics.
