// Start V3 (planner audit 2026-11-10, approved by the founder): fewer questions before the first route,
// chosen categories mean "only these", evening plans may cross midnight, and every limit comes with a fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRoutesV2} from '../route-planner-v2.js';
import {openingFor} from '../opening-hours.js';
import {ROUTE_INTERESTS,routeInterestMatch} from '../route-preferences.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const lisbon=JSON.parse(read('data/cities/lisbon/places.json')).map(p=>({...p,cityId:'lisbon'}));
const opts={count:3,candidateLimit:72,beamWidth:32,maxExpansions:12000};
const prefs=(extra={})=>({cityId:'lisbon',visitDate:'2026-11-13',startTime:'10:00',time:'240',transport:'walking',
 interests:['bary'],focus:'only',food:'none',visitMode:'mix',avoid:[],offers:'no',tourist:'balanced',...extra});
const open=(p,row)=>{
 const hours=openingFor(p,{cityId:'lisbon',date:'2026-11-13',mode:'mix'});
 return !Array.isArray(hours.intervals)||hours.intervals.some(([o,c])=>o<=row.visitStartMinute&&row.departureMinute<=c);
};

test('clubs: an afternoon request proposes 23:00, and 23:00 plans past midnight while open',()=>{
 const afternoon=planRoutesV2(lisbon,prefs({interests:['kluby'],startTime:'14:00',time:'180'}),opts);
 assert.equal(afternoon.reason,'interests-closed');
 assert.deepEqual(afternoon.hints.closedInterests.map(c=>[c.id,c.suggestedStart]),[['kluby','23:00']]);
 const night=planRoutesV2(lisbon,prefs({interests:['kluby'],startTime:'23:00',time:'240'}),opts);
 assert.ok(night.routes.length>=1,'a club night must be possible');
 const byId=new Map(lisbon.map(p=>[p.id,p]));
 for(const route of night.routes){
  assert.ok(route.stops.every(p=>p.categoryId==='club'));
  assert.ok(route.rows.at(-1).departureMinute>24*60,'the plan continues after midnight');
  for(const row of route.rows)assert.ok(open(byId.get(row.id),row),`${row.name} closed at ${row.visitStartMinute}`);
 }
});

test('"only bars" with the automatic coffee break still gets a café in the middle',()=>{
 const result=planRoutesV2(lisbon,prefs({startTime:'14:00',food:'quick'}),opts);
 assert.ok(result.routes.length>=1);
 const byId=new Map(lisbon.map(p=>[p.id,p]));
 for(const route of result.routes){
  const others=route.stops.filter(p=>p.id!==route.breakStopId);
  assert.ok(others.every(p=>['bar','pub','cocktail_bar','wine_bar','live_music'].includes(p.categoryId)),'only bars besides the break');
  if(route.breakStopId)assert.equal(byId.get(route.breakStopId).categoryId,'cafe');
 }
 assert.ok(result.routes.some(r=>r.breakStopId),'at least one variant has the requested coffee');
});

test('Lisbon Start hides categories the catalogue cannot fill, and the rule is wired in app.js',()=>{
 const counts=Object.fromEntries(ROUTE_INTERESTS.filter(x=>x.id!=='mix').map(({id})=>[id,lisbon.filter(p=>routeInterestMatch(p,id)).length]));
 for(const id of ['okolice','woda','ulice'])assert.ok(counts[id]<5,`${id} must be hidden in Lisbon (${counts[id]})`);
 for(const id of ['zabytki','swiatynie','muzea','zielen','ogrody','widoki','jedzenie','bary','kluby'])assert.ok(counts[id]>=5,`${id} must stay (${counts[id]})`);
 const app=read('app.js');
 assert.match(app,/const MIN_INTEREST_PLACES=5;/);
 assert.match(app,/ROUTE_INTERESTS\.filter\(\(\{id\}\)=>availableInterests\.has\(id\)\)/);
 assert.match(app,/max="23:30"/,'late evening starts are allowed for nightlife');
});

test('limits come with one-tap repairs instead of a dead end',()=>{
 const app=read('app.js');
 assert.match(app,/repairButton\('planner-start-at','Zacznij o '\+opens,opens\)/);
 assert.match(app,/repairButton\('planner-start-at','Ułóż od '\+opens,opens\)/);
 assert.match(app,/repairButton\('planner-fill','Uzupełnij po drodze'\)/);
 assert.match(app,/if\(button\.dataset\.action==='planner-fill'\)return replan\(\{focus:'prefer'\}\)/);
 assert.match(app,/if\(location\.hash==='#route\/generated'\)render\(\);else location\.hash='route\/generated';/);
 const css=read('ux-cleanup.css');
 assert.match(css,/\.planner-repair\{min-height:44px/);
});
