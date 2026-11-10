import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('integration 177: authentic five-tab Start, Routes, Places, Social, Profile and contextual My Route',()=>{
 const app=read('app.js'),nav=read('nav-enhancements.js');
 for(const token of ["['plan','house','Start']","['routes','route','Trasy']","['places','map-pin','Miejsca']","['routes/community','users','Społeczność']","['profile','user-round','Profil']"])assert.ok(app.includes(token),token);
 assert.match(nav,/variant-d-active-route/);
 assert.match(app,/function collectionsView\(\)/);
 assert.match(app,/variant-d-route-actions/);
 assert.match(app,/class="variant-d-more"/);
});
test('integration 177: planner V2 and legacy route share / GPX / 30 per page survive together',()=>{
 const app=read('app.js'),build=read('scripts/build.mjs'),sw=read('service-worker.js');
 assert.match(app,/import \{planRoutesV2\} from '\.\/route-planner-v2\.js'/);
 assert.match(app,/planRoutesV2\(candidates/);
 assert.match(app,/data-action="export-gpx"/);
 assert.match(app,/shareRouteButton\(/);
 assert.match(app,/wholeRoute\(ps,transport\)/);
 assert.match(app,/function transitLegLinks\(ps,origin=null\)/);
 assert.match(build,/route-planner-v2\.js/);
 assert.match(sw,/route-planner-v2\.js/);
 assert.ok(existsSync(new URL('../places-pagination.js',import.meta.url)));
 assert.ok(existsSync(new URL('../route-export.js',import.meta.url)));
});
test('integration 177: Purple community sharing and public + private place links, no regression in user saves',()=>{
 const app=read('app.js'),share=read('share-links.js'),css=read('route-share-ui.css');
 assert.match(css,/--cr-community/);
 assert.match(app,/data-place-share/);
 assert.match(share,/decodePlaceSnapshot/);
 assert.match(share,/usePlaceShare/);
 assert.match(app,/openSharedPlacePreview/);
 assert.match(app,/data-action="save-basket"/);
 assert.match(app,/data-action="bookmark"/);
});
test('integration 177: latest production direct messages, notification modules, offline and photo capability are wired',()=>{
 const index=read('index.html'),build=read('scripts/build.mjs'),sw=read('service-worker.js');
 const sources=['activity-notifications.js','dm-notifications.js','direct-messages-client.js','direct-messages-ui.js','photo-provider-status.js','place-share-model.js'];
 for(const name of sources){assert.ok(existsSync(new URL('../'+name,import.meta.url)),name+' file');assert.ok(build.includes(name),name+' build');assert.ok(sw.includes(name),name+' worker');}
 for(const name of ['activity-notifications.js','dm-notifications.js','photo-provider-status.js'])assert.ok(index.includes(name),name+' in index');
 assert.match(sw,/notificationclick/);
 assert.match(read('worker.js'),/api\/photo-capabilities/);
});
