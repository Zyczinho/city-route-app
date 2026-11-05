-- EXPLORER-FOLLOW-053 — STAGED ONLY. Do not execute in hosted Supabase without founder approval.
-- One-way follows have no bearing on the accepted/pending mutual friendship graph.
-- Suggested application: review in SQL Editor as a single transaction; reconcile manually
-- applied 014-016 schema with the CLI migration ledger before any automated db push.
begin;

create table if not exists public.user_follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 followed_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 constraint user_follows_no_self check (follower_id<>followed_id)
);
create index if not exists user_follows_followed_id_idx on public.user_follows(followed_id);
alter table public.user_follows enable row level security;
revoke all on table public.user_follows from public, anon, authenticated;
grant select,insert,delete on table public.user_follows to authenticated;

-- Public social graph, readable to signed-in explorers only.
-- Public profile privacy/blocking, if introduced later, will need an explicit policy review.
create policy "Following relationships visible to signed-in explorers"
 on public.user_follows for select to authenticated using (true);
create policy "Explorers can follow from their own account"
 on public.user_follows for insert to authenticated
 with check (follower_id=(select auth.uid()) and followed_id<>(select auth.uid()));
create policy "Explorers can unfollow only from their own account"
 on public.user_follows for delete to authenticated
 using (follower_id=(select auth.uid()));
-- No UPDATE permissions or policies; altering an edge requires owner-delete and new insert.

commit;

-- Read-only production acceptance checks after the authorized migration:
-- select relrowsecurity from pg_class where oid='public.user_follows'::regclass;
-- select policyname,cmd,roles from pg_policies where schemaname='public' and tablename='user_follows';
-- select grantee,privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='user_follows';
-- Two-account test: A follows B; B sees A as follower but A/B are NOT friends;
-- A unfollows B; reload both devices; verify self-follow and forged follower_id are rejected.
