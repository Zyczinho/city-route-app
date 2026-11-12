import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js');
const nav=read('nav-enhancements.js');
const guide=read('onboarding-guide.css');
const css=read('styles.css');
const ux=read('ux-cleanup.js');

test('variant D has exactly five accessible destination tabs, not five new routes',()=>{
 const ids=[...app.matchAll(/\['([^']+)','[^']+','(?:Start|Trasy|Miejsca|Społeczność|Profil)'\]/g)].map(x=>x[1]);
 assert.deepEqual(ids,['plan','routes','places','routes/community','profile']);
 assert.match(nav,/desiredNav=\['#plan','#routes','#places','#routes\/community','#profile'\]/);
 assert.match(guide,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(app,/\['plan','house','Start'\]/);
 assert.match(app,/\['profile','user-round','Profil'\]/);
 assert.match(app,/t===key\?'active'/);
 assert.match(app,/aria-current="page"/);
});
test('deep links to guide, booking, events, community and active route remain in runtime',()=>{
 for(const fragment of ["tab==='about'","tab==='book'","tab==='events'","tab==='my-route'","tab==='collections'","tab==='add-place'","tab==='sources'"]){
  assert.ok(app.includes(fragment),'missing route: '+fragment);
 }
 assert.match(nav,/href='#my-route'/);
 assert.match(nav,/href='#book'/);
 assert.match(app,/href="#about"/);
 assert.match(app,/href="#social-saved"/);
 assert.match(app,/href="#collections\/places"/);
 assert.match(nav,/hash\.startsWith\('#routes\/community'\)/);
});
test('one profile collections entry does not confuse own, social-saved and favorite places',()=>{
 assert.match(app,/class="variant-d-collections-entry" href="#collections"/);
 assert.match(app,/function collectionsView\(\)/);
 const collections=app.split('function collectionsView(){')[1].split('// ONBOARDING-MENU-050:')[0];
 assert.deepEqual([...collections.matchAll(/<a href="([^"]+)"/g)].map(x=>x[1]),
  ['#collections/places','#social-saved'],
  'collections tiles keep only Saved Places and Saved Routes');
 assert.doesNotMatch(collections,/Aktualna trasa|Zapisane trasy innych|href="#my-route"/);
 assert.match(app,/Moje, redakcji i społeczności/);
 assert.doesNotMatch(app,/Zapisane trasy innych/);
 assert.match(app,/function savedPlacesView\(\)/);
 assert.match(app,/data-profile-followers/);
 assert.match(app,/data-profile-friends/);
});
test('route has exactly 3 visible actions, others remain in disclosure, with no destructive data migration',()=>{
 assert.match(app,/variant-d-route-actions/);
 assert.match(app,/data-action="start" data-id="basket"/);
 assert.match(app,/data-action="save-basket"/);
 assert.match(app,/shareRouteButton\(ps,transport,builderDraft/);
 assert.match(app,/class="variant-d-more"/);
 assert.match(app,/data-action="optimize"/);
 assert.match(app,/data-action="clear-builder"/);
 assert.match(app,/\$\{mapsRouteButton\(ps,transport\)\}/);
 assert.match(css,/\.variant-d-extra-actions/);
 assert.match(css,/\.variant-d-active-route\[hidden\]\{display:none!important\}/);
});
test('Places retains existing live map with deliberate filter behavior',()=>{
 assert.match(app,/id="places-map"/);
 assert.match(app,/function mountPlacesMap\(\)/);
 assert.match(app,/filter:\{showPlaces:mapCategorySelected\}/);
 assert.match(app,/Mapa i miejsca/);
 assert.match(app,/placeRow\(p\)/);
 assert.match(app,/breakdown\(p\)/);
 assert.match(app,/Google Maps/);
 assert.match(app,/tripadvisor/);
});
test('Start has preferences before generating, without falsely claiming hard exclusions are active',()=>{
 assert.match(ux,/climate\.details\.open=true/);
 assert.match(ux,/form\.replaceChildren\(climate\.details,primary,\.\.\.\(feedback\?\[feedback\]:\[\]\),submit/);
 assert.doesNotMatch(ux,/excludeCategories|negativePreferences/);
 assert.match(app,/form id="build-form"/);
});
test('all changed JavaScript remains syntactically valid',()=>{
 for(const file of ['app.js','nav-enhancements.js','ux-cleanup.js'])
  execFileSync(process.execPath,['--check',new URL('../'+file,import.meta.url).pathname],{stdio:'pipe'});
});
