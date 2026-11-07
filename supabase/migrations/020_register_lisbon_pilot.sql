-- 020: Activate Lisbon as a City Route limited pilot (#146).
-- Additive and re-runnable. Does not modify Warsaw, Krakow or existing user content.
-- Run on hosted Supabase ONLY after PR review and merge, with founder release approval.
-- PostGIS uses longitude first, then latitude.
insert into public.cities(
  slug,name,country,country_code,locale,currency,timezone,center,default_zoom,radius_km,status
) values (
  'lisbon','Lizbona','Portugalia','PT','pt-PT','EUR','Europe/Lisbon',
  extensions.st_point(-9.1393,38.7223)::extensions.geography,
  12,25,'next'
)
on conflict (slug) do nothing;
