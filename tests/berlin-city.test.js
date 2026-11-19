// Berlin ships as files before it is seeded in Supabase: real OSM places, two editorial routes, JSON fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distance} from '../core.js';
import {cityById,isInsideCity} from '../city-context.js';
import {loadCatalogueWithFallback} from '../catalogue-client.js';
import {eventMarket,ticketmasterQuery} from '../events.js';

const json=async p=>JSON.parse(await readFile(p,'utf8'));
const [cities,places,routes,report,taxonomy]=await Promise.all([
 json('data/cities.json'),json('data/cities/berlin/places.json'),json('data/cities/berlin/routes.json'),
 json('data/cities/berlin/import-report.json'),json('data/taxonomy.json')
]);
const city=cityById(cities,'berlin');
const categories=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
const worker=await readFile('service-worker.js','utf8');

test('Berlin is a selectable city next to the existing ones',()=>{
 assert.equal(city.slug,'berlin');
 assert.equal(city.countryCode,'DE');
 assert.equal(city.timezone,'Europe/Berlin');
 assert.equal(city.status,'next');
 assert.equal(isInsideCity({lat:52.5163,lng:13.3777},city),true,'Brandenburger Tor is inside Berlin');
 assert.equal(isInsideCity({lat:52.3906,lng:13.0645},city),false,'Potsdam is outside the city radius');
 assert.equal(cityById(cities,'warsaw').status,'launch');
 assert.equal(cities.filter(c=>c.countryCode==='PL').length,7);
});

test('Berlin catalogue is real, attributed OpenStreetMap data with first-visit anchors',()=>{
 assert.ok(places.length>=100&&places.length<=200,'got '+places.length);
 assert.equal(report.licence,'ODbL-1.0');
 assert.equal(report.selected,places.length);
 assert.equal(new Set(places.map(p=>p.id)).size,places.length);
 for(const p of places){
  assert.match(p.id,/^osm-(node|way|relation)-\d+$/);
  assert.ok(categories.has(p.categoryId),p.categoryId);
  assert.ok(distance(p,city.center)<city.radiusKm,p.name+' outside Berlin');
  assert.equal(p.metadata.source.provider,'openstreetmap');
  assert.deepEqual(p.ratings,[]);
  assert.equal(p.partner,false);
 }
 for(const name of ['Brandenburger Tor','Reichstagskuppel','Berliner Fernsehturm','East Side Gallery','Gendarmenmarkt','Markthalle Neun']){
  const p=places.find(x=>x.name===name);
  assert.ok(p,name+' missing');
  assert.equal(p.top,true,name+' should be a first-visit anchor');
 }
 assert.ok(!places.some(p=>/^Pergamonmuseum$/.test(p.name)),'closed museum must not be suggested');
 assert.ok(places.some(p=>p.foodStyle==='quick')&&places.some(p=>p.foodStyle==='sit'),'planner needs both snack and meal stops');
});

test('Berlin editorial routes use only catalogue places and stay walkable',()=>{
 assert.equal(routes.length,2);
 const byId=new Map(places.map(p=>[p.id,p]));
 for(const r of routes){
  assert.equal(r.routeType,'editorial');
  assert.ok(r.stops.length>=4);
  assert.equal(new Set(r.stops).size,r.stops.length);
  for(const id of r.stops){assert.ok(byId.has(id),r.id+' stop '+id+' not in catalogue');assert.ok(r.stopNotes[id],id+' has no note');}
  for(let i=1;i<r.stops.length;i++){
   const leg=distance(byId.get(r.stops[i-1]),byId.get(r.stops[i]));
   assert.ok(leg<(r.transport==='walk'?1.6:3.5),r.id+' leg '+i+' is '+leg.toFixed(2)+' km');
  }
 }
});

test('an empty live catalogue falls back to the shipped Berlin files',async()=>{
 const client={rpc:async()=>({data:[],error:null})};
 const data=await loadCatalogueWithFallback({client,city,fallback:{places,routes}});
 assert.equal(data.source,'json');
 assert.equal(data.places.length,places.length);
 assert.equal(data.routes.length,2);
 const live={rpc:async name=>({data:name==='catalogue_places'?[{id:'x',name:'X',lat:1,lng:2,category_id:'museum',tags:[],ratings:[]}]:[],error:null})};
 assert.equal((await loadCatalogueWithFallback({client:live,city,fallback:{places,routes}})).source,'supabase');
});

test('Berlin events are scoped to Berlin and its data works offline',()=>{
 assert.deepEqual(eventMarket('berlin'),{city:'Berlin',countryCode:'DE'});
 const url=new URL(ticketmasterQuery('k',7,new Date('2026-11-21T09:00:00Z'),'berlin'));
 assert.equal(url.searchParams.get('city'),'Berlin');
 assert.equal(url.searchParams.get('countryCode'),'DE');
 assert.match(worker,/'\.\/data\/cities\/berlin\/places\.json'/);
 assert.match(worker,/'\.\/data\/cities\/berlin\/routes\.json'/);
});

test('hosted Berlin registration is additive and idempotent',async()=>{
 const sql=await readFile('supabase/migrations/030_register_berlin_city.sql','utf8');
 assert.match(sql,/'berlin','Berlin','Niemcy','DE','de-DE','EUR','Europe\/Berlin'/);
 assert.match(sql,/extensions\.st_point\(13\.4050,52\.5200\)::extensions\.geography/);
 assert.match(sql,/on conflict\s*\(slug\)\s*do nothing/i);
});
