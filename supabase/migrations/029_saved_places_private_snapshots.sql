-- 029 — Let a signed-in account keep a private place's minimal display data
-- next to its saved bookmark. Existing catalogue rows are left unchanged.
-- Photo data URLs remain device-local; no changes to user ownership policies.
begin;
alter table public.user_saved_places
  add column if not exists place_snapshot jsonb;
alter table public.user_saved_places
  drop constraint if exists user_saved_places_place_ref_check;
alter table public.user_saved_places
  add constraint user_saved_places_place_ref_check
  check (
    place_ref ~ '^[A-Za-z0-9_.:-]{1,120}$'
    and (place_ref !~ '^u-' or place_snapshot is not null)
  );
alter table public.user_saved_places
  add constraint user_saved_places_snapshot_check
  check (
    place_snapshot is null or (
      jsonb_typeof(place_snapshot)='object'
      and place_snapshot->>'id'=place_ref
      and place_snapshot->>'cityId'=city_slug
      and octet_length(place_snapshot::text)<=16384
    )
  );
-- Existing RLS SELECT/INSERT/DELETE policies continue to enforce auth.uid() = user_id.
notify pgrst, 'reload schema';
commit;
