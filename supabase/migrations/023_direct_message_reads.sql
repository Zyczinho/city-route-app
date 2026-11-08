-- 023: Per-account, cross-device direct-message read receipts.
-- No message content is replicated into this table; only a monotonically growing seen message ID.
create table if not exists public.direct_message_reads (
 reader_id uuid not null references auth.users(id) on delete cascade,
 peer_id uuid not null references auth.users(id) on delete cascade,
 last_read_message_id bigint not null default 0 check (last_read_message_id >= 0),
 created_at timestamptz not null default now(),
 primary key (reader_id,peer_id),
 constraint direct_message_reads_distinct_users check (reader_id<>peer_id)
);
alter table public.direct_message_reads enable row level security;
revoke all on public.direct_message_reads from public,anon,authenticated;
grant select on public.direct_message_reads to authenticated;
grant insert (reader_id,peer_id,last_read_message_id) on public.direct_message_reads to authenticated;
grant update (last_read_message_id) on public.direct_message_reads to authenticated;

drop policy if exists direct_message_reads_owner_select on public.direct_message_reads;
create policy direct_message_reads_owner_select
 on public.direct_message_reads for select to authenticated
 using (reader_id=(select auth.uid()));

drop policy if exists direct_message_reads_owner_insert on public.direct_message_reads;
create policy direct_message_reads_owner_insert
 on public.direct_message_reads for insert to authenticated
 with check (
  reader_id=(select auth.uid()) and (
   last_read_message_id=0 or exists (
    select 1 from public.direct_messages dm
    where dm.id=direct_message_reads.last_read_message_id
      and dm.user_low=least(direct_message_reads.reader_id,direct_message_reads.peer_id)
      and dm.user_high=greatest(direct_message_reads.reader_id,direct_message_reads.peer_id)
   )
  )
 );

drop policy if exists direct_message_reads_owner_update on public.direct_message_reads;
create policy direct_message_reads_owner_update
 on public.direct_message_reads for update to authenticated
 using (reader_id=(select auth.uid()))
 with check (
  reader_id=(select auth.uid()) and (
   last_read_message_id=0 or exists (
    select 1 from public.direct_messages dm
    where dm.id=direct_message_reads.last_read_message_id
      and dm.user_low=least(direct_message_reads.reader_id,direct_message_reads.peer_id)
      and dm.user_high=greatest(direct_message_reads.reader_id,direct_message_reads.peer_id)
   )
  )
 );
