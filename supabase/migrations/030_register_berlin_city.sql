-- 030: Register Berlin in the hosted city registry so account features (saved and published routes) accept it.
-- Additive and re-runnable. Places and editorial routes ship as files (data/cities/berlin) until seeded here.
-- PostGIS uses longitude first, then latitude.
insert into public.cities(
  slug,name,country,country_code,locale,currency,timezone,center,default_zoom,radius_km,status
) values (
  'berlin','Berlin','Niemcy','DE','de-DE','EUR','Europe/Berlin',
  extensions.st_point(13.4050,52.5200)::extensions.geography,
  12,25,'next'
)
on conflict (slug) do nothing;
