import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {activityTarget,activityUnreadCount,activityLabel} from '../activity-notifications-model.js';
test('safe internal links never redirect outside City Route',()=>{
 const uuid='aaaaaaaa-0000-4000-8000-000000000001';
 for(const path of ['#routes/community/dm/'+uuid,'#routes/community/chat/'+uuid,'#routes/community/friends'])assert.equal(activityTarget(path),path);
 for(const invalid of ['https://example.com','#/private','javascript:alert(1)','../../admin','#routes/community/dm/../../x'])assert.equal(activityTarget(invalid),'#routes/community/notifications');
});
test('unread count considers only own loaded, not yet acknowledged rows',()=>{
 assert.equal(activityUnreadCount([{id:1,read_at:null},{id:2,read_at:'2026-11-08T00:00:00Z'},{id:3,read_at:null}]),2);
 assert.equal(activityUnreadCount([]),0);
 for(const k of ['direct_message','group_message','friend_request','friend_accepted'])assert.ok(activityLabel(k).label);
});
test('schema creates recipient-only activity inbox from three trusted sources without public inserts',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/024_activity_notifications.sql',import.meta.url),'utf8');
 for(const marker of ['enable row level security','grant update(read_at)','activity_notifications_owner_select','activity_notifications_owner_update',
  'private.on_direct_message_activity','private.on_group_message_activity','private.on_friendship_activity','on conflict(recipient_id,kind,source_key) do nothing',
  "m.user_id<>new.user_id",'supabase_realtime'])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/grant (all|insert) on public.activity_notifications to authenticated/i);
 assert.ok(sql.includes('revoke execute on function private.on_direct_message_activity() from public,anon,authenticated'));
});
