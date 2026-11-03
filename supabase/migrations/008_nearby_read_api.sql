-- Stable nearby read API for City Route map/runtime clients.
-- Keeps internal UUIDs hidden and returns the same public place IDs used by catalogue_places().

create or replace function public.catalogue_nearby_places(
  p_city_slug text,
  p_lat double precision,
  p_long double precision,
  p_radius_m integer default 500,
  p_max_results integer default 50,
  p_category_ids text[] default null
)
returns table(
  id text,
  name text,
  category_id text,
  area text,
  description text,
  is_top boolean,
  image_url text,
  lat double precision,
  lng double precision,
  dist_meters double precision,
  tags jsonb
)
set search_path=''
language sql
stable
as $$
  select
    coalesce(p.legacy_id,p.slug) as id,
    p.name,
    p.category_id,
    p.area,
    p.description,
    p.is_top,
    p.image_url,
    extensions.st_y(p.location::extensions.geometry) as lat,
    extensions.st_x(p.location::extensions.geometry) as lng,
    extensions.st_distance(
      p.location,
      extensions.st_point(p_long,p_lat)::extensions.geography
    ) as dist_meters,
    coalesce((
      select jsonb_agg(pt.tag order by pt.tag)
      from public.place_tags pt
      where pt.place_id=p.id
    ),'[]'::jsonb) as tags
  from public.places p
  join public.cities c on c.id=p.city_id
  where c.slug=p_city_slug
    and p.status='published'
    and p.visibility='public'
    and (
      p_category_ids is null
      or cardinality(p_category_ids)=0
      or p.category_id=any(p_category_ids)
    )
    and extensions.st_dwithin(
      p.location,
      extensions.st_point(p_long,p_lat)::extensions.geography,
      least(greatest(p_radius_m,50),20000)
    )
  order by p.location operator(extensions.<->) extensions.st_point(p_long,p_lat)::extensions.geography
  limit least(greatest(p_max_results,1),200);
$$;

grant execute on function public.catalogue_nearby_places(text,double precision,double precision,integer,integer,text[]) to anon,authenticated;
