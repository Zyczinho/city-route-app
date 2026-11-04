\set ON_ERROR_STOP on
\echo '015 FRIENDS isolated database assertions'
do $nickname$
begin
 if (select count(distinct lower(nickname)) from public.profiles)<>3 then
   raise exception 'Historical case-insensitive nickname collision not repaired';
 end if;
 if public.nickname_available(' kUbA ') then
   raise exception 'Nickname availability failed case-fold check';
 end if;
 if not public.nickname_available('CompletelyUnique123') then
   raise exception 'New nickname should be available';
 end if;
 begin
   update public.profiles set nickname='KUBA' where id='cccccccc-0000-4000-8000-000000000003';
   raise exception 'Duplicate nickname update was permitted';
 exception when unique_violation then null;
 end;
end $nickname$;
\echo 'PASS case-insensitive uniqueness and historical duplicate repair'

-- The post-signup trigger always produces a unique fallback nickname.
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into auth.users(id) values ('dddddddd-0000-4000-8000-000000000004');
do $signup$
begin
 if not exists(select 1 from public.profiles where id='dddddddd-0000-4000-8000-000000000004' and nickname='u_dddddddd-0000-4000-8000-000000000004') then
   raise exception 'Generated unique nickname is missing';
 end if;
end $signup$;
\echo 'PASS new users without nickname get collision-safe identity'

select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
set role authenticated;
do $owner$
declare peer uuid:='cccccccc-0000-4000-8000-000000000003';
begin
 if (select count(*) from public.find_explorers('Ann',12))<>1 then
   raise exception 'Nickname lookup did not return expected user';
 end if;
 if public.send_friend_request(peer)<>'pending' then
   raise exception 'Friend invitation failed';
 end if;
 begin
  perform public.send_friend_request('aaaaaaaa-0000-4000-8000-000000000001');
  raise exception 'Self-invitation was allowed';
 exception when invalid_parameter_value then null;
 end;
 begin
  insert into public.friend_connections(user_low,user_high,requested_by)
  values ('aaaaaaaa-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000001');
  raise exception 'Browser role could bypass protected RPCs';
 exception when insufficient_privilege then null;
 end;
end $owner$;
reset role;
\echo 'PASS nickname search, invite, no self-invites and no direct writes'

select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-000000000004',false);
set role authenticated;
do $outsider$
begin
 if exists(select 1 from public.friend_connections) then
  raise exception 'Unrelated account could read invitations'; end if;
end $outsider$;
reset role;

select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',false);
set role authenticated;
do $recipient$
begin
 if (select count(*) from public.my_friends() where friend_status='pending' and not requested_by_me)<>1 then
   raise exception 'Incoming invite not visible';
 end if;
 if public.respond_friend_request('aaaaaaaa-0000-4000-8000-000000000001',true)<>'accepted' then
   raise exception 'Invite acceptance failed';
 end if;
end $recipient$;
reset role;
\echo 'PASS only recipient can accept and outsider sees no private friend links'

select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
set role authenticated;
do $accepted$
begin
 if (select count(*) from public.my_friends() where friend_status='accepted')<>1 then
   raise exception 'Accepted friend not visible to sender';
 end if;
 if not public.remove_friend('cccccccc-0000-4000-8000-000000000003') then
   raise exception 'Unfriend failed';
 end if;
 if exists(select 1 from public.my_friends()) then
   raise exception 'Friend link not removed';
 end if;
end $accepted$;
reset role;
\echo 'PASS mutual friendship and removal'

set role anon;
do $anonymous$
begin
 begin
  perform public.find_explorers('Ku',12);
  raise exception 'Anonymous nickname search permitted';
 exception when insufficient_privilege then null;
 end;
end $anonymous$;
reset role;
\echo 'PASS anonymous user cannot enumerate private friend search'
