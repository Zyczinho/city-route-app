import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
test('provider label is evaluated in list and details, not an escaped JS source fragment',()=>{
 assert.match(app,/c\.value===null\?\x60<span class="muted">\x24\x7besc\(providerMessage\(p\)\)\}<\/span>\x60/);
 assert.match(app,/c\.value===null\?\x60<strong>—<\/strong><span>\x24\x7besc\(providerMessage\(p\)\)\}<\/span>\x60/);
 assert.doesNotMatch(app,/'<span class="muted">\x24\x7besc\(providerMessage\(p\)\)\}<\/span>'/);
 assert.doesNotMatch(app,/'<strong>—<\/strong><span>\x24\x7besc\(providerMessage\(p\)\)\}<\/span>'/);
 assert.match(app,/providerLoading\.delete\(p\.id\)/);
});
test('disabled Google Photos bypasses dead 404 thumbnails and exposes a free fallback',()=>{
 assert.match(app,/let googlePhotoState='unknown'/);
 assert.match(app,/googlePhotoState=photo/);
 assert.match(app,/!\['no-key','disabled','quota'\]\.includes\(googlePhotoState\)/);
 assert.match(app,/commonsAttrs\(p\)/);
});
test('named routes have reversible archive and are not deleted on catalogue refresh',()=>{
 assert.match(html,/id="route-save-dialog"/);
 assert.match(html,/id="route-save-form"/);
 assert.match(html,/name="name"[^>]*required/);
 assert.match(app,/function openSaveRouteDialog/);
 assert.match(app,/if\(f\.id==='route-save-form'\)/);
 assert.match(app,/function saveRoute\(r\)/);
 assert.match(app,/archivedAt:null/);
 assert.match(app,/action==='archive-route'\|\|action==='unarchive-route'/);
 assert.match(app,/Moje trasy/);
 assert.match(app,/Archiwum tras/);
 assert.match(app,/state\.myRoutes=state\.myRoutes\.filter\(r=>r&&typeof r\.id==='string'&&Array\.isArray\(r\.stops\)\)/);
 assert.doesNotMatch(app,/state\.myRoutes=state\.myRoutes\.filter\(r=>r\.cityId!==activeCity\.id\|\|r\.stops\.every/);
});
test('archived route styles and asset versions are precached by PWA',async()=>{
 const css=await readFile(new URL('../route-share-ui.css',import.meta.url),'utf8');
 const pager=await readFile(new URL('../places-pagination.css',import.meta.url),'utf8');
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 assert.match(css,/route-save-dialog/);assert.match(css,/route-archive/);
 assert.match(pager,/grid-template-areas:"photo info" "photo actions"/);
 for(const token of ['route-share-ui.css?v=3','places-pagination.css?v=2']){
  assert.ok(html.includes(token));assert.ok(sw.includes(token));
 }
 assert.match(sw,/const CACHE='city-route-v\d+'/);
});
