import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('community hub ships through HTML, build and offline cache',async()=>{
 const [html,build,sw,hub,css]=await Promise.all([
  read('index.html'),read('scripts/build.mjs'),read('service-worker.js'),read('community-hub.js'),read('ux-cleanup.css')
 ]);
 assert.match(html,/community-hub\.js\?v=\d+/);
 assert.match(html,/community-enhancements\.js\?v=\d+/);
 assert.match(html,/ux-cleanup\.js\?v=7/);
 assert.match(html,/ux-cleanup\.css\?v=5/);
 assert.match(build,/'community-hub\.js'/);
 assert.match(sw,/community-hub\.js\?v=\d+/);
 assert.match(sw,/community-enhancements\.js\?v=\d+/);
 assert.match(sw,/city-route-v\d+/);
 assert.match(css,/:not\(\[data-community-tabs\]\)/,'Community focus must keep the inner tabs visible');
 assert.match(hub,/\['#routes\/community','Trasy'\]/);
 assert.match(hub,/\['#routes\/community\/groups','Grupy'\]/);
 assert.match(hub,/\['#routes\/community\/chats','Czaty'\]/);
 assert.match(hub,/\['#routes\/community\/friends','Znajomi'\]/);
 assert.match(html,/friends\.js\?v=\d+/);
 assert.match(sw,/friends\.js\?v=\d+/);
 assert.match(build,/'friends-client\.js'/);
 assert.match(hub,/\['#social-saved-places','Zapisane'\]/);
 assert.doesNotMatch(hub,/class="community-events-entry" href="#events"/,'Event promotion must be hidden during MVP');
 assert.doesNotMatch(hub,/\['#events','Wydarzenia'\]/,'Events shortcut should stay outside compact five-tab nav');
 const app=await read('app.js');
 assert.match(app,/Spacery grupowe, spotkania i wydarzenia od społeczności/);
 assert.match(app,/Obecnie nie można jeszcze utworzyć publicznego wydarzenia/,'unimplemented event creation must never appear live');
 const spec=await read('COMMUNITY_EVENTS_MVP.md');
 for(const required of ['community_event_rsvps','community_event_reactions','interested','going','recommend','live'])assert.ok(spec.includes(required),'missing planned event requirement: '+required);
 assert.doesNotMatch(hub,/\['#social-saved-places','Zapisane miejsca'\]/,'saved places must be inside one top-level Saved tab');
 assert.match(hub,/href="#social-saved-places">Miejsca/,'nested Places link remains accessible');
 assert.match(hub,/saved:'#social-saved-places','saved-places':'#social-saved-places'/,'both saved views activate the same top-level tab');
 const communityCss=await read('community.css');
 assert.match(communityCss,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(communityCss,/\.community-saved-switch\{display:grid/);
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

test('Community five-tab icons are accessible, consistent and offline-ready',async()=>{
 const [hub,css,sw,icons]=await Promise.all([
  read('community-hub.js'),read('community.css'),read('service-worker.js'),read('ui-icons.js')
 ]);
 for(const [label,icon] of [['Trasy','route'],['Grupy','users'],['Czaty','message-circle'],['Znajomi','user-round'],['Zapisane','bookmark']]){
  assert.match(hub,new RegExp("'"+label+"'"),'tab keeps text label: '+label);
  assert.ok(hub.includes(":'"+icon+"'"),'tab icon should be Lucide: '+icon);
 }
 assert.match(hub,/iconMarkup\(tabIcons\[href\],'community-tab-icon'\)/);
 assert.ok(hub.includes("+'<span>'+label+'</span></a>'"),'tab text remains visible for assistive tech');
 assert.match(css,/\.community-hub-links>a\{display:flex;flex-direction:column;[^\n]*min-height:56px/);
 assert.match(css,/\.community-hub-links>a \.community-tab-icon\{width:19px;height:19px/);
 assert.match(css,/@media\(max-width:359px\)\{\.community-hub-links>a\{min-height:52px/);
 assert.match(sw,/assets\/icons\/ui\/message-circle\.svg/,'offline PWA caches the chat icon');
 assert.match(icons,/'message-circle'/,'trusted icon allowlist includes the chat icon');
});
