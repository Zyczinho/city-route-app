import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRoutesV2} from '../route-planner-v2.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('V2 is imported and selected for walking/bike/mix, transit remains explicitly legacy',()=>{
 const app=source('app.js');
 assert.match(app,/import \{planRoutesV2\} from '\.\/route-planner-v2\.js'/);
 assert.match(app,/const isV2=prefs\.transport!=='transit'/);
 assert.match(app,/new URLSearchParams\(location\.search\)\.get\('planner'\)!=='v1'/);
 assert.match(app,/planRoutesV2\(candidates,chosenPrefs/);
 assert.match(app,/engine:isV2\?'v2':'v1'/);
});

test('V2 time breakdown, rests and unknown-hours disclosure are visible to users',()=>{
 const app=source('app.js');
 assert.match(app,/function generatedV2TimelineView\(plan\)/);
 assert.match(app,/plan\.breakdown/);
 assert.match(app,/plan\.rows\.map/);
 assert.match(app,/plan\.unknownHours/);
 assert.match(app,/przejścia \$\{minutes\(parts\.travel\)\}/);
 assert.match(app,/\['360','Pół dnia · 6 h'\]/);
 assert.match(app,/\['480','Cały dzień · 8 h'\]/);
});

test("Transit multi-stop Google Maps export uses valid two-point links, not transit waypoints",()=>{
 const app=source('app.js');
 assert.match(app,/function transitLegLinks\(ps\)/);
 assert.match(app,/origin=\$\{ps\[i\]\.lat\},\$\{ps\[i\]\.lng\}&destination=\$\{p\.lat\},\$\{p\.lng\}&travelmode=transit/);
 assert.match(app,/if\(t==='transit'\)return transitLegLinks\(ps\)/);
});

test('PWA build and service worker cache include V2 engine',()=>{
 assert.match(source('scripts/build.mjs'),/'route-planner-v2\.js'/);
 assert.match(source('service-worker.js'),/'\.\/route-planner-v2\.js'/);
 assert.match(source('scripts/build.mjs'),/contentHash\('dist'\)/,'production SW uses content-addressed cache version');
});

test('V2 reroll suppresses identical stop sets while preserving time and category constraints',()=>{
 const venues=Array.from({length:17},(_,i)=>({
  id:'mock-'+i,name:'Mock '+i,cityId:'warsaw',kind:'place',categoryId:i%4===0?'park':i%4===1?'landmark':i%4===2?'viewpoint':'garden',
  lat:52.23+(i%5)*0.0005,lng:21.01+Math.floor(i/5)*0.0005,
  minutes:30,cost:0,foodStyle:'none',tags:[],ratings:[],tourist:'balanced',partner:false
 }));
 const prefs={cityId:'warsaw',visitDate:'2026-11-07',startTime:'10:00',time:135,
  transport:'walking',interests:['mix'],food:'none',tourist:'balanced',budget:'premium',offers:'no',visitMode:'outside'};
 const opts={count:3,candidateLimit:30,beamWidth:20,maxExpansions:4000};
 const initial=planRoutesV2(venues,prefs,opts);
 assert.ok(initial.routes.length>=1,'first run must have plans');
 const follow=planRoutesV2(venues,prefs,{...opts,history:initial.routes.map(x=>x.stopIds)});
 assert.ok(follow.routes.length>=1,'reroll should have alternatives');
 const signatures=new Set(initial.routes.map(r=>[...r.stopIds].sort().join('|')));
 for(const route of follow.routes){
  assert.ok(!signatures.has([...route.stopIds].sort().join('|')),'reroll may not duplicate an earlier set');
  assert.ok(route.totalMinutes<=135,'route must respect full time budget');
  assert.equal(route.totalMinutes,Object.values(route.breakdown).reduce((a,b)=>a+b,0));
 }
});
