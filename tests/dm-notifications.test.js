import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {computeUnread,shouldNotifyDirectMessage,highestMessageId} from '../dm-notifications-model.js';
const me='aaaaaaaa-0000-4000-8000-000000000001',alex='bbbbbbbb-0000-4000-8000-000000000002',bet='cccccccc-0000-4000-8000-000000000003';
const entry=(id,from,to)=>({id,user_low:[from,to].sort()[0],user_high:[from,to].sort()[1],sender_id:from});
test('Unread counter excludes self-sent, previously read and nonparticipant DMs',()=>{
 const msgs=[entry(1,alex,me),entry(2,me,alex),entry(3,alex,me),entry(4,bet,me),entry(5,alex,bet)];
 const receipts=[{reader_id:me,peer_id:alex,last_read_message_id:1}];
 const result=computeUnread(msgs,receipts,me);
 assert.equal(result.total,2);
 assert.equal(result.byPeer.get(alex),1);
 assert.equal(result.byPeer.get(bet),1);
 assert.equal(computeUnread(msgs,[{reader_id:me,peer_id:alex,last_read_message_id:3},{reader_id:me,peer_id:bet,last_read_message_id:4}],me).total,0);
});
test('Alert only for incoming messages outside actively viewed thread',()=>{
 const m=entry(9,alex,me);
 assert.equal(shouldNotifyDirectMessage(m,me,'#plan'),true);
 assert.equal(shouldNotifyDirectMessage(m,me,'#routes/community/dm/'+alex),false);
 assert.equal(shouldNotifyDirectMessage(entry(9,me,alex),me,'#plan'),false);
 assert.equal(shouldNotifyDirectMessage(entry(9,alex,bet),me,'#plan'),false);
});
test('Read cursor advances to highest actual message id',()=>{
 assert.equal(highestMessageId([{id:1},{id:7},{id:2}]),7);
 assert.equal(highestMessageId([]),0);
 assert.equal(highestMessageId([{id:Infinity},{id:-1},{id:'NaN'}]),0);
});
test('Read receipts use participant-only RLS with no anonymous access or privileged functions',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/023_direct_message_reads.sql',import.meta.url),'utf8');
 for(const value of ['enable row level security','revoke all on public.direct_message_reads from public,anon,authenticated',
 'direct_message_reads_owner_select','direct_message_reads_owner_insert','direct_message_reads_owner_update',
 'reader_id=(select auth.uid())','dm.id=direct_message_reads.last_read_message_id','grant update (last_read_message_id)'])assert.ok(sql.includes(value),value);
 assert.doesNotMatch(sql,/security definer|grant all|grant.*to anon/i);
});
test('Unread badge and Notification opt-in are wired without background-push promises',async()=>{
 const file=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const [runtime,ui,hub,html,worker,build]=await Promise.all(['dm-notifications.js','direct-messages-ui.js','community-hub.js','index.html','service-worker.js','scripts/build.mjs'].map(file));
 for(const t of ['postgres_changes','direct_messages','showNotification','requestPermission','data-enable-dm-notifications','dm-unread-badge','aria-live','dm-notification','refreshUnread'])assert.ok(runtime.includes(t),t);
 for(const t of ['markDirectThreadRead','unreadForPeer','data-dm-peer'])assert.ok(ui.includes(t),t);
 assert.ok(hub.includes('Czaty'));
 assert.ok(html.includes('dm-notifications.js'));
 assert.ok(worker.includes('dm-notifications.js'));
 assert.ok(build.includes("'dm-notifications.js'"));
 assert.ok(worker.includes("notificationclick"));
});

test('Read receipts insert or update only cursor, never broader identity columns',async()=>{
 const {createDirectMessagesClient}=await import('../direct-messages-client.js');
 const me='aaaaaaaa-0000-4000-8000-000000000001',peer='bbbbbbbb-0000-4000-8000-000000000002';
 const records=[];
 let existing=null;
 const table={
  select(){return this;},eq(){return this;},
  maybeSingle(){return Promise.resolve({data:existing,error:null});},
  insert(row){records.push(['insert',row]);return Promise.resolve({error:null});},
  update(row){records.push(['update',row]);return this;},
  then(resolve){return Promise.resolve({error:null}).then(resolve);}
 };
 const api=createDirectMessagesClient({from(name){assert.equal(name,'direct_message_reads');return table;}});
 await api.markRead(me,peer,9);
 assert.deepEqual(records.at(-1),['insert',{reader_id:me,peer_id:peer,last_read_message_id:9}]);
 existing={last_read_message_id:9};
 await api.markRead(me,peer,8);
 assert.equal(records.length,1,'older cursor must not regress');
 await api.markRead(me,peer,12);
 assert.deepEqual(records.at(-1),['update',{last_read_message_id:12}]);
});
