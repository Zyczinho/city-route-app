-- Local Postgres/PostGIS simulation of the hosted schema needed by migration 014.
-- This fixture contains no production data or credentials.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create schema extensions;
-- The PostGIS container preinstalls the extension in public; mirror City Route's extensions schema.
drop extension if exists postgis cascade;
create extension postgis with schema extensions;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
grant usage on schema public to anon,authenticated;
grant usage on schema storage to authenticated;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at:=now();return new;end $$;
create table public.cities(
 id uuid primary key default gen_random_uuid(),
 slug text unique not null,
 status text not null default 'launch',
 radius_km numeric not null default 40,
 center extensions.geography(point) not null
);
create table public.place_categories(id text primary key,active boolean not null default true);
create table public.places(
 id uuid primary key default gen_random_uuid(),
 city_id uuid not null references public.cities(id),
 slug text not null,
 name text not null,
 category_id text,
 location extensions.geography(point),
 description text not null default '',
 minutes integer not null default 20,
 cost_minor integer not null default 0,
 tourist_level text not null default 'local',
 food_style text not null default 'none',
 visibility text not null default 'public',
 status text not null default 'published',
 created_by uuid references auth.users(id),
 image_meta jsonb not null default '{}'::jsonb,
 metadata jsonb not null default '{}'::jsonb,
 legacy_id text,
 unique(city_id,slug)
);
alter table public.places enable row level security;
create policy places_read_published on public.places for select to anon,authenticated
 using (status='published' and visibility='public');
grant select on public.places to anon,authenticated;

create table public.app_admins(user_id uuid primary key references auth.users(id));
create or replace function public.is_app_admin() returns boolean
set search_path='' language sql stable security definer as $$
 select exists(select 1 from public.app_admins a where a.user_id=(select auth.uid()));
$$;
create or replace function public.catalogue_request_key(p_text text)
returns text set search_path='' language sql immutable as $$
 select btrim(regexp_replace(lower(coalesce(p_text,'')),'[^a-z0-9]+',' ','g'));
$$;

-- Only test-local dependencies for the already deployed 012 request RPC, which 014 overrides.
create table if not exists public.catalogue_requests (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  request_kind text not null check (request_kind in ('place','category_gap')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  normalized_key text not null,
  category_id text references public.place_categories(id),
  note text not null default '' check (char_length(note)<=500),
  source_url text check (source_url is null or (char_length(source_url)<=500 and source_url ~* '^https?://')),
  status text not null default 'open' check (status in ('open','planned','added','declined')),
  created_by uuid not null references auth.users(id) on delete cascade,
  resolved_place_id uuid references public.places(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (request_kind<>'category_gap' or category_id is not null)
);
create index if not exists catalogue_requests_city_status_idx on public.catalogue_requests(city_id,status,created_at desc);
create index if not exists catalogue_requests_key_idx on public.catalogue_requests(city_id,normalized_key);
create index if not exists catalogue_requests_creator_idx on public.catalogue_requests(created_by,created_at desc);

create table if not exists public.catalogue_request_supports (
  request_id uuid not null references public.catalogue_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(request_id,user_id)
);
create index if not exists catalogue_request_supports_user_idx on public.catalogue_request_supports(user_id);


create or replace function public.catalogue_request_validate(
  p_kind text,p_title text,p_category text,p_note text,p_source_url text
) returns void set search_path='' language plpgsql stable as $request_validate$
begin
  if p_kind not in ('place','category_gap') then raise exception 'invalid-kind' using errcode='22023'; end if;
  if char_length(p_title) not between 2 and 120 or public.catalogue_request_key(p_title)='' then raise exception 'invalid-title' using errcode='22023'; end if;
  if p_category is not null and not exists(select 1 from public.place_categories pc where pc.id=p_category and pc.active)
  then raise exception 'invalid-category' using errcode='22023'; end if;
  if p_kind='category_gap' and p_category is null then raise exception 'category-required' using errcode='22023'; end if;
  if char_length(coalesce(p_note,''))>500 then raise exception 'invalid-note' using errcode='22023'; end if;
  if p_source_url is not null and (char_length(p_source_url)>500 or p_source_url !~* '^https?://') then raise exception 'invalid-url' using errcode='22023'; end if;
end $request_validate$;
grant select on public.catalogue_requests to authenticated;

create table storage.buckets(
 id text primary key,
 name text not null,
 public boolean not null default false,
 file_size_limit integer,
 allowed_mime_types text[]
);
create table storage.objects(
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null references storage.buckets(id),
 name text not null,
 unique(bucket_id,name)
);
create or replace function storage.foldername(p_name text)
returns text[] language sql immutable as $$select string_to_array(p_name,'/')$$;
alter table storage.objects enable row level security;
grant insert on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

insert into auth.users values
 ('aaaaaaaa-0000-4000-8000-000000000001'),
 ('bbbbbbbb-0000-4000-8000-000000000002'),
 ('cccccccc-0000-4000-8000-000000000003');
insert into public.app_admins values('cccccccc-0000-4000-8000-000000000003');
insert into public.cities(slug,status,radius_km,center) values
 ('warsaw','launch',40,extensions.st_point(21.0122,52.2297)::extensions.geography),
 ('krakow','next',35,extensions.st_point(19.9450,50.0647)::extensions.geography);
insert into public.place_categories(id,active) values
 ('viewpoint',true),('restaurant',true),('old_category',false);
