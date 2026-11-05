-- 018 — Saved places ("Zapisz") follow the signed-in account across devices.
-- Founder report 2026-11-05: a place saved on the phone was missing on the desktop; saves lived only in
-- one browser's localStorage.
--
-- Run once in the Supabase SQL Editor for the City Route project (single transaction). Before it runs the app
-- keeps the current local-only behaviour.
--
-- `place_ref` is the app's place id (catalogue slug such as `barbican`, or a provider/community id). It is not a
-- foreign key: the catalogue mixes static JSON and hosted rows, and a saved reference must survive re-imports.
-- Private places created on a device (`u-…`) are never sent; their data exists only on that device.

begin;

create table if not exists public.user_saved_places (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  city_slug text not null check (city_slug ~ '^[a-z0-9-]{1,40}$'),
  place_ref text not null check (place_ref ~ '^[A-Za-z0-9_.:-]{1,120}$' and place_ref !~ '^u-'),
  saved_at timestamptz not null default now(),
  primary key (user_id, city_slug, place_ref)
);
create index if not exists user_saved_places_user_idx on public.user_saved_places(user_id, saved_at desc);

alter table public.user_saved_places enable row level security;
revoke all on table public.user_saved_places from public, anon, authenticated;
grant select, insert, delete on table public.user_saved_places to authenticated;

drop policy if exists user_saved_places_select_own on public.user_saved_places;
create policy user_saved_places_select_own on public.user_saved_places
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists user_saved_places_insert_own on public.user_saved_places;
create policy user_saved_places_insert_own on public.user_saved_places
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists user_saved_places_delete_own on public.user_saved_places;
create policy user_saved_places_delete_own on public.user_saved_places
  for delete to authenticated using (user_id = (select auth.uid()));
-- No UPDATE: a save is added or removed, never edited.

commit;
