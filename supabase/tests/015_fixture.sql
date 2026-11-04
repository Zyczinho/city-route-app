-- Isolated integration fixture for migration 015 (never runs against hosted Supabase).
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant usage on schema public to authenticated,anon;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now();return new;end $$;
create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null default 'Odkrywca' check(char_length(nickname) between 1 and 40),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
 using ((select auth.uid())=id) with check ((select auth.uid())=id);
grant select,insert,update on public.profiles to authenticated;
insert into auth.users(id) values
 ('aaaaaaaa-0000-4000-8000-000000000001'),
 ('bbbbbbbb-0000-4000-8000-000000000002'),
 ('cccccccc-0000-4000-8000-000000000003');
-- Duplicate historical nick: migration must repair the second row before adding unique index.
insert into public.profiles(id,nickname) values
 ('aaaaaaaa-0000-4000-8000-000000000001','Kuba'),
 ('bbbbbbbb-0000-4000-8000-000000000002','kUBA'),
 ('cccccccc-0000-4000-8000-000000000003','Anna');
