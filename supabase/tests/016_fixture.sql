-- REVIEW-027 isolated Postgres fixture. Contains no production data or credentials.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant usage on schema public to authenticated,anon;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now();return new;end $$;
create table public.cities(id uuid primary key,slug text unique not null);
grant select on public.cities to authenticated,anon;
create table public.places(
 id uuid primary key,city_id uuid not null references public.cities(id),
 legacy_id text,slug text not null,visibility text not null default 'public',
 status text not null default 'published',created_by uuid references auth.users(id)
);
create table public.routes(
 id uuid primary key,city_id uuid not null references public.cities(id),
 slug text not null,route_type text not null default 'community',owner_user_id uuid,
 visibility text not null default 'public',status text not null default 'published'
);
create table public.route_ratings(
 route_id uuid not null references public.routes(id),user_id uuid not null references auth.users(id),
 rating smallint not null check (rating between 1 and 5),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(route_id,user_id)
);
alter table public.route_ratings enable row level security;
create policy route_ratings_select_own on public.route_ratings for select to authenticated using (user_id=(select auth.uid()));
create policy route_ratings_insert_own on public.route_ratings for insert to authenticated with check(user_id=(select auth.uid()));
create policy route_ratings_update_own on public.route_ratings for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update on public.route_ratings to authenticated;

alter table public.places enable row level security;
create policy public_places_read on public.places for select to authenticated,anon using(status='published' and visibility='public');
grant select on public.places to authenticated,anon;
alter table public.routes enable row level security;
create policy public_routes_read on public.routes for select to authenticated,anon using(status='published' and visibility='public');
grant select on public.routes to authenticated,anon;

create or replace function public.route_ref(p_city_slug text,p_ref text)
returns uuid language sql stable set search_path='' as $$
 select r.id from public.routes r join public.cities c on c.id=r.city_id
 where c.slug=p_city_slug and r.id::text=p_ref and r.status='published' and r.visibility='public' limit 1
$$;
grant execute on function public.route_ref(text,text) to authenticated,anon;
insert into auth.users values
 ('aaaaaaaa-0000-4000-8000-000000000001'),
 ('bbbbbbbb-0000-4000-8000-000000000002'),
 ('cccccccc-0000-4000-8000-000000000003');
insert into public.cities values ('11111111-0000-4000-8000-000000000001','warsaw');
insert into public.places(id,city_id,slug,created_by) values
 ('22222222-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000001','example','aaaaaaaa-0000-4000-8000-000000000001');
insert into public.routes(id,city_id,slug,owner_user_id) values
 ('33333333-0000-4000-8000-000000000003','11111111-0000-4000-8000-000000000001','author-walk','aaaaaaaa-0000-4000-8000-000000000001');
