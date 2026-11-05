-- 017 — Profile photos synced to the account, and profiles viewable by signed-in explorers.
-- Founder report 2026-11-05: profile photo "does not save" on desktop / after login, and friends' profiles
-- cannot be opened or followed.
--
-- Run once in the Supabase SQL Editor for the City Route project (single transaction). The app keeps working
-- before this runs: photos stay local-only and profiles stay author-only, exactly as today.

begin;

-- 1. One avatar per account, at a fixed path the owner controls.
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_own;
alter table public.profiles add constraint profiles_avatar_path_own
  check (avatar_path is null or avatar_path = id::text || '/avatar.jpg');

-- 2. Public bucket (the app reads avatars by public URL), JPEG only, 512 KB max (the app sends ~256 px JPEGs).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('city-route-avatars','city-route-avatars',true,524288,array['image/jpeg'])
on conflict(id) do update set public=true,file_size_limit=524288,allowed_mime_types=array['image/jpeg'];

drop policy if exists city_route_avatar_insert_own on storage.objects;
create policy city_route_avatar_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='city-route-avatars' and name=(select auth.uid())::text||'/avatar.jpg'
);
drop policy if exists city_route_avatar_update_own on storage.objects;
create policy city_route_avatar_update_own on storage.objects for update to authenticated
  using (bucket_id='city-route-avatars' and name=(select auth.uid())::text||'/avatar.jpg')
  with check (bucket_id='city-route-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
drop policy if exists city_route_avatar_delete_own on storage.objects;
create policy city_route_avatar_delete_own on storage.objects for delete to authenticated
  using (bucket_id='city-route-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
-- Upsert needs to read the existing object.
drop policy if exists city_route_avatar_select_own on storage.objects;
create policy city_route_avatar_select_own on storage.objects for select to authenticated
  using (bucket_id='city-route-avatars' and name=(select auth.uid())::text||'/avatar.jpg');

-- 3. Public profile: signed-in explorers can open any profile (they can already read public.profiles under
--    profiles_select_authenticated, so no new data is exposed). Guests still see only authors with a public route.
--    Never e-mail or stay. Return type changes, so drop and recreate, then restore grants.
drop function if exists public.public_profile(uuid);
create function public.public_profile(p_user_id uuid)
returns table(id uuid,nickname text,bio text,instagram text,tiktok text,website text,route_count integer,avatar_path text)
set search_path=''
language sql
stable
security definer
as $$
  select p.id,p.nickname,p.bio,p.instagram,p.tiktok,p.website,
    (select count(*)::int from public.routes r where r.owner_user_id=p.id and r.route_type='community' and r.status='published' and r.visibility='public'),
    p.avatar_path
  from public.profiles p
  where p.id=p_user_id
    and ((select auth.uid()) is not null
      or exists(select 1 from public.routes r where r.owner_user_id=p.id and r.route_type='community' and r.status='published' and r.visibility='public'));
$$;
revoke execute on function public.public_profile(uuid) from public,anon,authenticated;
grant execute on function public.public_profile(uuid) to anon,authenticated;

commit;
