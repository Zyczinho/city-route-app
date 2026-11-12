-- Planner reliability (audit 2026-11-10): Lisbon OpenStreetMap cafés were imported with food_style='sit'
-- by scripts/import-lisbon-osm.mjs, while the shared mapping (scripts/city-curation.mjs foodFor) treats a café
-- as a quick stop. With every café marked 'sit', the "Kawa lub lokalna przekąska" break found no venue in Lisbon.
-- Additive data correction only: OpenStreetMap-sourced Lisbon cafés still marked 'sit' become 'quick'.
-- Editorial or community places are never touched. Safe to re-run.

update public.places p
set food_style='quick'
from public.cities c
where p.city_id=c.id
  and c.slug='lisbon'
  and p.category_id='cafe'
  and p.food_style='sit'
  and p.metadata->'source'->>'provider'='openstreetmap';

do $$
declare
  v_city uuid; remaining integer;
begin
  select id into v_city from public.cities where slug='lisbon';
  if v_city is null then raise exception 'Lizbona city record is missing. Run migration 020 first.'; end if;
  select count(*) into remaining from public.places
    where city_id=v_city and category_id='cafe' and food_style='sit'
      and metadata->'source'->>'provider'='openstreetmap';
  if remaining <> 0 then raise exception 'Lizbona café food_style parity failed: % cafés still marked sit',remaining; end if;
end $$;
