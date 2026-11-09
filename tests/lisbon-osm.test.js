// #148: real OpenStreetMap POIs only; no fabricated names, ratings or photos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distance} from '../core.js';
import {placeFromCatalogue} from '../catalogue-client.js';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const [places,cities,taxonomy,report,sql]=await Promise.all([
 json('data/cities/lisbon/places.json'),json('data/cities.json'),json('data/taxonomy.json'),
 json('data/cities/lisbon/import-report.json'),
 readFile('supabase/migrations/021_add_lisbon_osm_places.sql','utf8')
]);
const city=cities.find(c=>c.id==='lisbon');
const licensedPhotos=await json('scripts/data/lisbon-first30-photos-20261109.json');
// The original OSM import remains immutable in provenance; additional curated landmarks are editorial records.
const osmPlaces=places.filter(p=>p.metadata?.source?.provider==='openstreetmap');
const editorialPlaces=places.filter(p=>p.metadata?.source?.provider==='editorial');
const categories=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
const fold=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

test('Lisbon OSM catalogue contains 100–200 real named, usable POIs',()=>{
 assert.ok(places.length>=100&&places.length<=200,'expected real 100–200 POIs; got '+places.length);
 assert.equal(report.selected,osmPlaces.length);
 assert.equal(report.attribution,'© OpenStreetMap contributors');
 assert.equal(report.licence,'ODbL-1.0');
 assert.match(report.importSource,/^https:\/\/overpass(?:-api|\.)/);
 assert.ok(report.rawRecords>places.length);
 assert.ok(new Set(places.map(p=>p.id)).size===places.length,'unique slugs');
 assert.ok(new Set(places.map(p=>p.categoryId)).size>=6,'diverse categories');
 for(const p of osmPlaces){
  assert.match(p.id,/^osm-(node|way|relation)-[0-9]+$/);
  assert.ok(p.name.length>=3);
  assert.ok(categories.has(p.categoryId),p.categoryId);
  assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  assert.ok(distance(p,city.center)<city.radiusKm,p.name+' outside Lisbon');
  assert.equal(p.metadata?.source?.provider,'openstreetmap');
  assert.match(p.metadata.source.url,/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
  assert.equal(p.metadata.costUnknown,true);
  assert.deepEqual(p.ratings,[]);
  if(p.image){
   const reviewed=licensedPhotos.find(x=>x.id===p.id&&x.image===p.image);
   assert.ok(reviewed,'an imported POI cover must appear in the reviewed photo manifest');
   assert.deepEqual(p.imageCredit,reviewed.credit,'licensed photo retains exact visible attribution');
   assert.match(p.imageCredit.license,/^CC BY(-SA)? [234]\\.0$/);
   assert.equal(new URL(p.imageCredit.source).hostname,'commons.wikimedia.org');
   assert.equal(new URL(p.imageCredit.licenseUrl).hostname,'creativecommons.org');
  }
  assert.equal(p.partner,false);
 }
});

test('Lisbon import has no duplicate geometry or near-identical neighboring names',()=>{
 for(let i=0;i<osmPlaces.length;i++)for(let j=i+1;j<osmPlaces.length;j++){
  const a=osmPlaces[i],b=osmPlaces[j],d=distance(a,b);
  assert.ok(d>=0.03,a.name+' / '+b.name+' same geometry');
  assert.ok(d>=0.25||fold(a.name)!==fold(b.name),a.name+' nearby duplicate name');
 }
});

test('Lisbon editorial additions have independent, explicit provenance',()=>{
 assert.equal(editorialPlaces.length,4);
 assert.equal(osmPlaces.length,188);
 const ids=new Set(places.map(p=>p.id));
 assert.equal(ids.size,places.length);
 for(const p of editorialPlaces){
  assert.match(p.id,/^editorial-lisbon-/);
  assert.match(p.metadata.source.url,/^https:\/\//);
  assert.ok(categories.has(p.categoryId));
  assert.ok(distance(p,city.center)<city.radiusKm);
  assert.ok(p.description.length>=50);
  assert.deepEqual(p.ratings,[]);
  assert.equal(p.metadata.editorial.fieldTested,false);
 }
});

test('Lisbon generated import SQL is aligned and city isolated',()=>{
 assert.ok(sql.includes("where slug='lisbon'"));
 assert.equal((sql.match(/-- place: /g)||[]).length,osmPlaces.length);
 assert.doesNotMatch(sql,/where slug='warsaw'|where slug='krakow'/);
 assert.doesNotMatch(sql,/update public\.cities|delete from public\.cities/i);
 assert.doesNotMatch(sql,/delete from public\.routes/i);
 assert.match(sql,/where public\.places\.metadata->'source'->>'provider'='openstreetmap'/);
 assert.match(sql,/OpenStreetMap/i);
 assert.match(sql,/parity failed/i);
 const p=places.find(p=>p.categoryId==='restaurant')||places[0];
 const item=placeFromCatalogue({id:p.id,name:p.name,lat:p.lat,lng:p.lng,category_id:p.categoryId,area:p.area,currency:'EUR',metadata:p.metadata,image_meta:{},tags:p.tags,ratings:p.ratings},'lisbon');
 assert.equal(item.cityId,'lisbon');
 assert.equal(item.currency,'EUR');
});
