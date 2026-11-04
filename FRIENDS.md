# City Route — Znajomi and unique nicknames

Feature branch: `work/community-friends-026`. **Database migration 015 is NOT applied to production.**

## What works after migration 015
- Community → Znajomi is a fifth in-section tab, never another bottom-navigation item.
- Signed-in explorers search by case-insensitive nickname (minimum 2 characters); results expose only nickname and user UUID.
- Send, accept, decline and remove friend requests; accepted relationships are mutual.
- Friends and pending invitations are visible only to involved users via RLS + checked RPCs.
- Database enforces unique nicknames using a lower(trim) unique index, with signup availability check. The actual unique index handles concurrent signup races.
- Unnamed signups receive a unique `u_<uuid>` nickname; historical case collisions are deterministically renamed, preserving the earliest claimant.
- Guests see a login explanation, not an empty or fabricated friend list.
- No importing personal contact lists, no direct messages, no location disclosure.

## Production release gate
1. Do not merge this PR to main before isolated SQL/CI/browser tests pass.
2. The shared-places draft PR #60 owns pending migration 014. Reconcile DB history and migration ordering before executing 015.
3. Identify City Route Supabase project, back up profiles, inspect any duplicate nicknames, and explicitly approve migration 015.
4. Apply migration in order and verify profile RLS, nickname uniqueness (case/whitespace), auth signup with occupied nick, and account profile sync.
5. Test two real accounts: search by nick → invite → accept → both users see friendship → remove; third user cannot read invitation.
6. Only then merge/deploy UI. Otherwise it will show a clear database-not-ready state.

## Rollout notes
New nickname errors are surfaced in Profile and signup; the hosted database remains the source of truth. The temporary user-facing unavailability screen is deliberate until 015 is deployed. No app permission checks use user-editable auth metadata.
