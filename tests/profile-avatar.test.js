import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AVATAR_BUCKET,avatarPath,avatarUrl,avatarPlan,isLocalPhoto,jpegBlobFromDataUrl,avatarSyncUnavailable} from '../profile-avatar-model.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const U='0b9a6f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const JPEG='data:image/jpeg;base64,/9j/4AAQ';

test('one fixed avatar object per account, matching migration 017',()=>{
 assert.equal(avatarPath(U),U+'/avatar.jpg');
 assert.equal(avatarPath('../evil'),null);
 assert.equal(avatarUrl(U+'/avatar.jpg','2026-11-05T10:00:00Z','https://x.supabase.co'),`https://x.supabase.co/storage/v1/object/public/${AVATAR_BUCKET}/${U}/avatar.jpg?v=2026-11-05T10%3A00%3A00Z`);
 assert.equal(avatarUrl('other/path.jpg','','https://x.supabase.co'),'');
 assert.equal(avatarUrl(U+'/avatar.jpg','','http://insecure'),'');
 const sql=read('supabase/migrations/017_profile_avatars_and_open_profiles.sql');
 assert.match(sql,/avatar_path = id::text \|\| '\/avatar\.jpg'/);
 assert.match(sql,/'city-route-avatars'/);
 assert.ok(sql.includes(AVATAR_BUCKET));
});

test('after sign-in: pending local change wins, then the account photo, then this device, then the guest photo',()=>{
 assert.deepEqual(avatarPlan({remotePath:U+'/avatar.jpg',localPhoto:JPEG,pending:true}),{action:'upload',photo:JPEG});
 assert.deepEqual(avatarPlan({remotePath:U+'/avatar.jpg',localPhoto:JPEG}),{action:'use-remote'});
 assert.deepEqual(avatarPlan({remotePath:null,localPhoto:JPEG}),{action:'upload',photo:JPEG});
 assert.deepEqual(avatarPlan({remotePath:null,localPhoto:null,guestPhoto:JPEG}),{action:'upload',photo:JPEG,fromGuest:true});
 assert.deepEqual(avatarPlan({}),{action:'none'});
 assert.equal(isLocalPhoto('https://x/avatar.jpg'),false,'a remote URL is never re-uploaded');
});

test('JPEG data URL becomes an upload blob; anything else is refused',()=>{
 const blob=jpegBlobFromDataUrl(JPEG);
 assert.equal(blob.type,'image/jpeg');
 assert.ok(blob.size>0);
 assert.equal(jpegBlobFromDataUrl('data:image/png;base64,AAAA'),null);
});

test('missing migration keeps the old local-only behaviour instead of failing',()=>{
 assert.equal(avatarSyncUnavailable({code:'42703',message:'column profiles.avatar_path does not exist'}),true);
 assert.equal(avatarSyncUnavailable({message:'Bucket not found'}),true);
 assert.equal(avatarSyncUnavailable({code:'42501',message:'permission denied'}),false);
});

test('app.js hands photo changes to the sync module and applies its results to in-memory state',()=>{
 const app=read('app.js'),runtime=read('profile-avatar.js');
 assert.match(app,/window\.dispatchEvent\(new Event\('cityroute:avatar-changed'\)\)/);
 assert.match(app,/window\.dispatchEvent\(new Event\('cityroute:avatar-removed'\)\)/);
 assert.match(app,/addEventListener\('cityroute:avatar-synced'/);
 assert.doesNotMatch(runtime,/localStorage\.setItem/,'sync module never writes app state behind app.js');
 assert.match(read('index.html'),/profile-avatar\.js\?v=1/);
 assert.match(read('service-worker.js'),/profile-avatar-model\.js/);
});

test('friends list links to profiles, and signed-in explorers can open any profile',()=>{
 assert.match(read('friends.js'),/href="#social-profile\/\$\{esc\(item\.user_id\)\}"/);
 const sql=read('supabase/migrations/017_profile_avatars_and_open_profiles.sql');
 assert.match(sql,/\(select auth\.uid\(\)\) is not null/);
 assert.match(sql,/grant execute on function public\.public_profile\(uuid\) to anon,authenticated/);
 assert.doesNotMatch(sql.split('create function public.public_profile')[1],/email|stay/,'never e-mail or stay');
});
