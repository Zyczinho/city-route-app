-- 025: VAPID Web Push subscriptions. Credentials live in encrypted Supabase Vault, NEVER in Git.
-- Only the subscription owner can read/write their endpoint; Edge service-role sends notifications.
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 30 and 2048 and endpoint like 'https://%'),
 p256dh text not null check(length(p256dh) between 30 and 200),
 auth text not null check(length(auth) between 10 and 200),
 created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,insert,delete on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_owner_read on public.push_subscriptions;
create policy push_subscriptions_owner_read on public.push_subscriptions
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists push_subscriptions_owner_insert on public.push_subscriptions;
create policy push_subscriptions_owner_insert on public.push_subscriptions
 for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists push_subscriptions_owner_delete on public.push_subscriptions;
create policy push_subscriptions_owner_delete on public.push_subscriptions
 for delete to authenticated using (user_id=(select auth.uid()));

alter table public.activity_notifications
 add column if not exists push_dispatched_at timestamptz;

-- Public VAPID key is intentionally readable to signed-in browsers.
-- No private credentials can be returned by this function.
create or replace function public.get_push_vapid_public_key()
returns text language sql stable security definer set search_path=''
as $$
 select decrypted_secret from vault.decrypted_secrets
 where name='city_route_vapid_public_v1' limit 1
$$;
revoke all on function public.get_push_vapid_public_key() from public,anon,authenticated;
grant execute on function public.get_push_vapid_public_key() to authenticated;

-- This function can ONLY be invoked by the service role in the server-side Edge Function.
-- It returns encrypted-vault contents after decryption. No public/anonymous execute grants.
create or replace function public.get_push_server_credentials()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'vapid_public',(select decrypted_secret from vault.decrypted_secrets where name='city_route_vapid_public_v1' limit 1),
  'vapid_private',(select decrypted_secret from vault.decrypted_secrets where name='city_route_vapid_private_v1' limit 1),
  'hook_secret',(select decrypted_secret from vault.decrypted_secrets where name='city_route_push_hook_v1' limit 1)
 )
$$;
revoke all on function public.get_push_server_credentials() from public,anon,authenticated;
grant execute on function public.get_push_server_credentials() to service_role;
