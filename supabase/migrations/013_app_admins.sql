-- 013 Founder/admin access for catalogue requests (PLACE_REQUESTS.md, REQ-ADMIN-004). Forward-only and safe to re-run.
-- An allow-list of admin user ids that no client can read or write. Admin RPCs check it themselves and return the
-- private note and source link the public cards hide, but never requester or supporter identities.
-- The first admin is added manually by the product owner in the SQL editor (REQUESTS_ADMIN.md); never automated.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public,anon,authenticated;-- no policies: invisible to every client role

-- True only for a signed-in user on the allow-list. Used by the admin page to decide what to show.
create or replace function public.is_app_admin()
returns boolean set search_path='' language sql stable security definer as $$
  select exists(select 1 from public.app_admins a where a.user_id=(select auth.uid()));
$$;

-- Ranking for the founder: every status, private note and link, still no identities.
-- p_status: 'active' (open+planned, default) | 'open' | 'planned' | 'added' | 'declined' | 'all'.
-- p_sort: 'popular' (supports, then newest) | 'recent' (supports in the last 30 days) | 'newest'.
create or replace function public.admin_catalogue_requests(
  p_city_slug text,p_kind text default null,p_category text default null,p_status text default 'active',
  p_sort text default 'popular',p_limit integer default 100,p_offset integer default 0
)
returns table(id uuid,city_slug text,request_kind text,title text,category_id text,status text,note text,source_url text,
              resolved_place_id text,created_at timestamptz,updated_at timestamptz,support_count integer,supports_30d integer,
              last_supported_at timestamptz)
set search_path=''
language plpgsql
stable
security definer
as $$
begin
  if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  return query
    select c.id,c.city_slug,c.request_kind,c.title,c.category_id,c.status,r.note,r.source_url,c.resolved_place_id,
           c.created_at,c.updated_at,c.support_count,c.supports_30d,c.last_supported_at
    from public.catalogue_request_cards c
    join public.catalogue_requests r on r.id=c.id
    where c.city_slug=p_city_slug
      and (p_kind is null or c.request_kind=p_kind)
      and (p_category is null or c.category_id=p_category)
      and case coalesce(p_status,'active')
            when 'active' then c.status in ('open','planned')
            when 'all' then true
            else c.status=p_status end
    order by
      case p_sort when 'newest' then extract(epoch from c.created_at)
                  when 'recent' then c.supports_30d
                  else c.support_count end desc,
      c.support_count desc,c.created_at desc,c.id
    limit least(greatest(coalesce(p_limit,100),1),500)
    offset greatest(coalesce(p_offset,0),0);
end $$;

-- Lifecycle change. 'added' may link a place by its public id (slug/legacy id) in the request's city;
-- any other status clears the link.
create or replace function public.admin_set_catalogue_request_status(p_request_id uuid,p_status text,p_resolved_place text default null)
returns uuid set search_path='' language plpgsql volatile security definer as $$
declare v_city uuid;v_place uuid;
begin
  if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_status not in ('open','planned','added','declined') then raise exception 'invalid-status' using errcode='22023'; end if;
  select r.city_id into v_city from public.catalogue_requests r where r.id=p_request_id;
  if v_city is null then raise exception 'request-not-found' using errcode='P0002'; end if;
  if p_status='added' and nullif(btrim(coalesce(p_resolved_place,'')),'') is not null then
    select p.id into v_place from public.places p
    where p.city_id=v_city and p.status='published' and coalesce(p.legacy_id,p.slug)=btrim(p_resolved_place);
    if v_place is null then raise exception 'unknown-place' using errcode='22023'; end if;
  end if;
  update public.catalogue_requests set status=p_status,resolved_place_id=case when p_status='added' then v_place end where id=p_request_id;
  return p_request_id;
end $$;

-- Supabase default privileges grant EXECUTE to anon/authenticated explicitly: revoke from all three, then grant
-- to authenticated only. Each function still checks the allow-list itself.
revoke execute on function
  public.is_app_admin(),
  public.admin_catalogue_requests(text,text,text,text,text,integer,integer),
  public.admin_set_catalogue_request_status(uuid,text,text)
from public,anon,authenticated;
grant execute on function
  public.is_app_admin(),
  public.admin_catalogue_requests(text,text,text,text,text,integer,integer),
  public.admin_set_catalogue_request_status(uuid,text,text)
to authenticated;
