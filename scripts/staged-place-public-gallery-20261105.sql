-- PLACE-PUBLIC-GALLERY-059 — STAGED. Do not apply automatically to production.
-- Extends migration 014's single-cover workflow with up to four extra JPGs.
-- Review with the founder and test RLS/storage permissions in an isolated DB first.
-- Existing submission.image_path (the cover), original upload path, grants and moderation RPC
-- are preserved. Images are consented for PUBLIC use; this project's EXISTING bucket is public,
-- so pending files are technically readable via a known direct URL before listing approval.
begin;

create table if not exists public.place_submission_gallery (
  submission_id uuid not null references public.place_submissions(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 2 and 5),
  image_path text not null unique,
  rights_confirmed boolean not null default true check (rights_confirmed),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  primary key (submission_id,position),
  constraint place_gallery_exact_owner_path check (
    image_path = submitted_by::text || '/' || submission_id::text || '-' || position::text || '.jpg'
  )
);
create index if not exists place_submission_gallery_owner_idx
  on public.place_submission_gallery(submitted_by);
create index if not exists place_submission_gallery_review_idx
  on public.place_submission_gallery(moderation_status,submission_id);

alter table public.place_submission_gallery enable row level security;
revoke all on table public.place_submission_gallery from public,anon,authenticated;
grant select on table public.place_submission_gallery to anon,authenticated;

-- The owner can inspect their own pending uploads; signed-out visitors cannot.
create policy place_gallery_owner_select on public.place_submission_gallery
  for select to authenticated
  using (submitted_by=(select auth.uid()));

-- Public discovery only includes photos explicitly approved with an approved submission
-- AND a currently published, publicly visible canonical place.
create policy place_gallery_public_select on public.place_submission_gallery
  for select to anon,authenticated
  using (
    moderation_status='approved'
    and exists (
      select 1 from public.place_submissions s
      join public.places p on p.id=s.resolved_place_id
      where s.id=place_submission_gallery.submission_id
        and s.status='approved'
        and p.status='published'
        and p.visibility='public'
    )
  );

-- Keep existing 014 cover policy untouched. Only slots 2,3,4,5 are newly uploadable.
create policy city_route_place_gallery_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id='city-route-place-photos'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (
      select 1 from public.place_submissions s
      where s.submitted_by=(select auth.uid())
        and s.status='pending'
        and name in (
          s.submitted_by::text||'/'||s.id::text||'-2.jpg',
          s.submitted_by::text||'/'||s.id::text||'-3.jpg',
          s.submitted_by::text||'/'||s.id::text||'-4.jpg',
          s.submitted_by::text||'/'||s.id::text||'-5.jpg'
        )
    )
  );

-- Metadata is registered only after verifying exact object path, ownership, status and consent.
-- No client INSERT/UPDATE/DELETE grants on place_submission_gallery.
create or replace function public.attach_place_submission_gallery_photo(
 p_submission_id uuid,p_position smallint,p_image_path text,p_confirm_rights boolean
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid());v_expected text;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_confirm_rights is distinct from true then raise exception 'photo-rights-required' using errcode='22023'; end if;
 if p_position is null or p_position not between 2 and 5 then raise exception 'invalid-photo-position' using errcode='22023'; end if;
 v_expected:=v_user::text||'/'||p_submission_id::text||'-'||p_position::text||'.jpg';
 if p_image_path is distinct from v_expected then raise exception 'invalid-photo-path' using errcode='22023'; end if;
 if not exists(select 1 from public.place_submissions s
    where s.id=p_submission_id and s.submitted_by=v_user and s.status='pending') then
   raise exception 'not-editable' using errcode='42501';
 end if;
 if not exists(select 1 from storage.objects o
    where o.bucket_id='city-route-place-photos' and o.name=v_expected) then
   raise exception 'image-not-uploaded' using errcode='22023';
 end if;
 insert into public.place_submission_gallery
  (submission_id,submitted_by,position,image_path,rights_confirmed)
 values (p_submission_id,v_user,p_position,v_expected,true)
 on conflict (submission_id,position) do nothing;
 if not exists(select 1 from public.place_submission_gallery g where g.submission_id=p_submission_id
    and g.position=p_position and g.image_path=v_expected and g.submitted_by=v_user) then
   raise exception 'photo-slot-conflict' using errcode='23505';
 end if;
 return p_submission_id;
end;
$$;
revoke all on function public.attach_place_submission_gallery_photo(uuid,smallint,text,boolean) from public,anon;
grant execute on function public.attach_place_submission_gallery_photo(uuid,smallint,text,boolean) to authenticated;

-- Each pending photo can be excluded by admin BEFORE the entire place is approved.
create or replace function public.admin_moderate_place_gallery_photo(
 p_submission_id uuid,p_position smallint,p_allow boolean
) returns text
language plpgsql security definer set search_path=''
as $$
declare v_row public.place_submissions%rowtype;
begin
 if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into v_row from public.place_submissions where id=p_submission_id for update;
 if not found or v_row.status<>'pending' then raise exception 'not-editable' using errcode='42501'; end if;
 update public.place_submission_gallery
   set moderation_status=case when p_allow is true then 'pending' else 'rejected' end
 where submission_id=p_submission_id and position=p_position;
 if not found then raise exception 'image-not-uploaded' using errcode='22023'; end if;
 return case when p_allow is true then 'pending' else 'rejected' end;
end;
$$;
revoke all on function public.admin_moderate_place_gallery_photo(uuid,smallint,boolean) from public,anon;
grant execute on function public.admin_moderate_place_gallery_photo(uuid,smallint,boolean) to authenticated;

-- Admin list can read pending photos without broad table SELECT permissions.
create or replace function public.admin_place_submission_gallery(p_city_slug text default 'warsaw',p_status text default 'pending')
returns table(submission_id uuid,position smallint,image_path text,moderation_status text)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 return query
 select g.submission_id,g.position,g.image_path,g.moderation_status
 from public.place_submission_gallery g
 join public.place_submissions s on s.id=g.submission_id
 join public.cities c on c.id=s.city_id
 where c.slug=p_city_slug and (p_status='all' or s.status=p_status)
 order by s.created_at,g.position limit 900;
end;
$$;
revoke all on function public.admin_place_submission_gallery(text,text) from public,anon;
grant execute on function public.admin_place_submission_gallery(text,text) to authenticated;

-- Existing admin_review_place_submission approves the canonical place; this synchronous
-- trigger flips only non-rejected photos, in the same transaction, no parallel review state.
create or replace function public.approve_place_submission_gallery_trigger()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' then
   update public.place_submission_gallery
     set moderation_status='approved'
   where submission_id=new.id and moderation_status='pending';
 end if;
 return new;
end;
$$;
drop trigger if exists place_submission_gallery_approval on public.place_submissions;
create trigger place_submission_gallery_approval
 after update of status on public.place_submissions
 for each row when (new.status='approved' and old.status is distinct from 'approved')
 execute function public.approve_place_submission_gallery_trigger();

commit;

-- Post-deployment read-only checks (never infer success from CLI history):
-- select relrowsecurity from pg_class where oid='public.place_submission_gallery'::regclass;
-- select * from pg_policies where tablename='place_submission_gallery';
-- select * from pg_policies where schemaname='storage' and policyname='city_route_place_gallery_insert_own';
-- select count(*) from public.place_submission_gallery;
-- Verify user A cannot see user B pending uploads, user B cannot attach user A's paths,
-- unapproved gallery never appears in catalogue, admin reject slot 3 before approving,
-- and previously approved single-photo submissions still display the original cover.
