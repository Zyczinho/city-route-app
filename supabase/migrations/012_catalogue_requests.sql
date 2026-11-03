-- 012 Catalogue requests / missing-place demand (REQUESTS.md, REQUESTS-DATA-002). Forward-only and safe to re-run.
-- Users request a missing place or a category gap in a city and support each other's requests (one support per
-- user). Ranking aggregates support rows; no counters. Public reads go through definer RPCs that never return
-- note, source URL, creator or supporter identities, and only for open/planned demand. Clients cannot write any
-- table directly: every write is a validated definer RPC. Status is changed only by the service role / SQL until
-- an admin-role contract exists.

-- 1. Duplicate-discovery key: lowercase, Polish diacritics folded, punctuation collapsed to single spaces ------
create or replace function public.catalogue_request_key(p_text text)
returns text
set search_path=''
language sql
immutable
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_text,'')),'ąćęłńóśźżäöüéèáíúàâêôçñ','acelnoszzaoueeaiuaaeocn'),
    '[^a-z0-9]+',' ','g'));
$$;

-- 2. Tables --------------------------------------------------------------------------------------------------
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

-- normalized_key always follows the title, whoever writes the row.
create or replace function public.catalogue_requests_set_key()
returns trigger set search_path='' language plpgsql as $$
begin new.normalized_key:=public.catalogue_request_key(new.title); return new; end $$;
drop trigger if exists catalogue_requests_set_key on public.catalogue_requests;
create trigger catalogue_requests_set_key before insert or update of title on public.catalogue_requests
for each row execute function public.catalogue_requests_set_key();
drop trigger if exists catalogue_requests_set_updated_at on public.catalogue_requests;
create trigger catalogue_requests_set_updated_at before update on public.catalogue_requests
for each row execute function public.set_updated_at();

-- 3. Privileges and RLS --------------------------------------------------------------------------------------
-- Clients may only READ their own rows. Every write (create, edit, delete, support, unsupport) goes through the
-- security-definer RPCs in section 6, which check auth.uid() and all rules explicitly, so validation, the
-- 20/24 h limit, the creator's automatic support and "status is never client-writable" cannot be bypassed with
-- a direct table INSERT/UPDATE/DELETE.
alter table public.catalogue_requests enable row level security;
alter table public.catalogue_request_supports enable row level security;
revoke all on public.catalogue_requests,public.catalogue_request_supports from public,anon,authenticated;
grant select on public.catalogue_requests,public.catalogue_request_supports to authenticated;

drop policy if exists catalogue_requests_select_own on public.catalogue_requests;
create policy catalogue_requests_select_own on public.catalogue_requests for select to authenticated using (created_by=(select auth.uid()));
drop policy if exists catalogue_request_supports_select_own on public.catalogue_request_supports;
create policy catalogue_request_supports_select_own on public.catalogue_request_supports for select to authenticated using (user_id=(select auth.uid()));
-- Write policies from the first draft of 012 are dropped if present: no client role has write privileges.
drop policy if exists catalogue_requests_insert_own on public.catalogue_requests;
drop policy if exists catalogue_requests_update_own on public.catalogue_requests;
drop policy if exists catalogue_requests_delete_own on public.catalogue_requests;
drop policy if exists catalogue_request_supports_insert_own on public.catalogue_request_supports;
drop policy if exists catalogue_request_supports_delete_own on public.catalogue_request_supports;

-- Edit/delete is allowed only while a request is open and nobody but its creator supports it.
create or replace function public.catalogue_request_has_other_supporters(p_request_id uuid)
returns boolean set search_path='' language sql stable as $$
  select exists(select 1 from public.catalogue_request_supports s
                join public.catalogue_requests r on r.id=s.request_id
                where s.request_id=p_request_id and s.user_id<>r.created_by);
$$;

-- 4. Read model: safe public card + aggregates, revoked from clients ----------------------------------------
-- Never contains note, source_url, created_by or supporter identities.
create or replace view public.catalogue_request_cards as
select
  r.id,
  c.slug as city_slug,
  r.request_kind,
  r.title,
  r.normalized_key,
  r.category_id,
  r.status,
  case when p.status='published' and p.visibility='public' then coalesce(p.legacy_id,p.slug) end as resolved_place_id,
  r.created_at,
  r.updated_at,
  sp.support_count,
  sp.supports_30d,
  sp.last_supported_at
from public.catalogue_requests r
join public.cities c on c.id=r.city_id
left join public.places p on p.id=r.resolved_place_id
cross join lateral (
  select count(*)::int as support_count,
         count(*) filter (where s.created_at>now()-interval '30 days')::int as supports_30d,
         max(s.created_at) as last_supported_at
  from public.catalogue_request_supports s where s.request_id=r.id
) sp;

revoke all on public.catalogue_request_cards from public,anon,authenticated;

-- 5. Read RPCs (definer: aggregates across users; every one filters to safe card columns) -------------------
-- Public demand is active demand only: open and planned. Added/declined requests are never enumerable here;
-- each creator sees their own lifecycle through my_catalogue_requests(). p_status: 'active' (default) | 'open' |
-- 'planned'; anything else is treated as 'active'.
create or replace function public.catalogue_requests_ranked(
  p_city_slug text,p_kind text default null,p_category text default null,p_status text default 'active',
  p_sort text default 'popular',p_limit integer default 20,p_offset integer default 0
)
returns setof public.catalogue_request_cards
set search_path=''
language sql
stable
security definer
as $$
  select * from public.catalogue_request_cards c
  where c.city_slug=p_city_slug
    and (p_kind is null or c.request_kind=p_kind)
    and (p_category is null or c.category_id=p_category)
    and c.status in ('open','planned')
    and case when p_status in ('open','planned') then c.status=p_status else true end
  order by
    case when p_sort='newest' then extract(epoch from c.created_at) else c.support_count end desc,
    case when p_sort='newest' then c.support_count else extract(epoch from c.created_at) end desc,
    c.id
  limit least(greatest(coalesce(p_limit,20),1),50)
  offset greatest(coalesce(p_offset,0),0);
$$;

-- Your own requests in every status (Profil → Twoje prośby), newest first, with your private note and link.
create or replace function public.my_catalogue_requests()
returns table(id uuid,city_slug text,request_kind text,title text,category_id text,note text,source_url text,status text,
              resolved_place_id text,created_at timestamptz,updated_at timestamptz,support_count integer,can_edit boolean)
set search_path=''
language sql
stable
security definer
as $$
  select c.id,c.city_slug,c.request_kind,c.title,c.category_id,r.note,r.source_url,c.status,c.resolved_place_id,
         c.created_at,c.updated_at,c.support_count,
         (c.status='open' and not public.catalogue_request_has_other_supporters(c.id))
  from public.catalogue_requests r
  join public.catalogue_request_cards c on c.id=r.id
  where r.created_by=(select auth.uid())
  order by c.created_at desc,c.id;
$$;

-- Likely duplicates before creating: same city, still open/planned, scored by shared words of the normalized
-- title (words of 3+ characters), exact key and prefix matches first. Never a hard unique constraint.
create or replace function public.similar_catalogue_requests(
  p_city_slug text,p_title text,p_kind text default null,p_category text default null,p_limit integer default 5
)
returns table(id uuid,city_slug text,request_kind text,title text,category_id text,status text,support_count integer,similarity numeric)
set search_path=''
language sql
stable
security definer
as $$
  with q as (
    select public.catalogue_request_key(p_title) as key,
           array(select distinct w from unnest(string_to_array(public.catalogue_request_key(p_title),' ')) w where char_length(w)>=3) as words
  ),
  scored as (
    select c.*,
      case when c.normalized_key=q.key then 1.0
           when q.key<>'' and (c.normalized_key like q.key||'%' or q.key like c.normalized_key||'%') then 0.8
           else coalesce((
             select count(*)::numeric/greatest(cardinality(q.words),1)
             from unnest(q.words) w where w=any(string_to_array(c.normalized_key,' '))
           ),0)*0.7 end
      + case when p_category is not null and c.category_id=p_category then 0.1 else 0 end as similarity
    from public.catalogue_request_cards c,q
    where c.city_slug=p_city_slug and c.status in ('open','planned')
      and (p_kind is null or c.request_kind=p_kind)
  )
  select s.id,s.city_slug,s.request_kind,s.title,s.category_id,s.status,s.support_count,round(s.similarity,2)
  from scored s
  where s.similarity>=0.35
  order by s.similarity desc,s.support_count desc,s.id
  limit least(greatest(coalesce(p_limit,5),1),10);
$$;

-- Supported/mine state for a page of cards (one call). Invoker: RLS shows only your own rows.
create or replace function public.my_catalogue_request_marks(p_request_ids uuid[])
returns table(request_id uuid,supported boolean,mine boolean)
set search_path=''
language sql
stable
as $$
  select ids.id,
    exists(select 1 from public.catalogue_request_supports s where s.request_id=ids.id and s.user_id=(select auth.uid())),
    exists(select 1 from public.catalogue_requests r where r.id=ids.id and r.created_by=(select auth.uid()))
  from unnest(coalesce(p_request_ids,'{}'::uuid[])) as ids(id);
$$;

-- 6. Write RPCs. security definer with an empty search_path: they are the only write path (no client role has
-- table write privileges), so each one checks auth.uid() and every rule itself.
create or replace function public.catalogue_request_validate(
  p_kind text,p_title text,p_category text,p_note text,p_source_url text
) returns void set search_path='' language plpgsql stable as $$
begin
  if p_kind not in ('place','category_gap') then raise exception 'invalid-kind' using errcode='22023'; end if;
  if char_length(p_title) not between 2 and 120 or public.catalogue_request_key(p_title)='' then raise exception 'invalid-title' using errcode='22023'; end if;
  if p_category is not null and not exists(select 1 from public.place_categories pc where pc.id=p_category and pc.active)
  then raise exception 'invalid-category' using errcode='22023'; end if;
  if p_kind='category_gap' and p_category is null then raise exception 'category-required' using errcode='22023'; end if;
  if char_length(coalesce(p_note,''))>500 then raise exception 'invalid-note' using errcode='22023'; end if;
  if p_source_url is not null and (char_length(p_source_url)>500 or p_source_url !~* '^https?://') then raise exception 'invalid-url' using errcode='22023'; end if;
end $$;

create or replace function public.create_catalogue_request(
  p_city_slug text,p_kind text,p_title text,p_category text default null,p_note text default '',p_source_url text default null
)
returns uuid set search_path='' language plpgsql volatile security definer as $$
declare
  v_uid uuid:=(select auth.uid());
  v_city uuid;
  v_title text:=btrim(regexp_replace(coalesce(p_title,''),'\s+',' ','g'));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_id uuid;
begin
  if v_uid is null then raise exception 'auth-required' using errcode='28000'; end if;
  select id into v_city from public.cities where slug=p_city_slug and status<>'hidden';
  if v_city is null then raise exception 'city-not-found' using errcode='P0002'; end if;
  perform public.catalogue_request_validate(p_kind,v_title,p_category,p_note,v_url);
  -- 20 live requests per user per 24 h. Counts surviving rows: deleting an unsupported request frees a slot
  -- (documented; it cannot persist spam because deleted rows are gone).
  if (select count(*) from public.catalogue_requests r where r.created_by=v_uid and r.created_at>now()-interval '24 hours')>=20
  then raise exception 'rate-limited' using errcode='54000'; end if;
  insert into public.catalogue_requests(city_id,request_kind,title,normalized_key,category_id,note,source_url,created_by)
  values(v_city,p_kind,v_title,'',p_category,coalesce(p_note,''),v_url,v_uid)
  returning id into v_id;
  insert into public.catalogue_request_supports(request_id,user_id) values(v_id,v_uid);-- creator counts as a supporter
  return v_id;
end $$;

-- Edit your own request while it is open and only you support it. Kind, city, status and creator never change.
create or replace function public.update_my_catalogue_request(
  p_request_id uuid,p_title text,p_category text default null,p_note text default '',p_source_url text default null
)
returns uuid set search_path='' language plpgsql volatile security definer as $$
declare
  v_uid uuid:=(select auth.uid());
  v_kind text;
  v_title text:=btrim(regexp_replace(coalesce(p_title,''),'\s+',' ','g'));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
begin
  if v_uid is null then raise exception 'auth-required' using errcode='28000'; end if;
  select r.request_kind into v_kind from public.catalogue_requests r
  where r.id=p_request_id and r.created_by=v_uid and r.status='open' and not public.catalogue_request_has_other_supporters(r.id);
  if v_kind is null then raise exception 'not-editable' using errcode='42501'; end if;
  perform public.catalogue_request_validate(v_kind,v_title,p_category,p_note,v_url);
  update public.catalogue_requests set title=v_title,category_id=p_category,note=coalesce(p_note,''),source_url=v_url where id=p_request_id;
  return p_request_id;
end $$;

create or replace function public.delete_my_catalogue_request(p_request_id uuid)
returns uuid set search_path='' language plpgsql volatile security definer as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  delete from public.catalogue_requests r
  where r.id=p_request_id and r.created_by=(select auth.uid()) and r.status='open' and not public.catalogue_request_has_other_supporters(r.id)
  returning r.id into v_id;
  if v_id is null then raise exception 'not-deletable' using errcode='42501'; end if;
  return v_id;
end $$;

create or replace function public.support_catalogue_request(p_request_id uuid)
returns uuid set search_path='' language plpgsql volatile security definer as $$
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  if not exists(select 1 from public.catalogue_requests r where r.id=p_request_id and r.status in ('open','planned'))
  then raise exception 'request-not-supportable' using errcode='P0002'; end if;
  insert into public.catalogue_request_supports(request_id,user_id) values(p_request_id,(select auth.uid())) on conflict do nothing;
  return p_request_id;
end $$;

-- The creator's support is part of owning the request: it cannot be withdrawn (delete the request instead).
create or replace function public.unsupport_catalogue_request(p_request_id uuid)
returns uuid set search_path='' language plpgsql volatile security definer as $$
begin
  if (select auth.uid()) is null then raise exception 'auth-required' using errcode='28000'; end if;
  if exists(select 1 from public.catalogue_requests r where r.id=p_request_id and r.created_by=(select auth.uid()))
  then raise exception 'creator-support-required' using errcode='42501'; end if;
  delete from public.catalogue_request_supports where request_id=p_request_id and user_id=(select auth.uid());
  return p_request_id;
end $$;

-- 7. Execute grants. Supabase default privileges grant EXECUTE to anon/authenticated explicitly, so revoke from
-- all three before granting exactly what each role needs. Helpers are not callable by clients at all.
revoke execute on function
  public.catalogue_request_key(text),public.catalogue_requests_set_key(),public.catalogue_request_has_other_supporters(uuid),
  public.catalogue_request_validate(text,text,text,text,text),
  public.catalogue_requests_ranked(text,text,text,text,text,integer,integer),public.similar_catalogue_requests(text,text,text,text,integer),
  public.my_catalogue_request_marks(uuid[]),public.my_catalogue_requests(),
  public.create_catalogue_request(text,text,text,text,text,text),public.update_my_catalogue_request(uuid,text,text,text,text),
  public.support_catalogue_request(uuid),public.unsupport_catalogue_request(uuid),public.delete_my_catalogue_request(uuid)
from public,anon,authenticated;
grant execute on function
  public.catalogue_requests_ranked(text,text,text,text,text,integer,integer),public.similar_catalogue_requests(text,text,text,text,integer)
to anon,authenticated;
grant execute on function
  public.my_catalogue_request_marks(uuid[]),public.my_catalogue_requests(),
  public.create_catalogue_request(text,text,text,text,text,text),public.update_my_catalogue_request(uuid,text,text,text,text),
  public.support_catalogue_request(uuid),public.unsupport_catalogue_request(uuid),public.delete_my_catalogue_request(uuid)
to authenticated;
