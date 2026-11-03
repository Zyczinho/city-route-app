import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const places=JSON.parse(await read('data/places.json'));
const sql=await read('supabase/migrations/014_warsaw_museums_restaurants.sql');
const pilot=places.filter(p=>p.metadata?.source?.verifiedAt==='2026-11-03');
const museum=pilot.filter(p=>p.categoryId==='museum');
const restaurant=pilot.filter(p=>p.categoryId==='restaurant');

const fold=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'');

test('Warsaw pilot adds exactly 9 museums and 6 restaurants, no duplicate slugs or same-name locations',()=>{
 assert.equal(museum.length,9);
 assert.equal(restaurant.length,6);
 assert.equal(places.length,65);
 assert.equal(new Set(places.map(p=>p.id)).size,places.length);
 const keys=pilot.map(p=>fold(p.name)+'|'+fold(p.address));
 assert.equal(new Set(keys).size,keys.length);
});

test('pilot has real addresses, Warsaw coordinate bounds, and geographic provenance',()=>{
 for(const p of pilot){
  assert.ok(p.name&&p.address,'missing name/address: '+p.id);
  assert.ok(p.lat>=52.1&&p.lat<=52.35&&p.lng>=20.8&&p.lng<=21.2,'out of bounds: '+p.id);
  assert.match(p.metadata.source.coordinateSource,/^https:\\/\\//,'missing GPS source: '+p.id);
  assert.match(p.metadata.source.officialWebsite||p.metadata.source.coordinateSource,/^https:\\/\\//);
  assert.ok(['point','building','address'].includes(p.metadata.source.coordinatePrecision));
  assert.equal(p.cats?.length,1);
  assert.equal(p.cats[0],p.categoryId==='museum'?'muzea':'jedzenie');
  assert.equal(p.kind,p.categoryId==='restaurant'?'restaurant':'place');
 }
});

test('no fabricated ratings, provider review counts or unlicensed stock photos',()=>{
 for(const p of pilot){
  assert.deepEqual(p.ratings,[],'unsourced ratings: '+p.id);
  assert.equal(p.image,null,'unsourced image: '+p.id);
  assert.equal(p.metadata.photoStatus,'not-sourced');
  assert.equal(p.metadata.ratingsStatus,'not-sourced');
  assert.equal(p.metadata.priceSource,'editorial-budget-estimate');
 }
});

test('migration 014 imports exactly the pilot slugs and does not overwrite existing catalogue records',()=>{
 assert.equal((sql.match(/-- place: /g)||[]).length,15);
 assert.match(sql,/on conflict \\(city_id,slug\\) do nothing/);
 assert.match(sql,/expected 15 public places/);
 assert.doesNotMatch(sql,/delete from public\\.place_sources|delete from public\\.places|drop table|truncate/i);
 for(const p of pilot){
  assert.ok(sql.includes('-- place: '+p.id),'missing SQL place '+p.id);
  assert.ok(sql.includes(p.metadata.source.coordinateSource),'missing SQL provenance '+p.id);
 }
});
