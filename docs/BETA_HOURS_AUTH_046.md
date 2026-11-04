# BETA-HOURS-AUTH-046 — release scope and Google activation

Status: FRONTEND PROTOTYPE / Google provider **not certified live** until configured and tested by account owner. No schema migrations and no paid API connection. Date of source verification: **2026-11-04**.

## Q1: Verified museum-hour pilot (no paid API)

- New planner inputs: date, start time, museum entrance / exterior-only mode. Date uses selected city's IANA timezone.
- Deterministic generator additionally rejects routes with a known museum closure, missed admission cutoffs, insufficient visit duration, or waiting/travel beyond route time budget. The fallback generator remains unchanged when the optional predicate is not supplied.
- Generated route shows an indicative chronological timeline and cites the institution for hours; unsupported hours stay **"Godziny wymagają sprawdzenia"** and do not masquerade as live status.
- Dates outside 2026 are explicitly **unknown** for editorially curated museum-hour schedules. Only a **single day** is supported; multiple days, ticket slots, holidays beyond the documented exceptions, transport timetable and real opening-hours APIs are still roadmap items. Plan timing is an estimate, not stored/synced with the saved route.
- Museum entrance vs viewing from outside is a simplified global choice for the initial beta. Exterior-only does not promise that a gated park or museum grounds are accessible.
- API calls: 0 for opening hours. No Google Places data requests/billing.

Pilot list (keys are city + place ID, not a global name match):

| City | Place | Official source | Notable limitation |
|---|---|---|---|
| Warsaw | Muzeum Fryderyka Chopina | https://muzeum.nifc.pl/pl/muzeum/wizyta-informacje-miejsce/1_muzeum-fryderyka-chopina-w-warszawie/ | **Closed throughout 2026** during renovation |
| Warsaw | Muzeum Narodowe | https://www.mnw.art.pl/wizyta/ | Closed Mondays; Friday until 20:00; occasional closures require separate confirmation |
| Warsaw | Centrum Nauki Kopernik (Exhibitions) | https://www.kopernik.org.pl/wizyta/godziny-otwarcia | 2026 exceptional closure dates and cashier last-admission bound; **planetarium is a different schedule** |
| Kraków | Muzeum Książąt Czartoryskich | https://mnk.pl/oddzialy/czartoryscy/ | Closed Mondays; entry only with specific date/time ticket; last admission 60min before closing |
| Kraków | Muzeum Lotnictwa Polskiego | https://muzeumlotnictwa.pl/zwiedzanie/ | Seasonal hours; Monday closed; 1 & 11 November 2026 closed; last entry 45min before closing |

All other museums are unknown until manually verified. An unknown status is not confirmation of availability.

## Q2: First-run onboarding + Google OAuth

- A first-load welcome screen introduces **Miejsca**, **Ułóż trasę** and **Społeczność** without sign-in. It is dismissible, shown only once per browser, never intercepts a deep link or OAuth return, and links to actual existing routes. Existing #about remains.
- Existing e-mail/password auth and public guest planning remain.
- Login card offers Google provider via existing Supabase Auth. The button first checks the **public** GoTrue `/auth/v1/settings` status; if Google is disabled, it shows a readable message instead of redirecting to a broken auth page. Credentials are never in the frontend.
- `supabase-client.js` uses OAuth PKCE flow (preserves existing persisted sessions, redirects with a query code rather than a token fragment consumed by the hash router).
- Requires Google Cloud / Supabase account owner to activate the provider. **Do not call it enabled in production before the gate below passes.**

### Owner activation checklist (no code or schema edits)

1. Google Cloud Console → Google Auth Platform → create an **OAuth client (Web application)**. Add site origin `https://city-route-app.jakublojek.workers.dev`. Restrict consent test audience appropriately while beta is small; request only `openid`, email and basic profile.
2. Under authorized **redirect URIs** add the exact Supabase provider callback URL from its provider page (currently expected `https://ycfhpvtsnsmzdmpvliif.supabase.co/auth/v1/callback`; verify the actual Dashboard value).
3. In Supabase Dashboard for project `ycfhpvtsnsmzdmpvliif`, Authentication → Sign In / Providers → Google → enable the provider, paste the **client ID and client secret there only**, never in GitHub or chat.
4. In Supabase Authentication → URL Configuration set Site URL `https://city-route-app.jakublojek.workers.dev` and allow the exact callback target `https://city-route-app.jakublojek.workers.dev/?cityroute_auth=google` (or matching safe redirect allow-list as supported in Dashboard).
5. Confirm `GET /auth/v1/settings` (with publishable apikey header) returns `external.google=true`. Do not claim working login merely because UI renders.
6. On real devices: new Google account → PKCE return → authenticated profile → route creation → logout/login; existing password account → no data lost; verify consent/audience and duplicate-account handling before advertising social sign-in.

**Do not replace existing account storage, remove a user, or apply a hosted database migration for this feature.** No authorization logic reads Google user_metadata as privileged claims.

## Test gate

Run `npm test`, `npm run build`, mobile Chromium smoke (320/375px), and check production Cloudflare Worker asset status. New pure unit tests check exception dates, calendar boundaries, route feasibility, conservative unknown-hour semantics, generator integration, OAuth wiring and first-run UI/PWA precache. Real Google sign-in can only be validated once provider settings are complete.
