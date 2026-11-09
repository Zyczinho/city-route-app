import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assignRouteCovers,duplicateCovers} from '../route-covers.js';

const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const places=await read('../data/cities/lisbon/places.json');
const routes=await read('../data/cities/lisbon/routes.json');
const byId=new Map(places.map(p=>[p.id,p]));

test('Lisbon P0 contains three real, distinct editorial itineraries',()=>{
 assert.equal(routes.length,3);
 assert.deepEqual(routes.map(r=>r.id),[
  'lisbon-after-dark-bars-clubs','lisbon-essentials-full-day','lisbon-food-and-views'
 ]);
 assert.equal(new Set(routes.flatMap(r=>r.stops)).size,routes.flatMap(r=>r.stops).length,'test routes must not repeat one another');
 assert.equal(new Set(routes.map(r=>r.id)).size,3);
 for(const r of routes){
  assert.equal(r.routeType,'editorial');
  assert.equal(r.authorLabel,'City Route');
  assert.equal(r.editorialStatus,'desk-researched');
  assert.ok(r.stops.length>=6&&r.stops.length<=10);
  assert.ok(r.description.length>=100);
  assert.ok(r.durationMinutes>=420&&r.durationMinutes<=600);
  assert.equal(new Set(r.stops).size,r.stops.length);
  assert.equal(Object.keys(r.stopNotes).length,r.stops.length);
  for(const id of r.stops){
   const p=byId.get(id);
   assert.ok(p,'route '+r.id+' references missing '+id);
   assert.ok((p.description||'').length>=50,id+' needs meaningful description');
   assert.ok((p.area||'').trim(),id+' needs real area');
   assert.ok(r.stopNotes[id].length>=35,id+' needs editorial rationale');
   assert.ok(Array.isArray(p.ratings)&&p.ratings.length===0,'do not fabricate rating for '+id);
  }
 }
});

test('Night route is nightlife-first, classic is sightseeing-first and food is food-plus-views',()=>{
 const [night,classic,food]=routes;
 const cats=r=>r.stops.map(id=>byId.get(id).categoryId);
 const nightCats=cats(night),classicCats=cats(classic),foodCats=cats(food);
 assert.equal(night.stops.length,6);
 assert.ok(nightCats.every(c=>['bar','pub','club'].includes(c)));
 assert.ok(nightCats.includes('club'));
 assert.ok(night.timeWindow.spansMidnight);
 assert.ok(night.recommendedDays.includes('fri'));
 assert.equal(classic.stops.length,9);
 assert.ok(classicCats.filter(c=>['landmark','religious_site','museum','viewpoint'].includes(c)).length>=8);
 assert.ok(classic.stops.includes('editorial-lisbon-jeronimos'));
 assert.ok(classic.stops.includes('editorial-lisbon-praca-comercio'));
 assert.ok(classic.transport==='mix');
 assert.equal(food.stops.length,8);
 assert.ok(foodCats.filter(c=>c==='viewpoint').length>=3);
 assert.ok(foodCats.filter(c=>['restaurant','cafe','bar'].includes(c)).length>=3);
 assert.ok(food.stops.includes(byId.has('osm-node-4813682932')?'osm-node-4813682932':'__missing__'));
});

test('Each editorial card has a verified, unique Commons cover with attribution',()=>{
 assert.deepEqual(duplicateCovers(routes),[]);
 const assigned=assignRouteCovers(routes,byId);
 for(const r of routes){
  const c=assigned.get(r.id);
  assert.equal(c?.source,'route');
  assert.equal(c?.image,r.image);
  assert.match(r.image,/^https:\/\/thumb\.wikimedia\.org\/wikipedia\/commons\/thumb\//);
  assert.equal(r.imageCredit.via,'Wikimedia Commons');
  assert.match(r.imageCredit.source,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  assert.match(r.imageCredit.license,/^CC BY(?:-SA)? /);
  assert.ok(r.imageCredit.author.length>=4);
  assert.ok(r.imageCaption.length>=15);
 }
});

test('All four new anchors are honestly marked as editorial and untested in the field',()=>{
 const extra=places.filter(p=>p.metadata?.source?.provider==='editorial');
 assert.equal(extra.length,4);
 for(const p of extra){
  assert.match(p.id,/^editorial-lisbon-/);
  assert.equal(p.metadata?.editorial?.fieldTested,false);
  assert.ok(p.description.length>=50);
  assert.equal(p.metadata.costUnknown,true);
 }
});
