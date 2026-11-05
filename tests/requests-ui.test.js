import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=p=>readFile(p,'utf8');

test('requests runtime module parses and is wired into the app shell',async()=>{
 const syntax=spawnSync(process.execPath,['--check','requests-enhancements.js'],{encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
 const [html,build,sw]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('service-worker.js')]);
 assert.match(html,/requests\.css/);assert.match(html,/requests-enhancements\.js/);
 for(const file of ['requests.css','requests-client.js','requests-enhancements.js'])assert.match(build,new RegExp(file.replace('.','\\.')),`${file} must ship in dist`);
 for(const file of ['./requests.css','./requests-client.js'])assert.ok(sw.includes(`'${file}'`),`${file} must be precached`);
 assert.match(sw,/['"]\.\/requests-enhancements\.js(?:\?v=2)?['"]/,`requests-enhancements.js must be precached with its current cache-busting version`);
});

test('request UI covers entry points, duplicate +1, ranking and own lifecycle without a new nav tab',async()=>{
 const [ui,app]=await Promise.all([read('requests-enhancements.js'),read('app.js')]);
 assert.ok(ui.includes('data-request-profile-entry'),'profile request history remains available');
 for(const old of ['data-request-search','data-request-category','data-request-user-place','data-request-generic'])assert.ok(!ui.includes(old),`confusing duplicate entry point remains: ${old}`);
 assert.ok(app.includes('data-request-entry'),'an optional editorial request remains in the add-place form');
 assert.match(ui,/findSimilarRequests/);assert.match(ui,/supportRequest/);assert.match(ui,/unsupportRequest/);
 assert.match(ui,/loadRequests/);assert.match(ui,/loadMyRequests/);
 assert.ok(ui.includes("id==='request'"));assert.ok(ui.includes("id==='requests'"));
 assert.doesNotMatch(app,/['"]requests['"].*Prośb/,'REQ-UI-003 must not add a permanent bottom-nav tab');
});

test('anonymous writes gate on auth and public cards never render private request fields',async()=>{
 const ui=await read('requests-enhancements.js');
 assert.match(ui,/if\(authRequired\(\)\)return/);
 assert.match(ui,/api\.createRequest/);assert.match(ui,/api\.supportRequest/);
 const card=ui.match(/function requestCard\([\s\S]*?\n\}/)?.[0]||'';
 assert.ok(card.length>0,'requestCard must exist');
 for(const privateField of ['note','sourceUrl','createdBy','email','supporters'])assert.ok(!card.includes(`r.${privateField}`),`public request card must not render ${privateField}`);
});

test('added own request exposes the resolved-place action and analytics contain no identity',async()=>{
 const ui=await read('requests-enhancements.js');
 assert.match(ui,/r\.status==='added'&&r\.resolvedPlaceId/);
 assert.match(ui,/data-request-open-city/,'resolved-place action must carry its request city');
 assert.match(ui,/place_request_create/);assert.match(ui,/place_request_vote/);assert.match(ui,/place_request_unvote/);
 assert.doesNotMatch(ui,/log\([^\n]*(email|user_id|created_by)/i);
});

test('resolved-place handoff is one-shot, city-scoped and never keeps resetting Places filters',async()=>{
 const ui=await read('requests-enhancements.js');
 const fn=ui.match(/function maybeOpenResolvedPlace\(\)\{[\s\S]*?\n\}/)?.[0]||'';
 assert.ok(fn.length>0,'maybeOpenResolvedPlace must exist');
 assert.match(fn,/sessionStorage\.removeItem\(OPEN_PLACE_KEY\)/,'handoff key must be consumed on the first attempt');
 assert.match(fn,/targetCity&&targetCity!==cityId\(\)/,'handoff must not open a place from another city');
 assert.doesNotMatch(fn,/clear-search/,'a missing place must not keep clearing search');
 assert.doesNotMatch(fn,/data-action="cat"/,'a missing place must not keep changing category');
 const removeAt=fn.indexOf('sessionStorage.removeItem(OPEN_PLACE_KEY)');
 const lookupAt=fn.indexOf('querySelectorAll');
 assert.ok(removeAt>=0&&lookupAt>removeAt,'the key must be removed before the catalogue lookup');
 assert.match(ui,/JSON\.stringify\(\{placeId:open\.dataset\.requestOpenPlace,cityId:open\.dataset\.requestOpenCity\|\|''\}\)/,'stored handoff must include place and city');
});
