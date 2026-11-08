-- 024: One private, persistent activity inbox for DMs, group chats and friend requests.
-- Event rows are created by trusted database triggers, never by frontend POST requests.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create table if not exists public.activity_notifications(
 id bigint generated always as identity primary key,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('direct_message','group_message','friend_request','friend_accepted')),
 source_key text not null check(length(source_key) between 2 and 220),
 target_hash text not null check(length(target_hash) between 5 and 160),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_id,kind,source_key)
);
create index if not exists activity_notifications_unread_idx
 on public.activity_notifications(recipient_id,created_at desc) where read_at is null;
create index if not exists activity_notifications_recent_idx
 on public.activity_notifications(recipient_id,created_at desc);
alter table public.activity_notifications enable row level security;
revoke all on public.activity_notifications from public,anon,authenticated;
grant select on public.activity_notifications to authenticated;
grant update(read_at) on public.activity_notifications to authenticated;
drop policy if exists activity_notifications_owner_select on public.activity_notifications;
create policy activity_notifications_owner_select on public.activity_notifications
 for select to authenticated using(recipient_id=(select auth.uid()));
drop policy if exists activity_notifications_owner_update on public.activity_notifications;
create policy activity_notifications_owner_update on public.activity_notifications
 for update to authenticated using(recipient_id=(select auth.uid()))
 with check(recipient_id=(select auth.uid()));
grant usage on sequence public.activity_notifications_id_seq to postgres;

create or replace function private.on_direct_message_activity() returns trigger
 language plpgsql security definer set search_path=''
as $$
begin
 insert into public.activity_notifications(recipient_id,actor_id,kind,source_key,target_hash)
 values(
  case when new.sender_id=new.user_low then new.user_high else new.user_low end,
  new.sender_id,'direct_message','dm:'||new.id::text,
  '#routes/community/dm/'||new.sender_id::text
 ) on conflict(recipient_id,kind,source_key) do nothing;
 return new;
end $$;
revoke execute on function private.on_direct_message_activity() from public,anon,authenticated;
drop trigger if exists on_direct_message_activity on public.direct_messages;
create trigger on_direct_message_activity after insert on public.direct_messages
 for each row execute function private.on_direct_message_activity();

create or replace function private.on_group_message_activity() returns trigger
 language plpgsql security definer set search_path=''
as $$
begin
 insert into public.activity_notifications(recipient_id,actor_id,kind,source_key,target_hash)
 select m.user_id,new.user_id,'group_message','group:'||new.id::text,
   '#routes/community/chat/'||new.group_id::text
 from public.group_members m
 where m.group_id=new.group_id and m.user_id<>new.user_id
 limit 500
 on conflict(recipient_id,kind,source_key) do nothing;
 return new;
end $$;
revoke execute on function private.on_group_message_activity() from public,anon,authenticated;
drop trigger if exists on_group_message_activity on public.messages;
create trigger on_group_message_activity after insert on public.messages
 for each row execute function private.on_group_message_activity();

create or replace function private.on_friendship_activity() returns trigger
 language plpgsql security definer set search_path=''
as $$
declare target uuid; event_type text; event_key text; actor uuid;
begin
 if tg_op='INSERT' and new.status='pending' then
  actor:=new.requested_by;
  target:=case when actor=new.user_low then new.user_high else new.user_low end;
  event_type:='friend_request';
  event_key:='invite:'||new.user_low::text||':'||new.user_high::text||':'||extract(epoch from new.created_at)::text;
 elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then
  target:=new.requested_by;
  actor:=case when target=new.user_low then new.user_high else new.user_low end;
  event_type:='friend_accepted';
  event_key:='accept:'||new.user_low::text||':'||new.user_high::text||':'||extract(epoch from new.updated_at)::text;
 else
  return new;
 end if;
 if target<>actor then
  insert into public.activity_notifications(recipient_id,actor_id,kind,source_key,target_hash)
  values(target,actor,event_type,event_key,'#routes/community/friends')
  on conflict(recipient_id,kind,source_key) do nothing;
 end if;
 return new;
end $$;
revoke execute on function private.on_friendship_activity() from public,anon,authenticated;
drop trigger if exists on_friendship_activity_insert on public.friend_connections;
drop trigger if exists on_friendship_activity_accept on public.friend_connections;
create trigger on_friendship_activity_insert after insert on public.friend_connections
 for each row execute function private.on_friendship_activity();
create trigger on_friendship_activity_accept after update of status on public.friend_connections
 for each row execute function private.on_friendship_activity();

do $$
begin
 if not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime'
   and schemaname='public' and tablename='activity_notifications'
 )then
  alter publication supabase_realtime add table public.activity_notifications;
 end if;
end $$;
