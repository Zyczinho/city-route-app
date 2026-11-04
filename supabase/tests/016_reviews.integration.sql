\set ON_ERROR_STOP on
\echo '016 City Route reviews & feedback isolated database contract'
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
set role authenticated;
select public.rate_visited_place('warsaw','example',5,'Bardzo ciekawe miejsce');
select public.rate_visited_place('warsaw','example',4,'Po drugiej wizycie') ;
insert into public.route_ratings(route_id,user_id,rating)
values ('33333333-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002',5);
select public.set_route_feedback('warsaw','33333333-0000-4000-8000-000000000003','Świetna trasa!');
do $visitor$
begin
 if (select count(*) from public.place_reviews where user_id=auth.uid())<>1 then
  raise exception 'one rating per account and place not enforced';
 end if;
 if not exists(select 1 from public.place_reviews where rating=4 and not visit_verified) then
  raise exception 'own rating not editable or misleadingly marked verified';
 end if;
 begin
   perform public.my_route_feedback('33333333-0000-4000-8000-000000000003');
   raise exception 'non-author can read private route feedback';
 exception when insufficient_privilege then null;
 end;
end $visitor$;
reset role;
\echo 'PASS visitor can edit own unverified review and leave private route feedback'

select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',false);
set role authenticated;
select public.rate_visited_place('warsaw','example',5,'Też polecam');
do $outsider$
declare
 v record;
begin
 if exists(select 1 from public.route_ratings) then
  raise exception 'outsider could read other user private route rating';
 end if;
 select * into v from public.city_route_place_scores('warsaw');
 if v.review_count<>2 or v.average_rating<>4.50 then
  raise exception 'own aggregate invalid: expected two reviews 4.50, got % / %',v.review_count,v.average_rating;
 end if;
 if v.sort_score>=4.5 or v.sort_score<=4.0 then
  raise exception 'Bayesian score not smoothed';
 end if;
 begin
  perform public.my_route_feedback('33333333-0000-4000-8000-000000000003');
  raise exception 'third-party account could read author feedback';
 exception when insufficient_privilege then null;
 end;
end $outsider$;
reset role;
\echo 'PASS public aggregates separate, personal comments private and small count smoothed'

select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
set role authenticated;
do $author$
begin
 begin
  perform public.rate_visited_place('warsaw','example',1,'Zaniżanie własnej oceny');
  raise exception 'self-rating place was allowed';
 exception when insufficient_privilege then null;
 end;
 if (select count(*) from public.my_route_feedback('33333333-0000-4000-8000-000000000003'))<>1 then
  raise exception 'route creator cannot see feedback';
 end if;
 if not exists(select 1 from public.my_route_feedback('33333333-0000-4000-8000-000000000003') where feedback='Świetna trasa!' and rating=5) then
  raise exception 'route author did not see original note or score';
 end if;
end $author$;
reset role;
\echo 'PASS creator cannot rate their own place and sees private route feedback'

set role anon;
do $anon$
begin
 begin
  perform public.rate_visited_place('warsaw','example',2,'anon');
  raise exception 'anon could rate without account';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.my_route_feedback('33333333-0000-4000-8000-000000000003');
  raise exception 'anon could read route private notes';
 exception when insufficient_privilege then null;
 end;
end $anon$;
reset role;
\echo 'PASS unauthenticated users cannot rate or read private text'
