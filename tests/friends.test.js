import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {nicknameKey,createFriendsClient,normalizeFriendsError} from '../friends-client.js';
const load=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const fake=()=>{const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push({name,args});return {data:name==='nickname_available'?true:[],error:null};}}};};

test('find friends searches case insensitive nick without exposing email',async()=>{
 const f=fake(),api=createFriendsClient(f.client);
 assert.equal(nicknameKey('  Łukasz  '),'łukasz');
 assert.deepEqual(await api.search('a'),[],'short search must not reach the database');
 await api.search(' An ');
 assert.deepEqual(f.calls[0],{name:'find_explorers',args:{p_query:'An',p_limit:12}});
 await api.request('uuid-1');await api.respond('uuid-2',true);await api.respond('uuid-2',false);await api.remove('uuid-1');
 assert.deepEqual(f.calls.slice(1).map(c=>c.name),['send_friend_request','respond_friend_request','respond_friend_request','remove_friend']);
 assert.equal(await api.available('  Kasia  '),true);
 assert.deepEqual(f.calls.at(-1),{name:'nickname_available',args:{p_nickname:'Kasia'}});
});

test('unique nickname and friendship SQL enforce authentication and private relations',async()=>{
 const s=await load('supabase/migrations/015_friends_unique_nicknames.sql');
 for(const token of ['profiles_nickname_ci_unique','lower(btrim(nickname))','friend_connections_participant_read',
   'create or replace function public.nickname_available','create or replace function public.find_explorers',
   'create or replace function public.my_friends','create or replace function public.send_friend_request',
   'create or replace function public.respond_friend_request','create or replace function public.remove_friend',
   'if v_user is null','requested_by=v_user','requested_by=v_user','least(v_user,p_user_id)',
   'grant select on public.friend_connections to authenticated'])
  assert.ok(s.includes(token),'Missing unique nickname or friendship constraint: '+token);
 assert.ok(!/grant insert|grant update|grant delete/i.test(s),'friendships must not be directly writable by the client');
 assert.match(s,/create unique index if not exists profiles_nickname_ci_unique/);
 assert.match(s,/requested_by in \(user_low,user_high\)/);
});

test('friends UI is discoverable and safely guarded by account session',async()=>{
 const [hub,ui,auth,sw,index,build]=await Promise.all(['community-hub.js','friends.js','auth-enhancements.js','service-worker.js','index.html','scripts/build.mjs'].map(load));
 assert.match(hub,/\['#routes\/community\/friends','Znajomi'\]/);
 assert.match(ui,/supabase\.auth\.getSession/);
 assert.match(ui,/Znajomi po zalogowaniu/);
 assert.match(ui,/createFriendsClient\(supabase\)/);
 assert.match(auth,/nickname_available/);
 assert.match(auth,/Ten nick jest zajęty/);
 assert.match(sw,/friends-client\.js/);
 assert.match(index,/friends\.js\?v=\d+/);
 assert.match(build,/'friends\.js'/);
 for(const path of ['friends.js','friends-client.js','auth-enhancements.js','community-hub.js'])execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});
