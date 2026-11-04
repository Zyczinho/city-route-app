\set ON_ERROR_STOP on
\echo '014 integration test: all operations are against an isolated temporary DB'
\set user_a 'aaaaaaaa-0000-4000-8000-000000000001'
\set user_b 'bbbbbbbb-0000-4000-8000-000000000002'
\set admin 'cccccccc-0000-4000-8000-000000000003'

select set_config('request.jwt.claim.sub', :'user_a',false);
set role authenticated;
select public.create_place_submission('warsaw','Hidden View','viewpoint',52.235,21.02,'A genuine viewpoint',null) as first_id \gset
do $$
begin
  if (select count(*) from public.place_submissions where status='pending')<>1 then
    raise exception 'owner must see own pending proposal'; end if;
  if (select count(*) from public.places where name='Hidden View')<>0 then
    raise exception 'proposed place must not be public before approval'; end if;
  begin
    perform public.create_place_submission('warsaw','Hidden View','viewpoint',52.235,21.02);
    raise exception 'duplicate pending was allowed';
  exception when unique_violation then null;
  end;
  begin
    perform public.create_place_submission('warsaw','Impossible','viewpoint',120,21);
    raise exception 'invalid coordinates were allowed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_place_submission('warsaw','Too far away','viewpoint',50,19);
    raise exception 'out-of-city place was allowed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_place_submission('warsaw','Unknown category','unrecognized',52.23,21);
    raise exception 'invalid category was allowed';
  exception when invalid_parameter_value then null;
  end;
end $$;
-- Unlimited submissions: 12 more distinct public candidates from the same user must be allowed,
-- while the author's first pending place remains hidden from everyone else.
do $
declare i integer;
begin
 for i in 1..12 loop
   perform public.create_place_submission(
     'warsaw',format('Independent discovery %s',i),'viewpoint',
     52.242 + i * 0.0001,21.031 + i * 0.0001,'Distinct community candidate',null
   );
 end loop;
 if (select count(*) from public.place_submissions where submitted_by=auth.uid() and status='pending')<>13 then
   raise exception 'public proposals were incorrectly limited'; end if;
end $;
\echo 'PASS: contributor may submit more than ten different places without quotas'
-- The previously deployed "Poproś o miejsce" RPC also loses its old 20/day quota in 014.
do $
declare i integer;
begin
 for i in 1..21 loop
   perform public.create_catalogue_request('warsaw','place',format('Missing item %s',i));
 end loop;
 if (select count(*) from public.catalogue_requests where created_by=auth.uid())<>21 then
   raise exception 'public request proposals were incorrectly capped at 20/day'; end if;
end $;
\echo 'PASS: legacy catalogue requests also have no daily quota'



\echo 'PASS: owner proposal pending, duplicate and coordinate validation'

reset role;
select set_config('request.jwt.claim.sub', :'user_b',false);
set role authenticated;
do $$
begin
  if exists(select 1 from public.place_submissions) then
    raise exception 'non-author can read pending submissions'; end if;
  begin
    perform public.create_place_submission('warsaw','Hidden View','viewpoint',52.235,21.02);
    raise exception 'another author was allowed to duplicate a pending community place';
  exception when unique_violation then null;
  end;
  begin
    perform public.admin_review_place_submission((select id from public.place_submissions),'approve');
    raise exception 'non-admin allowed moderation';
  exception when insufficient_privilege then null;
  end;
end $$;
\echo 'PASS: RLS hides pending proposal and blocks normal-user approval'

reset role;
select set_config('request.jwt.claim.sub', :'admin',false);
set role authenticated;
select public.admin_review_place_submission(:'first_id'::uuid,'approve') as published_id \gset
do $$
begin
 if (select count(*) from public.places where name='Hidden View' and status='published')<>1 then
   raise exception 'approval did not publish a real place';end if;
 if (select count(*) from public.admin_place_submissions('warsaw','approved'))<>1 then
   raise exception 'admin queue did not transition to approved';end if;
end $$;
\echo 'PASS: admin-only approval creates the canonical published place'

reset role;
select set_config('request.jwt.claim.sub', :'user_b',false);
set role authenticated;
do $$
begin
 if (select count(*) from public.places where name='Hidden View')<>1 then
   raise exception 'other logged-in users cannot see approved public places'; end if;
end $$;
reset role;
set role anon;
do $$
begin
 if (select count(*) from public.places where name='Hidden View')<>1 then
   raise exception 'anon visitors cannot read approved public place'; end if;
 begin
   perform public.create_place_submission('warsaw','Anonymous place','viewpoint',52.235,21.03);
   raise exception 'anonymous user was allowed to create submission';
 exception when insufficient_privilege then null;
 end;
end $$;
\echo 'PASS: public read after approval, anonymous writes blocked'

reset role;
select set_config('request.jwt.claim.sub', :'user_a',false);
set role authenticated;
do $$
begin
 begin
   perform public.create_place_submission('warsaw','Hidden View','viewpoint',52.235,21.02);
   raise exception 'published duplicate was allowed';
 exception when unique_violation then null;
 end;
end $$;
select public.create_place_submission('warsaw','Original Photograph','viewpoint',52.24,21.03,'Owner image',null) as photo_sid \gset
do $$
begin
 begin
   perform public.attach_place_submission_photo((select id from public.place_submissions
       where name='Original Photograph'),'not/a/path.jpg',true);
   raise exception 'arbitrary photo path was accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
insert into storage.objects(bucket_id,name)
values('city-route-place-photos',:'user_a'||'/'||:'photo_sid'||'.jpg');
select public.attach_place_submission_photo(:'photo_sid'::uuid,:'user_a'||'/'||:'photo_sid'||'.jpg',true);
do $$
begin
 if not exists(select 1 from public.place_submissions where name='Original Photograph'
       and image_rights_confirmed and image_path is not null) then
    raise exception 'photo consent did not attach image';end if;
end $$;
\echo 'PASS: explicit own-photo rights and canonical user/object path'

reset role;
select set_config('request.jwt.claim.sub', :'user_b',false);
set role authenticated;
do $$
begin
 begin
   insert into storage.objects(bucket_id,name)
   values('city-route-place-photos','bbbbbbbb-0000-4000-8000-000000000002/random.jpg');
   raise exception 'unauthorized file upload was permitted';
 exception when insufficient_privilege then null;
 end;
end $$;
\echo 'PASS: storage policy rejects uploads without own pending submission'

reset role;
select set_config('request.jwt.claim.sub', :'admin',false);
set role authenticated;
select public.admin_review_place_submission(:'photo_sid'::uuid,'approve') as photo_published \gset
do $$
begin
 if not exists(select 1 from public.admin_place_submissions('warsaw','approved') s
    join public.places p on p.slug=s.resolved_place_id
   where s.name='Original Photograph' and s.status='approved' and p.metadata->>'communityImagePath'=s.image_path) then
   raise exception 'approved photo provenance path not visible to catalogue'; end if;
end $$;
\echo 'PASS: approved photo metadata stored only after moderation'

reset role;
\echo 'PASS: all PostgreSQL/PostGIS migration 014 integration assertions succeeded'
