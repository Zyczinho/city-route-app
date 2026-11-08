-- 022: Private direct messages between accepted City Route friends.
-- Keep public.messages (group chat) untouched; participant-only history, accepted-friend-only inserts.
-- No privileged auth bypass, service secret or user-controlled authorization metadata.
create table if not exists public.direct_messages (
 id bigint generated always as identity primary key,
 user_low uuid not null references auth.users(id) on delete cascade,
 user_high uuid not null references auth.users(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 2000 and char_length(body)<=2000),
 created_at timestamptz not null default now(),
 constraint direct_messages_ordered_pair check (user_low < user_high),
 constraint direct_messages_sender_participant check (sender_id in (user_low,user_high))
);
create index if not exists direct_messages_pair_latest_idx on public.direct_messages(user_low,user_high,created_at desc);
create index if not exists direct_messages_high_latest_idx on public.direct_messages(user_high,created_at desc);
create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id);
alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from public,anon,authenticated;
-- Limit insertable columns: clients cannot forge created_at or id.
grant select on public.direct_messages to authenticated;
grant insert(user_low,user_high,sender_id,body) on public.direct_messages to authenticated;
grant usage on sequence public.direct_messages_id_seq to authenticated;
drop policy if exists direct_messages_participants_read on public.direct_messages;
create policy direct_messages_participants_read on public.direct_messages
 for select to authenticated
 using ((select auth.uid()) in (user_low,user_high));
drop policy if exists direct_messages_accepted_friends_insert on public.direct_messages;
create policy direct_messages_accepted_friends_insert on public.direct_messages
 for insert to authenticated
 with check (
  sender_id=(select auth.uid())
  and (select auth.uid()) in (user_low,user_high)
  and exists (
   select 1 from public.friend_connections fc
   where fc.user_low=direct_messages.user_low
     and fc.user_high=direct_messages.user_high
     and fc.status='accepted'
  )
 );
-- RLS applies to realtime delivery. Never publish unauthenticated direct messages.
do $$
begin
 if not exists (
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='direct_messages'
 ) then
  alter publication supabase_realtime add table public.direct_messages;
 end if;
end $$;
