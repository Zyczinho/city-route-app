import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('community hub ships through HTML, build and offline cache',async()=>{
 const [html,build,sw,hub,css]=await Promise.all([
  read('index.html'),read('scripts/build.mjs'),read('service-worker.js'),read('community-hub.js'),read('ux-cleanup.css')
 ]);
 assert.match(html,/community-hub\.js\?v=2/);
 assert.match(html,/community-enhancements\.js\?v=20/);
 assert.match(html,/ux-cleanup\.js\?v=2/);
 assert.match(html,/ux-cleanup\.css\?v=2/);
 assert.match(build,/'community-hub\.js'/);
 assert.match(sw,/community-hub\.js\?v=2/);
 assert.match(sw,/community-enhancements\.js\?v=20/);
 assert.match(sw,/city-route-v43/);
 assert.match(css,/:not\(\[data-community-tabs\]\)/,'Community focus must keep the inner tabs visible');
 assert.match(hub,/\['#routes\/community','Trasy'\]/);
 assert.match(hub,/\['#routes\/community\/groups','Grupy'\]/);
 assert.match(hub,/\['#routes\/community\/chats','Czaty'\]/);
 assert.match(hub,/\['#routes\/community\/friends','Znajomi'\]/);
 assert.match(html,/friends\.js\?v=1/);
 assert.match(sw,/friends\.js\?v=1/);
 assert.match(build,/'friends-client\.js'/);
 assert.match(hub,/\['#social-saved','Zapisane'\]/);
});

test('groups and chat share the existing member-authorized Supabase flow',async()=>{
 const [groups,hub,ux]=await Promise.all([read('community-enhancements.js'),read('community-hub.js'),read('ux-cleanup.js')]);
 assert.match(groups,/const communityPath=/);
 assert.match(groups,/parts\[0\]==='profile'&&parts\[1\]==='community'/,'old deep links stay valid');
 assert.match(groups,/parts\[2\]==='groups'/);
 assert.match(groups,/parts\[2\]==='chats'/);
 assert.match(groups,/async function renderChats/);
 assert.match(groups,/supabase\.from\('group_members'\)\.select\('group_id'\)\.eq\('user_id',session\.user\.id\)/);
 assert.match(groups,/supabase\.from\('messages'\)/);
 assert.match(groups,/groupHref\(group\.id,'chat'\)/);
 assert.match(groups,/async function renderGroup/);
 assert.match(groups,/async function sendMessage/);
 assert.match(ux,/communityTab=hash==='#routes\/community'/,'feed focus must not swallow the Groups/Chats screens');
 assert.match(hub,/aria-current/,'navigation needs visible active-state semantics');
});

test('community hub modules are syntactically valid',()=>{
 for(const path of ['community-enhancements.js','community-hub.js','ux-cleanup.js'])execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});
