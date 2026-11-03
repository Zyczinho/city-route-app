-- 011 Social routes data layer (SOCIAL_ROUTES.md, SOCIAL-DATA-003). Forward-only and safe to re-run.
-- Adds publish/fork columns, saves and ratings with owner-only RLS, one read model for community route cards,
-- definer read RPCs (author nickname without opening profiles), invoker write RPCs (RLS still applies),
-- and narrows catalogue_routes to editorial routes so community routes never appear as editorial.

-- 1. Routes: publish time and fork provenance --------------------------------------------------------------
alter table public.routes add column if not exists published_at timestamptz;
alter table public.routes add column if not exists forked_from_route_id uuid references public.routes(id) on delete set null;

create index if not exists routes_community_feed_idx on public.routes(city_id,published_at desc)
  where route_type='community' and status='published';
create index if not exists routes_forked_from_idx on public.routes(forked_from_route_id) where forked_from_route_id is not null;

-- 2. Saves and ratings ----------------------------------------------------------------------------------------
create table if not exists public.route_saves (
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(route_id,user_id)
);
create index if not exists route_saves_user_idx on public.route_saves(user_id,created_at desc);

create table if not exists public.route_ratings (
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(route_id,user_id)
);
create index if not exists route_ratings_user_idx on public.route_ratings(user_id);

drop trigger if exists route_ratings_set_updated_at on public.route_ratings;
create trigger route_ratings_set_updated_at before update on public.route_ratings
for each row execute function public.set_updated_at();

alter table public.route_saves enable row level security;
alter table public.route_ratings enable row level security;
revoke all on public.route_saves,public.route_ratings from anon;
grant select,insert,delete on public.route_saves to authenticated;
grant select,insert,update,delete on public.route_ratings to authenticated;

-- Only your own rows; only published public routes; never your own route for ratings.
-- Aggregates for everyone else come from the definer read RPCs below, so savers/raters stay private.
drop policy if exists route_saves_select_own on public.route_saves;
create policy route_saves_select_own on public.route_saves for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists route_saves_insert_own on public.route_saves;
create policy route_saves_insert_own on public.route_saves for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.routes r where r.id=route_id and r.status='published' and r.visibility='public')
);
drop policy if exists route_saves_delete_own on public.route_saves;
create policy route_saves_delete_own on public.route_saves for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists route_ratings_select_own on public.route_ratings;
create policy route_ratings_select_own on public.route_ratings for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists route_ratings_insert_own on public.route_ratings;
create policy route_ratings_insert_own on public.route_ratings for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.routes r where r.id=route_id and r.status='published' and r.visibility='public'
             and r.owner_user_id is distinct from (select auth.uid()))
);
drop policy if exists route_ratings_update_own on public.route_ratings;
create policy route_ratings_update_own on public.route_ratings for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.routes r where r.id=route_id and r.status='published' and r.visibility='public'
             and r.owner_user_id is distinct from (select auth.uid()))
);
drop policy if exists route_ratings_delete_own on public.route_ratings;
create policy route_ratings_delete_own on public.route_ratings for delete to authenticated using (user_id=(select auth.uid()));

-- 3. Editorial catalogue stays editorial (same signature as 005) ---------------------------------------------
create or replace function public.catalogue_routes(city_slug text)
returns table(id text,name text,description text,transport text,metadata jsonb,tags jsonb,stops jsonb)
set search_path=''
language sql
stable
as $$
  select
    coalesce(r.legacy_id,r.slug,r.id::text) as id,
    r.name,
    r.description,
    r.transport,
    r.metadata,
    coalesce((select jsonb_agg(rt.tag order by rt.tag) from public.route_tags rt where rt.route_id=r.id),'[]'::jsonb) as tags,
    coalesce((select jsonb_agg(coalesce(p.legacy_id,p.slug) order by rs.position)
              from public.route_stops rs join public.places p on p.id=rs.place_id where rs.route_id=r.id),'[]'::jsonb) as stops
  from public.routes r
  join public.cities c on c.id=r.city_id
  where c.slug=city_slug
    and r.route_type='editorial'
    and r.status='published'
    and r.visibility='public'
  order by r.created_at,r.name;
$$;
grant execute on function public.catalogue_routes(text) to anon,authenticated;

-- 4. Read model: one row per community route with author nickname and aggregates (no client N+1) -------------
-- Not granted to anon/authenticated: it runs with the owner's rights, so only the filtered RPCs below expose it.
-- popular_score (documented in SOCIAL_ROUTES_DATA.md):
--   saves_30d*3 + forks_30d*2 + ratings_30d*2
--   + rating bonus: (rating_avg-3)*2 once rating_count>=2, else 0   (range -4..+4)
--   + recency bonus: 3 for a route published now, falling linearly to 0 after 21 days
create or replace view public.community_route_cards as
select
  r.id,
  c.slug as city_slug,
  r.name,
  r.description,
  r.transport,
  r.visibility,
  r.status,
  r.owner_user_id as author_id,
  coalesce(pr.nickname,'Odkrywca') as author_nickname,
  r.published_at,
  r.created_at,
  r.forked_from_route_id as forked_from_id,
  src.name as forked_from_name,
  st.stops,
  st.stop_count,
  tg.tags,
  sv.save_count,
  sv.saves_30d,
  rt.rating_count,
  rt.rating_avg,
  rt.ratings_30d,
  fk.fork_count,
  fk.forks_30d,
  round((
    sv.saves_30d*3 + fk.forks_30d*2 + rt.ratings_30d*2
    + case when rt.rating_count>=2 then (rt.rating_avg-3)*2 else 0 end
    + greatest(0,3-extract(epoch from (now()-coalesce(r.published_at,r.created_at)))/604800.0)
  )::numeric,3) as popular_score
from public.routes r
join public.cities c on c.id=r.city_id
left join public.profiles pr on pr.id=r.owner_user_id
left join public.routes src on src.id=r.forked_from_route_id and src.status='published' and src.visibility in ('public','unlisted')
cross join lateral (
  select coalesce(jsonb_agg(coalesce(p.legacy_id,p.slug) order by rs.position),'[]'::jsonb) as stops,count(*)::int as stop_count
  from public.route_stops rs join public.places p on p.id=rs.place_id where rs.route_id=r.id
) st
cross join lateral (select coalesce(jsonb_agg(t.tag order by t.tag),'[]'::jsonb) as tags from public.route_tags t where t.route_id=r.id) tg
cross join lateral (
  select count(*)::int as save_count,count(*) filter (where s.created_at>now()-interval '30 days')::int as saves_30d
  from public.route_saves s where s.route_id=r.id
) sv
cross join lateral (
  select count(*)::int as rating_count,round(avg(x.rating)::numeric,2) as rating_avg,
         count(*) filter (where x.updated_at>now()-interval '30 days')::int as ratings_30d
  from public.route_ratings x where x.route_id=r.id
) rt
cross join lateral (
  select count(*)::int as fork_count,count(*) filter (where f.published_at>now()-interval '30 days')::int as forks_30d
  from public.routes f where f.forked_from_route_id=r.id and f.status='published' and f.visibility in ('public','unlisted')
) fk
where r.route_type='community';

revoke all on public.community_route_cards from public,anon,authenticated;

-- 5. Read RPCs (definer: needed for author nickname/aggregates; every one filters visibility itself) ---------
create or replace function public.community_routes(p_city_slug text,p_sort text default 'popular',p_limit integer default 20,p_offset integer default 0)
returns setof public.community_route_cards
set search_path=''
language sql
stable
security definer
as $$
  select * from public.community_route_cards c
  where c.city_slug=p_city_slug and c.status='published' and c.visibility='public'
  order by
    case when p_sort='newest' then extract(epoch from coalesce(c.published_at,c.created_at))
         when p_sort='top' then case when c.rating_count>=2 then c.rating_avg else 0 end
         else c.popular_score end desc,
    case when p_sort='top' then c.rating_count else c.save_count end desc,
    coalesce(c.published_at,c.created_at) desc,
    c.id
  limit least(greatest(coalesce(p_limit,20),1),50)
  offset greatest(coalesce(p_offset,0),0);
$$;

-- Direct link: published public or unlisted; the owner also sees their own archived routes.
create or replace function public.community_route(p_route_id uuid)
returns setof public.community_route_cards
set search_path=''
language sql
stable
security definer
as $$
  select * from public.community_route_cards c
  where c.id=p_route_id
    and ((c.status='published' and c.visibility in ('public','unlisted')) or c.author_id=(select auth.uid()));
$$;

create or replace function public.author_routes(p_user_id uuid,p_city_slug text default null)
returns setof public.community_route_cards
set search_path=''
language sql
stable
security definer
as $$
  select * from public.community_route_cards c
  where c.author_id=p_user_id and c.status='published' and c.visibility='public'
    and (p_city_slug is null or c.city_slug=p_city_slug)
  order by coalesce(c.published_at,c.created_at) desc,c.id;
$$;

-- Public profile only for authors with at least one public route (or yourself). Never e-mail or stay.
create or replace function public.public_profile(p_user_id uuid)
returns table(id uuid,nickname text,bio text,instagram text,tiktok text,website text,route_count integer)
set search_path=''
language sql
stable
security definer
as $$
  select p.id,p.nickname,p.bio,p.instagram,p.tiktok,p.website,
    (select count(*)::int from public.routes r where r.owner_user_id=p.id and r.route_type='community' and r.status='published' and r.visibility='public')
  from public.profiles p
  where p.id=p_user_id
    and (p.id=(select auth.uid()) or exists(select 1 from public.routes r where r.owner_user_id=p.id and r.route_type='community' and r.status='published' and r.visibility='public'));
$$;

-- Your saves across cities, editorial and community, newest first; community rows carry their card.
create or replace function public.saved_routes()
returns table(route_id uuid,route_type text,city_slug text,public_id text,name text,saved_at timestamptz,card jsonb)
set search_path=''
language sql
stable
security definer
as $$
  select r.id,r.route_type,ci.slug,coalesce(r.legacy_id,r.slug,r.id::text),r.name,s.created_at,
    case when r.route_type='community' then (select to_jsonb(c) from public.community_route_cards c where c.id=r.id) end
  from public.route_saves s
  join public.routes r on r.id=s.route_id
  join public.cities ci on ci.id=r.city_id
  where s.user_id=(select auth.uid()) and r.status='published' and r.visibility in ('public','unlisted')
  order by s.created_at desc;
$$;

-- 6. Route references: editorial routes are known to clients by slug, community routes by uuid --------------
create or replace function public.route_ref(p_city_slug text,p_ref text)
returns uuid
set search_path=''
language sql
stable
as $$
  select r.id from public.routes r join public.cities c on c.id=r.city_id
  where case when p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then r.id=p_ref::uuid
             else c.slug=p_city_slug and r.route_type='editorial' and coalesce(r.legacy_id,r.slug)=p_ref end
  limit 1;
$$;

-- Your saved/rated state for many routes at once (feed buttons without N+1). Invoker: RLS shows only your rows.
create or replace function public.my_route_marks(p_route_ids uuid[])
returns table(route_id uuid,saved boolean,my_rating smallint)
set search_path=''
language sql
stable
as $$
  select ids.id,
    exists(select 1 from public.route_saves s where s.route_id=ids.id and s.user_id=(select auth.uid())),
    (select x.rating from public.route_ratings x where x.route_id=ids.id and x.user_id=(select auth.uid()))
  from unnest(coalesce(p_route_ids,'{}'::uuid[])) as ids(id);
$$;

-- 7. Write RPCs: security invoker, so the table RLS above and in 003 decides what each user may change -------
create or replace function public.save_route(p_city_slug text,p_ref text)
returns uuid set search_path='' language plpgsql volatile as $$
declare v_route uuid:=public.route_ref(p_city_slug,p_ref);
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  if v_route is null then raise exception 'route-not-found' using errcode='P0002'; end if;
  insert into public.route_saves(route_id,user_id) values(v_route,(select auth.uid())) on conflict do nothing;
  return v_route;
end $$;

create or replace function public.unsave_route(p_city_slug text,p_ref text)
returns uuid set search_path='' language plpgsql volatile as $$
declare v_route uuid:=public.route_ref(p_city_slug,p_ref);
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  delete from public.route_saves where route_id=v_route and user_id=(select auth.uid());
  return v_route;
end $$;

create or replace function public.rate_route(p_city_slug text,p_ref text,p_rating integer)
returns uuid set search_path='' language plpgsql volatile as $$
declare v_route uuid:=public.route_ref(p_city_slug,p_ref);
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  if v_route is null then raise exception 'route-not-found' using errcode='P0002'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid-rating' using errcode='22023'; end if;
  insert into public.route_ratings(route_id,user_id,rating) values(v_route,(select auth.uid()),p_rating)
  on conflict(route_id,user_id) do update set rating=excluded.rating;
  return v_route;
end $$;

create or replace function public.remove_rating(p_city_slug text,p_ref text)
returns uuid set search_path='' language plpgsql volatile as $$
declare v_route uuid:=public.route_ref(p_city_slug,p_ref);
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  delete from public.route_ratings where route_id=v_route and user_id=(select auth.uid());
  return v_route;
end $$;

-- Atomic publish or edit: route, ordered stops and tags in one transaction, validated server-side.
create or replace function public.publish_community_route(
  p_city_slug text,p_name text,p_stops text[],p_transport text default 'walking',p_description text default '',
  p_tags text[] default '{}',p_visibility text default 'public',p_route_id uuid default null,p_forked_from uuid default null
)
returns uuid set search_path='' language plpgsql volatile as $$
declare
  v_uid uuid:=(select auth.uid());
  v_city uuid;
  v_route uuid;
  v_name text:=btrim(regexp_replace(coalesce(p_name,''),'\s+',' ','g'));
  v_tags text[]:=coalesce((select array_agg(distinct t) from unnest(coalesce(p_tags,'{}'::text[])) t where t<>''),'{}');
  v_stop text;
  v_place uuid;
  v_pos integer:=0;
begin
  if v_uid is null then raise exception 'auth-required' using errcode='28000'; end if;
  select id into v_city from public.cities where slug=p_city_slug;
  if v_city is null then raise exception 'city-not-found' using errcode='P0002'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'invalid-name' using errcode='22023'; end if;
  if char_length(coalesce(p_description,''))>500 then raise exception 'invalid-description' using errcode='22023'; end if;
  if p_transport not in ('walking','bike','transit','mix') then raise exception 'invalid-transport' using errcode='22023'; end if;
  if p_visibility not in ('public','unlisted') then raise exception 'invalid-visibility' using errcode='22023'; end if;
  if coalesce(array_length(p_stops,1),0) not between 2 and 20 then raise exception 'invalid-stop-count' using errcode='22023'; end if;
  if (select count(distinct s) from unnest(p_stops) s)<>array_length(p_stops,1) then raise exception 'duplicate-stop' using errcode='22023'; end if;
  if array_length(v_tags,1)>8 or exists(select 1 from unnest(v_tags) t where t !~ '^[a-z0-9_-]+$') then raise exception 'invalid-tags' using errcode='22023'; end if;
  if p_forked_from is not null and not exists(
    select 1 from public.routes f where f.id=p_forked_from and f.city_id=v_city and f.status='published' and f.visibility in ('public','unlisted')
  ) then raise exception 'invalid-fork-source' using errcode='22023'; end if;

  if p_route_id is null then
    insert into public.routes(city_id,slug,legacy_id,name,description,route_type,owner_user_id,visibility,status,transport,metadata,published_at,forked_from_route_id)
    values(v_city,null,null,v_name,coalesce(p_description,''),'community',v_uid,p_visibility,'published',p_transport,'{}'::jsonb,now(),p_forked_from)
    returning id into v_route;
  else
    update public.routes
    set name=v_name,description=coalesce(p_description,''),visibility=p_visibility,status='published',transport=p_transport,
        published_at=coalesce(published_at,now()),forked_from_route_id=coalesce(p_forked_from,forked_from_route_id)
    where id=p_route_id and owner_user_id=v_uid and route_type='community' and city_id=v_city
    returning id into v_route;
    if v_route is null then raise exception 'not-owner' using errcode='42501'; end if;
    delete from public.route_stops where route_id=v_route;
    delete from public.route_tags where route_id=v_route;
  end if;

  foreach v_stop in array p_stops loop
    select p.id into v_place from public.places p
    where p.city_id=v_city and p.status='published' and p.visibility='public' and coalesce(p.legacy_id,p.slug)=v_stop;
    if not found then raise exception 'unknown-stop:%',v_stop using errcode='22023'; end if;-- FOUND, not v_place: it would keep the previous stop
    insert into public.route_stops(route_id,place_id,position) values(v_route,v_place,v_pos);
    v_pos:=v_pos+1;
  end loop;
  insert into public.route_tags(route_id,tag) select v_route,t from unnest(v_tags) t;
  return v_route;
end $$;

create or replace function public.archive_community_route(p_route_id uuid)
returns uuid set search_path='' language plpgsql volatile as $$
declare v_route uuid;
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  update public.routes set status='archived' where id=p_route_id and owner_user_id=(select auth.uid()) and route_type='community'
  returning id into v_route;
  if v_route is null then raise exception 'not-owner' using errcode='42501'; end if;
  return v_route;
end $$;

create or replace function public.delete_community_route(p_route_id uuid)
returns uuid set search_path='' language plpgsql volatile as $$
declare v_route uuid;
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  delete from public.routes where id=p_route_id and owner_user_id=(select auth.uid()) and route_type='community'
  returning id into v_route;
  if v_route is null then raise exception 'not-owner' using errcode='42501'; end if;
  return v_route;
end $$;

-- 8. Execute grants: reads for everyone, writes for signed-in users only --------------------------------------
-- Supabase default privileges grant EXECUTE on new functions to anon/authenticated explicitly, so revoking from
-- PUBLIC alone is not enough: revoke from anon and authenticated too, then grant back exactly what each needs.
revoke execute on function
  public.community_routes(text,text,integer,integer),public.community_route(uuid),public.author_routes(uuid,text),
  public.public_profile(uuid),public.saved_routes(),public.route_ref(text,text),public.my_route_marks(uuid[]),
  public.save_route(text,text),public.unsave_route(text,text),public.rate_route(text,text,integer),public.remove_rating(text,text),
  public.publish_community_route(text,text,text[],text,text,text[],text,uuid,uuid),public.archive_community_route(uuid),public.delete_community_route(uuid)
from public,anon,authenticated;
grant execute on function
  public.community_routes(text,text,integer,integer),public.community_route(uuid),public.author_routes(uuid,text),
  public.public_profile(uuid),public.route_ref(text,text)
to anon,authenticated;
grant execute on function
  public.saved_routes(),public.my_route_marks(uuid[]),
  public.save_route(text,text),public.unsave_route(text,text),public.rate_route(text,text,integer),public.remove_rating(text,text),
  public.publish_community_route(text,text,text[],text,text,text[],text,uuid,uuid),public.archive_community_route(uuid),public.delete_community_route(uuid)
to authenticated;
