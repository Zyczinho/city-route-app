import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate} from '../core.js';
import {planRoutesV2} from '../route-planner-v2.js';
import {
 ROUTE_INTERESTS,ROUTE_EXCLUSIONS,normalizeRouteInterests,normalizeRouteExclusions,
 routeInterestMatch,isExcludedRoutePlace,isRouteFoodPlace
} from '../route-preferences.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const place=(id,cat,more={})=>({
 id,name:id,cityId:'warsaw',categoryId:cat,kind:'place',lat:52.23,lng:21.013,
 minutes:25,cost:0,foodStyle:'none',tags:[],cats:[],tourist:'balanced',
 partner:false,ratings:[],...more
});
const mixed=()=>[
 place('classic','landmark',{tags:['sightseeing']}),
 place('art','museum',{tags:['culture']}),
 place('trees','park',{tags:['nature']}),
 place('view','viewpoint',{tags:['views']}),
 place('dinner','restaurant',{foodStyle:'sit',tags:['food']}),
 place('coffee','cafe',{foodStyle:'quick',tags:['food']}),
 place('pastry','bakery',{foodStyle:'quick',tags:['food']}),
 place('local','hidden_gem',{tags:['hidden'],tourist:'local'}),
 place('church','religious_site',{tags:['culture']}),
 place('party','club',{tags:['nightlife']})
];
const config=(extra={})=>({cityId:'warsaw',visitDate:'2026-11-07',startTime:'10:00',
 time:360,transport:'walking',interests:['mix'],avoid:[],food:'none',
 budget:'premium',offers:'no',tourist:'balanced',visitMode:'inside',...extra});
test('every UI interest is a recognized planner theme, with descriptions',()=>{
 assert.deepEqual(ROUTE_INTERESTS.map(x=>x.id),['mix','zabytki','swiatynie','muzea','zielen','ogrody','widoki','woda','ulice','okolice','jedzenie','bary','kluby','aktywnosci','sidequests']);
 assert.ok(ROUTE_INTERESTS.every(x=>x.description&&x.label));
 assert.equal(ROUTE_EXCLUSIONS.length,6);
 assert.deepEqual(normalizeRouteInterests(['mix','nature','nature','unknown']),['nature']);
 assert.deepEqual(normalizeRouteInterests([]),['mix']);
 assert.deepEqual(normalizeRouteExclusions(['parks','parks','made-up']),['parks']);
 for(const [id,cat] of [['sightseeing','landmark'],['culture','museum'],['nature','park'],
  ['views','viewpoint'],['food','restaurant'],['hidden','hidden_gem']]){
  assert.ok(routeInterestMatch(place(id,cat),id),id);
 }
});
test('hard excludes win over every positive theme in V1 and V2',()=>{
 const dataset=mixed();
 const avoid=['museums','parks','religious','viewpoints','food','nightlife'];
 const forbidden=new Set(['art','trees','view','dinner','coffee','pastry','church','party']);
 for(const p of dataset)assert.equal(isExcludedRoutePlace(p,avoid),forbidden.has(p.id),p.id);
 const interests=['culture','nature','views','food','hidden'];
 const p=config({interests,avoid});
 const legacy=generate(dataset,p);
 assert.ok(legacy.length>0);
 assert.ok(legacy.every(x=>!forbidden.has(x.id)));
 const newEngine=planRoutesV2(dataset,p,{count:3,maxStops:5});
 assert.ok(newEngine.routes.length>0);
 assert.ok(newEngine.routes.every(r=>r.stops.every(x=>!forbidden.has(x.id))));
});
test('food as a route theme works without mandatory lunch, with several culinary stops',()=>{
 const dataset=mixed().filter(p=>['dinner','coffee','pastry','classic'].includes(p.id));
 const p=config({interests:['food'],food:'none',time:240});
 const legacy=generate(dataset,p);
 assert.ok(legacy.filter(isRouteFoodPlace).length>=2,'V1 should not discard a food-themed itinerary');
 const modern=planRoutesV2(dataset,p,{count:3,maxStops:5});
 assert.ok(modern.routes.some(r=>r.stops.filter(isRouteFoodPlace).length>=2),'V2 should include a culinary itinerary');
 const other=planRoutesV2(dataset,config({interests:['sightseeing'],food:'none'}));
 assert.ok(other.routes.every(r=>r.stops.every(x=>!isRouteFoodPlace(x))), 'a non-food route must not silently insert a meal');
});
test('legacy category fallback and exclusion apply even without normalized category IDs',()=>{
 assert.equal(isExcludedRoutePlace(place('legacy','unclassified',{cats:['muzea']}),['museums']),true);
 assert.equal(isExcludedRoutePlace(place('local','unclassified',{cats:['zielen']}),['parks']),true);
 assert.equal(isExcludedRoutePlace(place('notpark','landmark'),['parks']),false);
 assert.equal(routeInterestMatch(place('area','unclassified',{cats:['widoki']}),'views'),true);
});
test('Start exposes category glossary and advanced opt-out, submit serializes all values',()=>{
 const app=source('app.js'),ux=source('ux-cleanup.js'),sw=source('service-worker.js');
 assert.match(app,/ROUTE_INTERESTS\.map/);
 assert.match(app,/ROUTE_EXCLUSIONS\.map/);
 assert.match(app,/Co oznaczają kategorie\?/);
 assert.match(app,/name="avoid"/);
 assert.match(app,/data\.getAll\('avoid'\)/);
 assert.match(app,/normalizeRouteInterests\(data\.getAll\('interests'\)\)/);
 assert.match(ux,/avoid=field\('avoid'\)/);
 assert.match(sw,/'\.\/route-preferences\.js'/);
});
