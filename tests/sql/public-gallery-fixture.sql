-- Isolated PostgreSQL 16 schema fixture, aligned with READ-ONLY production introspection on 2026-11-05.
-- This is NOT a full Supabase clone; it models only referenced tables, functions and RLS.
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema public,auth,storage to anon,authenticated;

create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to anon,authenticated;

create table public.cities(id uuid primary key,slug text not null unique);
create table public.places(
 id uuid primary key,
 status text not null default 'published',
 visibility text not null default 'public',
 metadata jsonb not null default '{}'::jsonb
);
create table public.place_submissions(
 id uuid primary key,
 city_id uuid not null references public.cities(id),
 submitted_by uuid not null references auth.users(id),
 status text not null default 'pending',
 created_at timestamptz not null default now()
);
create table public.app_admins(user_id uuid primary key references auth.users(id));

alter table public.places enable row level security;
create policy places_read_published on public.places for select to anon,authenticated
 using(status='published' and visibility='public');
grant select on public.places to anon,authenticated;

alter table public.place_submissions enable row level security;
create policy place_submissions_owner_read on public.place_submissions for select to authenticated
 using(submitted_by=(select auth.uid()));
grant select on public.place_submissions to authenticated;

create function public.is_app_admin() returns boolean language sql stable security definer
 set search_path='' as
$$ select exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())); $$;
revoke all on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;

create table storage.objects(
 bucket_id text not null,
 name text not null,
 primary key(bucket_id,name)
);
create function storage.foldername(p_name text) returns text[] language sql immutable
 as $$ select string_to_array(p_name,'/') $$;
grant execute on function storage.foldername(text) to anon,authenticated;
alter table storage.objects enable row level security;
grant insert on storage.objects to authenticated;
