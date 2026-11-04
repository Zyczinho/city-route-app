-- 015: Unique explorer nicknames and mutually accepted friends.
-- Stage after migrations 013/014. DO NOT apply to the hosted project without the release gate.
-- No emails, contact lists, or user_metadata used as authorization claims.

-- Resolve historical collisions deterministically; keep the oldest original name.
with ranked as (
 select id,row_number() over(partition by lower(btrim(nickname)) order by created_at,id) as rank
 from public.profiles
)
update public.profiles p set nickname='u_'||p.id::text
from ranked r where r.id=p.id and r.rank>1;

create or replace function public.normalize_explorer_nickname()
returns trigger language plpgsql set search_path='' as $$
begin
 new.nickname:=btrim(coalesce(new.nickname,''));
 if char_length(new.nickname) not between 2 and 40 then
   raise exception 'invalid-nickname' using errcode='22023';
 end if;
 return new;
end $$;
drop trigger if exists normalize_explorer_nickname on public.profiles;
create trigger normalize_explorer_nickname
before insert or update of nickname on public.profiles
for each row execute function public.normalize_explorer_nickname();

create unique index if not exists profiles_nickname_ci_unique
on public.profiles(lower(btrim(nickname)));

-- Signup without a nickname gets a guaranteed UUID-based nickname.
-- Explicit duplicate nickname results in a unique violation, never a silent collision.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_nickname text:=nullif(btrim(coalesce(new.raw_user_meta_data->>'nickname','')),'');
begin
 insert into public.profiles(id,nickname)
 values(new.id,coalesce(v_nickname,'u_'||new.id::text))
 on conflict (id) do nothing;
 return new;
end $$;

create table if not exists public.friend_connections(
 user_low uuid not null references auth.users(id) on delete cascade,
 user_high uuid not null references auth.users(id) on delete cascade,
 requested_by uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_low,user_high),
 check (user_low<user_high),
 check (requested_by in (user_low,user_high))
);
create index if not exists friend_connections_low_idx on public.friend_connections(user_low,status);
create index if not exists friend_connections_high_idx on public.friend_connections(user_high,status);
drop trigger if exists friend_connections_set_updated_at on public.friend_connections;
create trigger friend_connections_set_updated_at
before update on public.friend_connections for each row execute function public.set_updated_at();

alter table public.friend_connections enable row level security;
revoke all on public.friend_connections from public,anon,authenticated;
grant select on public.friend_connections to authenticated;
drop policy if exists friend_connections_participant_read on public.friend_connections;
create policy friend_connections_participant_read on public.friend_connections
 for select to authenticated using ((select auth.uid()) in (user_low,user_high));

-- A small public availability check supports signup; uniqueness is still enforced in SQL.
create or replace function public.nickname_available(p_nickname text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v text:=btrim(coalesce(p_nickname,''));
begin
 if char_length(v) not between 2 and 40 then return false; end if;
 return not exists(select 1 from public.profiles where lower(btrim(nickname))=lower(v));
end $$;

-- Only nickname and UUID leave the backend; no email/stay or private data.
create or replace function public.find_explorers(p_query text,p_limit integer default 12)
returns table(user_id uuid,nickname text,friend_status text,requested_by_me boolean)
language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid:=(select auth.uid());
 v_query text:=btrim(coalesce(p_query,''));
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if char_length(v_query)<2 then return; end if;
 return query
 select p.id,p.nickname,coalesce(f.status,'none'),coalesce(f.requested_by=v_user,false)
 from public.profiles p
 left join public.friend_connections f on f.user_low=least(p.id,v_user) and f.user_high=greatest(p.id,v_user)
 where p.id<>v_user and lower(p.nickname) like '%'||lower(replace(replace(replace(v_query,'\','\\'),'%','\%'),'_','\_'))||'%' escape '\'
 order by (lower(p.nickname)=lower(v_query)) desc,p.nickname
 limit least(greatest(coalesce(p_limit,12),1),20);
end $$;

create or replace function public.my_friends()
returns table(user_id uuid,nickname text,friend_status text,requested_by_me boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 return query
 select p.id,p.nickname,f.status,(f.requested_by=v_user)
 from public.friend_connections f
 join public.profiles p on p.id=case when f.user_low=v_user then f.user_high else f.user_low end
 where v_user in (f.user_low,f.user_high)
 order by case when f.status='pending' then 0 else 1 end,p.nickname
 limit 500;
end $$;

create or replace function public.send_friend_request(p_user_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_status text;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id=v_user then raise exception 'invalid-friend' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'user-not-found' using errcode='P0002'; end if;
 insert into public.friend_connections(user_low,user_high,requested_by)
 values(least(v_user,p_user_id),greatest(v_user,p_user_id),v_user)
 on conflict do nothing;
 if not found then
   select status into v_status from public.friend_connections where user_low=least(v_user,p_user_id) and user_high=greatest(v_user,p_user_id);
   return coalesce(v_status,'pending');
 end if;
 return 'pending';
end $$;

create or replace function public.respond_friend_request(p_user_id uuid,p_accept boolean)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v public.friend_connections%rowtype;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id=v_user then raise exception 'invalid-friend' using errcode='22023'; end if;
 select * into v from public.friend_connections
 where user_low=least(v_user,p_user_id) and user_high=greatest(v_user,p_user_id) for update;
 if not found or v.status<>'pending' or v.requested_by=v_user then
   raise exception 'request-not-found' using errcode='P0002'; end if;
 if p_accept then
   update public.friend_connections set status='accepted' where user_low=v.user_low and user_high=v.user_high;
   return 'accepted';
 end if;
 delete from public.friend_connections where user_low=v.user_low and user_high=v.user_high;
 return 'declined';
end $$;

create or replace function public.remove_friend(p_user_id uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_user_id is null or p_user_id=v_user then return false; end if;
 delete from public.friend_connections where user_low=least(v_user,p_user_id) and user_high=greatest(v_user,p_user_id);
 return found;
end $$;

revoke execute on function
 public.nickname_available(text),
 public.find_explorers(text,integer),
 public.my_friends(),
 public.send_friend_request(uuid),
 public.respond_friend_request(uuid,boolean),
 public.remove_friend(uuid)
from public,anon,authenticated;
grant execute on function public.nickname_available(text) to anon,authenticated;
grant execute on function
 public.find_explorers(text,integer),
 public.my_friends(),
 public.send_friend_request(uuid),
 public.respond_friend_request(uuid,boolean),
 public.remove_friend(uuid)
to authenticated;
