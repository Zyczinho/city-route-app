-- Stable read layer for City Route clients.
-- Keeps PostGIS/UUID storage details behind small city-scoped RPCs.

create or replace function public.catalogue_places(city_slug text)
returns table(
  id text,
  name text,
  lat double precision,
  lng double precision,
  category_id text,
  area text,
  description text,
  minutes integer,
  cost_minor integer,
  currency text,
  tourist_level text,
  food_style text,
  partner boolean,
  is_top boolean,
  image_url text,
  image_meta jsonb,
  metadata jsonb,
  tags jsonb,
  ratings jsonb
)
set search_path = ''
language sql
stable
as $$
  select
    coalesce(p.legacy_id,p.slug) as id,
    p.name,
    extensions.st_y(p.location::extensions.geometry) as lat,
    extensions.st_x(p.location::extensions.geometry) as lng,
    p.category_id,
    p.area,
    p.description,
    p.minutes,
    p.cost_minor,
    p.currency,
    p.tourist_level,
    p.food_style,
    p.partner,
    p.is_top,
    p.image_url,
    p.image_meta,
    p.metadata,
    coalesce((
      select jsonb_agg(pt.tag order by pt.tag)
      from public.place_tags pt
      where pt.place_id=p.id
    ),'[]'::jsonb) as tags,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source',ps.source,
          'value',ps.rating,
          'max',ps.rating_max,
          'reviewCount',ps.review_count,
          'listing',ps.listing,
          'url',ps.url,
          'checked',case when ps.checked_at is null then null else to_char(ps.checked_at,'YYYY-MM-DD') end,
          'method',ps.metadata->>'method',
          'reason',ps.metadata->>'reason'
        ) order by ps.source
      )
      from public.place_sources ps
      where ps.place_id=p.id
    ),'[]'::jsonb) as ratings
  from public.places p
  join public.cities c on c.id=p.city_id
  where c.slug=city_slug
    and p.status='published'
    and p.visibility='public'
  order by p.is_top desc,p.name;
$$;

create or replace function public.catalogue_routes(city_slug text)
returns table(
  id text,
  name text,
  description text,
  transport text,
  metadata jsonb,
  tags jsonb,
  stops jsonb
)
set search_path = ''
language sql
stable
as $$
  select
    coalesce(r.legacy_id,r.slug,r.id::text) as id,
    r.name,
    r.description,
    r.transport,
    r.metadata,
    coalesce((
      select jsonb_agg(rt.tag order by rt.tag)
      from public.route_tags rt
      where rt.route_id=r.id
    ),'[]'::jsonb) as tags,
    coalesce((
      select jsonb_agg(coalesce(p.legacy_id,p.slug) order by rs.position)
      from public.route_stops rs
      join public.places p on p.id=rs.place_id
      where rs.route_id=r.id
    ),'[]'::jsonb) as stops
  from public.routes r
  join public.cities c on c.id=r.city_id
  where c.slug=city_slug
    and r.status='published'
    and r.visibility='public'
  order by r.created_at,r.name;
$$;

grant execute on function public.catalogue_places(text) to anon,authenticated;
grant execute on function public.catalogue_routes(text) to anon,authenticated;
