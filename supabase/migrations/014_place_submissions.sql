-- 014 Community place contributions (PLACE-COMMUNITY-019). Forward-only.
-- Run AFTER 013_app_admins.sql. No anonymous writes. Approval is always admin-only.
-- A place is NEVER public while a submission is pending; published places reuse catalogue_places().

create table if not exists public.place_submissions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  normalized_key text not null,
  category_id text not null references public.place_categories(id),
  location extensions.geography(POINT) not null,
  description text not null default '' check (char_length(description)<=500),
  source_url text check (source_url is null or (char_length(source_url)<=500 and source_url ~* '^https?://')),
  image_path text,
  image_rights_confirmed boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','merged')),
  resolved_place_id uuid references public.places(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (image_path is null or image_rights_confirmed),
  check (status not in ('approved','merged') or resolved_place_id is not null)
);
create index if not exists place_submissions_queue_idx on public.place_submissions(status,created_at);
create index if not exists place_submissions_owner_idx on public.place_submissions(submitted_by,created_at desc);
create index if not exists place_submissions_duplicate_idx on public.place_submissions(city_id,normalized_key,status);
create index if not exists place_submissions_geo_idx on public.place_submissions using gist(location);

drop trigger if exists place_submissions_set_updated_at on public.place_submissions;
create trigger place_submissions_set_updated_at before update on public.place_submissions
for each row execute function public.set_updated_at();

alter table public.place_submissions enable row level security;
revoke all on public.place_submissions from public,anon,authenticated;
grant select on public.place_submissions to authenticated;
drop policy if exists place_submissions_owner_read on public.place_submissions;
create policy place_submissions_owner_read on public.place_submissions
 for select to authenticated using (submitted_by=(select auth.uid()));

-- No direct user writes; security-definer RPCs own all validation and rate limits.
create or replace function public.create_place_submission(
 p_city_slug text,p_name text,p_category_id text,p_lat double precision,p_lng double precision,
 p_description text default '',p_source_url text default null
) returns uuid set search_path='' language plpgsql volatile security definer as $$
declare
 v_user uuid:=(select auth.uid());
 v_city public.cities%rowtype;
 v_name text:=btrim(regexp_replace(coalesce(p_name,''),'\\s+',' ','g'));
 v_key text;
 v_location extensions.geography(POINT);
 v_id uuid;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if char_length(v_name) not between 2 and 120 then raise exception 'invalid-name' using errcode='22023'; end if;
 if p_description is null or char_length(p_description)>500 then raise exception 'invalid-description' using errcode='22023'; end if;
 if p_source_url is not null and (char_length(p_source_url)>500 or p_source_url !~* '^https?://') then raise exception 'invalid-url' using errcode='22023'; end if;
 if p_lat is null or p_lng is null or not pg_catalog.isfinite(p_lat) or not pg_catalog.isfinite(p_lng)
    or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
   raise exception 'invalid-coordinates' using errcode='22023';
 end if;
 select * into v_city from public.cities where slug=p_city_slug and status in ('launch','next');
 if not found then raise exception 'city-not-found' using errcode='22023'; end if;
 if not exists(select 1 from public.place_categories where id=p_category_id and active) then
   raise exception 'invalid-category' using errcode='22023';
 end if;
 v_location:=extensions.st_point(p_lng,p_lat)::extensions.geography;
 if not extensions.st_dwithin(v_location,v_city.center,v_city.radius_km*1000) then
   raise exception 'outside-city' using errcode='22023';
 end if;
 v_key:=public.catalogue_request_key(v_name);
 if v_key='' then raise exception 'invalid-name' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_city.id::text||':'||v_key,0));
 if (select count(*) from public.place_submissions where submitted_by=v_user and created_at>now()-interval '24 hours')>=10 then
   raise exception 'rate-limited' using errcode='22023';
 end if;
 if exists(select 1 from public.places p
    where p.city_id=v_city.id and p.status='published' and p.visibility='public'
      and public.catalogue_request_key(p.name)=v_key
      and extensions.st_dwithin(p.location,v_location,150)) then
   raise exception 'duplicate-place' using errcode='23505';
 end if;
 if exists(select 1 from public.place_submissions s where s.city_id=v_city.id and s.status='pending'
      and s.normalized_key=v_key and extensions.st_dwithin(s.location,v_location,150)) then
   raise exception 'duplicate-pending' using errcode='23505';
 end if;
 insert into public.place_submissions(city_id,submitted_by,name,normalized_key,category_id,location,description,source_url)
 values(v_city.id,v_user,v_name,v_key,p_category_id,v_location,p_description,nullif(btrim(coalesce(p_source_url,'')),''))
 returning id into v_id;
 return v_id;
end $$;

-- Public bucket means that a guessed file URL can be loaded before approval.
-- The upload UI explicitly requires the contributor's consent for that behavior.
-- No update/delete object policies: approved place photos remain stable.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('city-route-place-photos','city-route-place-photos',true,3145728,array['image/jpeg'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=array['image/jpeg'];

drop policy if exists city_route_place_photo_insert_own on storage.objects;
create policy city_route_place_photo_insert_own on storage.objects for insert to authenticated with check (
 bucket_id='city-route-place-photos'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.jpg$'
 and exists(
   select 1 from public.place_submissions s
    where s.submitted_by=(select auth.uid()) and s.status='pending'
      and name=(s.submitted_by::text||'/'||s.id::text||'.jpg')
 )
);

create or replace function public.attach_place_submission_photo(p_submission_id uuid,p_image_path text,p_confirm_rights boolean)
returns uuid set search_path='' language plpgsql volatile security definer as $$
declare v_user uuid:=(select auth.uid());v_expected text;v_object text;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_confirm_rights is distinct from true then raise exception 'photo-rights-required' using errcode='22023'; end if;
 v_expected:=v_user::text||'/'||p_submission_id::text||'.jpg';
 if p_image_path is distinct from v_expected then raise exception 'invalid-photo-path' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='city-route-place-photos' and name=v_expected) then
   raise exception 'image-not-uploaded' using errcode='22023';
 end if;
 update public.place_submissions set image_path=v_expected,image_rights_confirmed=true
 where id=p_submission_id and submitted_by=v_user and status='pending' and image_path is null;
 if not found then raise exception 'not-editable' using errcode='42501'; end if;
 return p_submission_id;
end $$;

create or replace function public.my_place_submissions()
returns table(id uuid,city_slug text,name text,status text,resolved_place_id text,created_at timestamptz)
set search_path='' language sql stable security definer as $$
 select s.id,c.slug,s.name,s.status,
   case when p.status='published' and p.visibility='public' then coalesce(p.legacy_id,p.slug) end,
   s.created_at
 from public.place_submissions s
 join public.cities c on c.id=s.city_id
 left join public.places p on p.id=s.resolved_place_id
 where s.submitted_by=(select auth.uid())
 order by s.created_at desc limit 100;
$$;

-- Private review queue; no submitter email or raw user ID returned.
create or replace function public.admin_place_submissions(p_city_slug text default 'warsaw',p_status text default 'pending')
returns table(id uuid,city_slug text,name text,category_id text,lat double precision,lng double precision,
 description text,source_url text,image_path text,status text,resolved_place_id text,created_at timestamptz)
set search_path='' language plpgsql stable security definer as $$
begin
 if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 return query
 select s.id,c.slug,s.name,s.category_id,
   extensions.st_y(s.location::extensions.geometry),extensions.st_x(s.location::extensions.geometry),
   s.description,s.source_url,s.image_path,s.status,
   case when p.status='published' then coalesce(p.legacy_id,p.slug) end,s.created_at
 from public.place_submissions s
 join public.cities c on c.id=s.city_id
 left join public.places p on p.id=s.resolved_place_id
 where c.slug=p_city_slug and (p_status='all' or s.status=p_status)
 order by s.created_at asc limit 200;
end $$;

create or replace function public.admin_review_place_submission(
 p_submission_id uuid,p_action text,p_existing_place_id text default null
) returns text set search_path='' language plpgsql volatile security definer as $$
declare v public.place_submissions%rowtype;v_existing uuid;v_place uuid;v_slug text;
begin
 if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action not in ('approve','reject','merge') then raise exception 'invalid-action' using errcode='22023'; end if;
 select * into v from public.place_submissions where id=p_submission_id for update;
 if not found then raise exception 'submission-not-found' using errcode='P0002'; end if;
 if v.status<>'pending' then raise exception 'already-reviewed' using errcode='22023'; end if;
 if p_action='reject' then
   update public.place_submissions set status='rejected',reviewed_at=now() where id=v.id;
   return 'rejected';
 end if;
 if p_action='merge' then
   if nullif(btrim(coalesce(p_existing_place_id,'')),'') is null then raise exception 'place-required' using errcode='22023'; end if;
   select p.id into v_existing from public.places p
   where p.city_id=v.city_id and p.status='published' and p.visibility='public'
     and coalesce(p.legacy_id,p.slug)=btrim(p_existing_place_id);
   if v_existing is null then raise exception 'unknown-place' using errcode='22023'; end if;
   update public.place_submissions set status='merged',resolved_place_id=v_existing,reviewed_at=now() where id=v.id;
   return btrim(p_existing_place_id);
 end if;
 -- Second duplicate guard at approval time (may have been approved since this was submitted).
 if exists(select 1 from public.places p where p.city_id=v.city_id and p.status='published'
   and p.visibility='public' and public.catalogue_request_key(p.name)=v.normalized_key
   and extensions.st_dwithin(p.location,v.location,150)) then
   raise exception 'duplicate-place-use-merge' using errcode='23505';
 end if;
 v_slug:='community-'||replace(v.id::text,'-','');
 insert into public.places(
    city_id,slug,name,category_id,location,description,minutes,cost_minor,tourist_level,food_style,
    visibility,status,created_by,image_meta,metadata
 ) values(
   v.city_id,v_slug,v.name,v.category_id,v.location,v.description,20,0,'local',
   case when v.category_id in ('restaurant','cafe','breakfast','street_food','food_hall','bakery','dessert') then 'quick' else 'none' end,
   'public','published',v.submitted_by,
   jsonb_build_object('caption',case when v.image_path is not null then 'Zdjęcie autora rekomendacji' else '' end),
   jsonb_build_object('origin','community','kind','place','communityImagePath',coalesce(v.image_path,''),'communitySubmissionId',v.id::text)
 ) returning id into v_place;
 update public.place_submissions set status='approved',resolved_place_id=v_place,reviewed_at=now() where id=v.id;
 return v_slug;
end $$;

-- Never let the default PUBLIC execute grant bypass explicit privilege decisions.
revoke execute on function
 public.create_place_submission(text,text,text,double precision,double precision,text,text),
 public.attach_place_submission_photo(uuid,text,boolean),
 public.my_place_submissions(),
 public.admin_place_submissions(text,text),
 public.admin_review_place_submission(uuid,text,text)
from public,anon,authenticated;
grant execute on function
 public.create_place_submission(text,text,text,double precision,double precision,text,text),
 public.attach_place_submission_photo(uuid,text,boolean),
 public.my_place_submissions(),
 public.admin_place_submissions(text,text),
 public.admin_review_place_submission(uuid,text,text)
to authenticated;
