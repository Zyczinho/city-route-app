# City Route — katalog, zdjęcia i wydarzenia: MVP product contract
Updated: 2026-11-04

## Verified as of 2026-11-04
- Warsaw catalogue contains 50 published records in hosted Supabase (40 discoverable places, 10 stays); 225 other records belong to Krakow, of which 17 were archived.
- Warsaw nightlife category had no published items in the live audited catalog. Four location-sourced additions were staged in `scripts/seed-warsaw-nightlife-20261104.sql` in PR #78, but **not yet applied**.
- Event discovery exists at `#events` in Places/Discover; Ticketmaster adapter requires `TICKETMASTER_API_KEY`, which is not proven configured.
- Social events UI is placeholder only. Supabase has **no** community events or event RSVP/reactions tables.
- Group routes, profiles, messages and user-submitted places exist; reuse existing auth, city membership and moderation concepts, without claiming scheduled events work.

## Three product pillars, ranked by beta urgency
1. **Catalogue breadth:** Continuously import or curate verifiable places with deduplication and moderation. Prioritize Warsaw nightlife, museums and restaurants, then expand cities. Keep source provenance and don't invent ratings; treat geographic precision honestly. Fix staging/production parity, keep a per-category freshness report and prevent duplicate slugs or coordinates.
2. **Real photographs for each place:** Prefer user-contributed photos with explicit rights; exact venue-owned images with permission/valid reusable terms; Creative Commons (correct license/credit); and authorized on-demand provider photos. Choose the highest visually useful candidate by width, height, aspect ratio and identity. No random stock substitutions, external social feed scraping, permanent provider caching against terms or copy-from-Instagram just because it is public. Track `photo_status` (missing/candidate/rights-verified/live), provenance and image-load failures. Instagram/Facebook/official-site links are **evidence**, not photo licenses.
3. **Social events + live walks:** Deliver real member-authored activities, with counts and participation before widening beyond private beta.

## Community events MVP functional requirements (not implemented)
- A user with an active account creates a **walk / meetup / music or party event / other activity**: title, city, description, category, start, end, optional meeting place chosen from catalogue, optional route, optional group, attendance limit. Event is `pending` until validated, `published`, `cancelled` or `completed`; cancelled/expired cannot receive new RSVP.
- Five surface states: event list by city/date/category, event detail with source/organizer, new-event form, organizer dashboard, admin moderation/reporting. Events must be visible from the Community hub and Events/Places switch without adding a sixth narrow tab.
- **Independent authentic counts:** `interested`, `going` (one exclusive RSVP state per user/event; changed and withdrawn at any time); `likes` (unique per user/event); and `recommendations` (unique per user/event). Don't fake visitor totals, conflate interested with attending, or display numbers absent from server. Optional future attendance check-in is separate from RSVP.
- **Walk now**: an event can link to a published route and be manually marked `live` by organizer, later `completed`. Meeting point and time are clear; public live location tracking is **not** required for MVP. Participants may voluntarily open the route. No silent geolocation, no implication that live tracking exists.
- Organizer can update/cancel; cancelled event is read-only, participants are informed in-app. Only organizer/admin can edit; only authenticated users can RSVP/react; public users can read published events. Report/flag and admin unpublish supported.
- The app's current Ticketmaster 'Globalne' feed remains distinct: **do not** let community users impersonate third-party events or write unverified ticketing availability.

## Suggested backend shape (only after review, separate forward-only migration)
`community_events`: uuid PK, city_id FK, organizer_id FK, category, title, description, status, starts_at, ends_at, location point or place_id FK, route_id optional, group_id optional, capacity, updated_at. Validate Warsaw/local timezone presentation and dates; RLS public published read, owner draft/approved edits, admin moderation.
`community_event_rsvps`: (event_id,user_id) unique PK, status enum interested/going, timestamps. Unique events prevent inflated counts; attendance cap should count only going.
`community_event_reactions`: (event_id,user_id,kind) unique PK with `kind in ('like','recommend')`; revocable, no anonymous reactions.
`community_event_reports`: UUID, reporter, reason, admin review status.
Expose narrow read-only aggregate RPC or view with four counts and optional current-user state; verify authorization and RLS with PGlite/integration tests before hosted activation.
**Do not** mutate legacy manual SQL migrations or infer that migration ledger has been reconciled.

## Required acceptance test with two actual accounts
A creates a walk in Warsaw → moderation/publish → B discovers the same event from Community/Events → B marks Interested (count +1) → changes to Going (interested -1, going +1) → likes and recommends (two unique counters) → repeats actions (never double-counts) → cancels reactions (decrement) → A starts a linked route walk → status Live → organizer ends/cancels → B cannot newly join; forbidden edits/other-user reads rejected.
Repeat on a 320px phone, check no horizontal overflow, timezone, RSVP buttons, and a full refreshing/back navigation.
Tests that depend on provider keys or real users must be explicitly marked unverified until exercised.

## Release gates
- Source-backed Warsaw place additions verified, imported via reviewed forward-only script; count category records before/after.
- Every place has an explicit photo status. Increase legitimate photo coverage without guessing or invented image rights.
- Events schema + RLS + UI and 2-account end-to-end approval must pass before "Community events live" can be claimed.
- Communicate clearly to founder: present visibility of Events is not equivalent to a working RSVP/social-event backend.
