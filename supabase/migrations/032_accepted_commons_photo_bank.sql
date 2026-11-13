-- PHOTO BANK P0 #176: Wikimedia photos accepted during public place submission.
-- Existing community storage bucket is reused; private places never upload.
-- Must be applied only after 025/026 migrations already live (branch PR #163).
-- This deliberately never copies Google / Tripadvisor / Instagram images.
alter table public.place_submissions
 add column if not exists licensed_photo_credit jsonb;

-- The upload has to exist in the same preexisting secure user/submission path,
-- and the source metadata must reference a Wikimedia Commons image with free
-- licence + artist attribution. The moderator still approves the whole place.
create or replace function public.attach_place_submission_licensed_photo(
 p_submission_id uuid,p_image_path text,p_credit jsonb
) returns uuid set search_path='' language plpgsql volatile security definer as $$
declare
 v_user uuid:=(select auth.uid());
 v_expected text;
 v_license text;
 v_url text;
 v_author text;
 v_source text;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_credit is null or jsonb_typeof(p_credit)<>'object' or
    p_credit->>'via' <> 'Wikimedia Commons' then
   raise exception 'photo-rights-required' using errcode='22023';
 end if;
 v_source:=coalesce(p_credit->>'source','');
 v_license:=coalesce(p_credit->>'license','');
 v_url:=coalesce(p_credit->>'licenseUrl','');
 v_author:=btrim(coalesce(p_credit->>'author',''));
 if char_length(v_source)>500 or
    v_source !~* '^https://commons[.]wikimedia[.]org/wiki/File:[^[:space:]]+$' or
    char_length(v_author) not between 1 and 120 or
    char_length(v_license)>50 or
    v_license !~* '^(CC[[:space:]]*BY(-SA)?[[:space:]]*[1-4]([.][0-9])?([[:space:]]+[a-z]{2})?|CC0([[:space:]]*1[.]0)?|Public domain|PD-(old|self|US))$' or
    (v_license ~* '^CC[[:space:]]*BY' and v_url='') or
    (v_url<>'' and (char_length(v_url)>220 or
     v_url !~* '^https://creativecommons[.]org/(licenses/by(-sa)?/|publicdomain/)')) then
   raise exception 'photo-rights-required' using errcode='22023';
 end if;
 v_expected:=v_user::text||'/'||p_submission_id::text||'.jpg';
 if p_image_path is distinct from v_expected then
   raise exception 'invalid-photo-path' using errcode='22023';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='city-route-place-photos' and name=v_expected) then
   raise exception 'image-not-uploaded' using errcode='22023';
 end if;
 update public.place_submissions set
  image_path=v_expected,image_rights_confirmed=true,
  licensed_photo_credit=jsonb_build_object(
   'author',v_author,'license',v_license,'licenseUrl',nullif(v_url,''),
   'source',v_source,'via','Wikimedia Commons')
 where id=p_submission_id and submitted_by=v_user and status='pending' and image_path is null;
 if not found then raise exception 'not-editable' using errcode='42501'; end if;
 return p_submission_id;
end $$;

-- Moderator can verify artist, source, licence before approval,
-- without exposing pending submissions to regular visitors.
create or replace function public.admin_place_submission_photo_credits(
 p_city_slug text default 'warsaw',p_status text default 'pending'
) returns jsonb set search_path='' language plpgsql stable security definer as $$
declare output jsonb;
begin
 if not public.is_app_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_object_agg(s.id::text,s.licensed_photo_credit),'{}'::jsonb)
 into output
 from public.place_submissions s
 join public.cities c on c.id=s.city_id
 where c.slug=p_city_slug and (p_status='all' or s.status=p_status)
   and s.licensed_photo_credit is not null;
 return output;
end $$;

-- Persist photo credit into the already-used places.image_meta.credit
-- when the moderator publishes the place. Owner-submitted photos keep
-- their previous caption and no false Wikimedia attribution.
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
 -- Acquire the same lock as submission. Concurrent submit/approve operations must not
 -- publish two canonical records with the same name and nearby coordinates.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v.city_id::text||':'||v.normalized_key,0));
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
   jsonb_build_object('caption',case when v.image_path is null then '' when v.licensed_photo_credit is not null then 'Zdjęcie Wikimedia Commons (zmniejszone i przekonwertowane do JPEG)' else 'Zdjęcie autora rekomendacji' end,'credit',v.licensed_photo_credit),
   jsonb_build_object('origin','community','kind','place','communityImagePath',coalesce(v.image_path,''),'communitySubmissionId',v.id::text)
 ) returning id into v_place;
 update public.place_submissions set status='approved',resolved_place_id=v_place,reviewed_at=now() where id=v.id;
 return v_slug;
end $$;

revoke all on function public.attach_place_submission_licensed_photo(uuid,text,jsonb) from public;
revoke all on function public.admin_place_submission_photo_credits(text,text) from public;
grant execute on function public.attach_place_submission_licensed_photo(uuid,text,jsonb) to authenticated;
grant execute on function public.admin_place_submission_photo_credits(text,text) to authenticated;
