-- Identity sequences have their own PostgreSQL permissions.
grant usage, select on sequence public.messages_id_seq to authenticated;
