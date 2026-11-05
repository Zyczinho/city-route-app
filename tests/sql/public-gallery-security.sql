-- End-to-end migrated schema/RLS smoke, isolated PostgreSQL 16; ON_ERROR_STOP required.
-- A: owner, B: unrelated user, C: moderator.
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.cities values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','krakow');
insert into public.place_submissions(id,city_id,submitted_by) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
insert into public.app_admins(user_id) values ('33333333-3333-4333-8333-333333333333');

-- DDL/permission smoke.
do $$
begin
 if not (select relrowsecurity from pg_class where oid='public.place_submission_gallery'::regclass) then
  raise exception 'new gallery table must have RLS';
 end if;
 if not has_table_privilege('authenticated','public.place_submission_gallery','SELECT') then
  raise exception 'authenticated must be able to SELECT under RLS';
 end if;
 if has_table_privilege('anon','public.place_submission_gallery','INSERT') or
    has_table_privilege('authenticated','public.place_submission_gallery','INSERT') then
  raise exception 'client must not INSERT gallery metadata directly';
 end if;
 if has_function_privilege('anon','public.attach_place_submission_gallery_photo(uuid,smallint,text,boolean)','EXECUTE') then
  raise exception 'anon should not execute gallery attachment RPC';
 end if;
end $$;

-- A may upload only to own pending submission, and attach only after Storage upload.
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
insert into storage.objects(bucket_id,name) values
 ('city-route-place-photos','11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-2.jpg'),
 ('city-route-place-photos','11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-3.jpg');
select public.attach_place_submission_gallery_photo(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,
 '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-2.jpg',true);
select public.attach_place_submission_gallery_photo(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3,
 '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-3.jpg',true);
do $$
declare denied boolean:=false;
begin
 if (select count(*) from public.place_submission_gallery)<>2 then
  raise exception 'owner should see 2 pending extras';
 end if;
 begin
  perform public.attach_place_submission_gallery_photo(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',4,
  '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-4.jpg',false);
 exception when sqlstate '22023' then denied:=true;
 end;
 if not denied then raise exception 'attachment with no rights should fail'; end if;
end $$;
reset role;

-- B must not read/attach A's pending gallery; cannot upload under A folder.
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare denied boolean:=false;
begin
 if (select count(*) from public.place_submission_gallery)<>0 then
  raise exception 'B can see A pending photos';
 end if;
 begin
  perform public.attach_place_submission_gallery_photo(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,
  '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-2.jpg',true);
 exception when sqlstate '42501' then denied:=true;
 end;
 if not denied then raise exception 'B can attach to A submission'; end if;
 denied:=false;
 begin
  insert into storage.objects(bucket_id,name) values
   ('city-route-place-photos','11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-4.jpg');
 exception when sqlstate '42501' then denied:=true;
 end;
 if not denied then raise exception 'B can insert into A folder'; end if;
end $$;
reset role;

-- Anon cannot see pending extras or call the write RPC.
set role anon;
set request.jwt.claim.sub='';
do $$
begin
 if (select count(*) from public.place_submission_gallery)<>0 then
  raise exception 'anon sees pending photos';
 end if;
end $$;
reset role;

-- C is admin, can list and reject the third photo before approving.
set role authenticated;
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare n integer;
begin
 select count(*) into n from public.admin_place_submission_gallery('krakow','pending');
 if n<>2 then raise exception 'moderator listing did not return both photos: %',n; end if;
end $$;
select public.admin_moderate_place_gallery_photo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3,false);
reset role;

-- Simulate legacy approval flow: canonical public place created, submission approved.
insert into public.places(id,status,visibility,metadata)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','published','public',
 jsonb_build_object('communitySubmissionId','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));
update public.place_submissions set status='approved'
 where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

set role anon;
do $$
declare n integer;
begin
 select count(*) into n from public.place_submission_gallery;
 if n<>1 then raise exception 'anon should see ONLY approved slot 2, saw %',n; end if;
 if (select count(*) from public.place_submission_gallery where position=3)<>0 then
  raise exception 'rejected slot 3 was exposed';
 end if;
end $$;
reset role;

do $$
begin
 if (select count(*) from public.place_submission_gallery where moderation_status='approved')<>1 then
  raise exception 'approval trigger failed for slot 2';
 end if;
 if (select count(*) from public.place_submission_gallery where moderation_status='rejected')<>1 then
  raise exception 'rejected slot not preserved';
 end if;
end $$;
select 'GALLERY MIGRATION / RLS / MODERATION SMOKE PASS' as verdict;
