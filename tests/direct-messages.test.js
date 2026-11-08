import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {directPair,directChatHref,validDirectUserId,createDirectMessagesClient} from '../direct-messages-client.js';
const me='aaaaaaaa-0000-4000-8000-000000000001',friend='bbbbbbbb-0000-4000-8000-000000000002';
test('Private DM pair is sorted and does not accept same user, malformed UUID or URL traversal',()=>{
 assert.deepEqual(directPair(friend,me),{user_low:me,user_high:friend});
 assert.deepEqual(directPair(me,friend),{user_low:me,user_high:friend});
 for(const id of [me,'../../admin','<svg onload=1>','','not-a-uuid']){
  if(id!==me)assert.equal(validDirectUserId(id),false);
  assert.equal(directPair(me,id),null);
 }
 assert.equal(directChatHref(friend),'#routes/community/dm/'+friend);
 assert.equal(directChatHref('../../etc'),null);
});
test('Client sends only permitted participant pair, author and trimmed message, never created_at',async()=>{
 const calls=[],chain={select(){return this;},eq(k,v){calls.push(['eq',k,v]);return this;},order(){return this;},limit(){return Promise.resolve({data:[],error:null});},
  insert(row){calls.push(['insert',row]);return Promise.resolve({error:null});},or(){return this;}};
 const api=createDirectMessagesClient({from(name){assert.equal(name,'direct_messages');return chain;}});
 await api.send(friend,me,' Hej! ');
 assert.deepEqual(calls.at(-1),['insert',{user_low:me,user_high:friend,sender_id:friend,body:'Hej!'}]);
 await assert.rejects(api.send(me,me,'x'),/invalid-message/);
 await assert.rejects(api.send(me,friend,'  '),/invalid-message/);
 await assert.rejects(api.send(me,friend,'a'.repeat(2001)),/invalid-message/);
 await api.thread(me,friend);
 assert.deepEqual(calls.filter(x=>x[0]==='eq').slice(-2),[['eq','user_low',me],['eq','user_high',friend]]);
});
test('Postgres RLS restricts reads to participants and inserts to accepted friends only',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/022_direct_messages.sql',import.meta.url),'utf8');
 for(const key of ['user_low < user_high','sender_id in (user_low,user_high)','enable row level security',
  'revoke all on public.direct_messages from public,anon,authenticated',
  'grant insert(user_low,user_high,sender_id,body)',
  'direct_messages_participants_read','direct_messages_accepted_friends_insert',
  "fc.status='accepted'","(select auth.uid())",'supabase_realtime'])assert.ok(sql.includes(key),key);
 assert.doesNotMatch(sql,/security definer|using \(true\)|grant (all|insert) on public.direct_messages to anon/i);
});
test('Profile and Community provide the same purple DM CTA and a working conversation form',async()=>{
 const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const [social,community,friends,hub,index,sw,build]=await Promise.all(['social-routes-enhancements.js','community-enhancements.js','friends.js','community-hub.js','index.html','service-worker.js','scripts/build.mjs'].map(load));
 for(const marker of ['data-author-dm','Wyślij wiadomość','directChatHref'])assert.ok(social.includes(marker),marker);
 for(const marker of ["view:'dm'","renderDM(", "data-community-form=\"direct-message\"","direct_messages","sendDirectMessage(", "Ostatnie rozmowy"])assert.ok(community.includes(marker),marker);
 assert.ok(friends.includes('Wyślij wiadomość'));
 assert.ok(hub.includes("/dm/"));
 assert.ok(index.includes('community-enhancements.js?v=22'));
 assert.ok(sw.includes('direct-messages-client.js'));
 assert.ok(build.includes('direct-messages-client.js'));
 for(const f of ['community-enhancements.js','social-routes-enhancements.js','direct-messages-client.js','friends.js'])execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
});
