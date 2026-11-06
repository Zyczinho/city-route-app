// #112: the additive OpenStreetMap layer for Warsaw and its migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distance} from '../core.js';
import {placeFromCatalogue} from '../catalogue-client.js';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const base='data/cities/warsaw';
const [places,legacy,config,curation,taxonomy,sql]=await Promise.all([
  read(`${base}/places.json`),read('data/places.json'),read(`${base}/source-config.json`),read(`${base}/curation.json`),
  read('data/taxonomy.json'),readFile('supabase/migrations/019_add_warsaw_osm_places.sql','utf8').then(s=>s.replace(/\r\n/g,'\n'))
]);
const NIGHTLIFE=new Set(['bar','pub','cocktail_bar','wine_bar','club','live_music']);
const fold=v=>String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,' ').trim();
const existing=[...legacy,...config.excludePoints];

test('Warsaw reaches 300 places with at least 30 in Bary i kluby',()=>{
  assert.ok(legacy.length+places.length>=300,`Warsaw total ${legacy.length+places.length}`);
  assert.ok(places.filter(p=>NIGHTLIFE.has(p.categoryId)).length>=30);
});

test('every OSM record is valid, attributed and has no invented data',()=>{
  const valid=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
  assert.equal(new Set(places.map(p=>p.id)).size,places.length,'ids are unique');
  for(const p of places){
    assert.ok(valid.has(p.categoryId),`${p.id}: ${p.categoryId}`);
    assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&distance({lat:52.2297,lng:21.0122},p)<25,`${p.id} coordinates`);
    assert.equal(p.metadata.source.provider,'openstreetmap');
    assert.match(p.metadata.source.url,/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
    assert.deepEqual(p.ratings,[],`${p.id} must not carry ratings`);
    assert.ok(!p.image,`${p.id} must not carry a photo`);
    assert.ok(p.area&&fold(p.area)!=='warszawa',`${p.id} needs a district`);
  }
});

test('OSM records do not duplicate the existing catalogue or each other',()=>{
  const ids=new Set(existing.map(x=>x.id));
  for(const p of places){
    assert.ok(!ids.has(p.id),`${p.id} reuses an existing slug`);
    for(const x of existing){
      const d=distance(x,p);
      assert.ok(d>=0.025,`${p.name} is ${Math.round(d*1000)} m from ${x.name}`);
      assert.ok(!(d<1&&fold(x.name)===fold(p.name)),`${p.name} duplicates ${x.name}`);
    }
  }
  for(const [i,a] of places.entries())for(const b of places.slice(i+1))assert.ok(distance(a,b)>=0.025,`${a.name} / ${b.name}`);
});

test('curation removals and chains stay out',()=>{
  const refs=new Set(places.map(p=>`${p.metadata.source.type}/${p.metadata.source.id}`));
  for(const r of curation.removed)assert.ok(!refs.has(r.source),`${r.name} was removed by curation`);
  for(const name of ['Starbucks','McDonald\'s','KFC','Costa Coffee'])assert.ok(!places.some(p=>fold(p.name).includes(fold(name))),name);
});

test('imported bars land in "Bary i kluby" and keep their website button',()=>{
  const p=places.find(x=>x.id==='stodola'&&x.categoryId==='club');assert.ok(p,'Stodoła is in the layer');
  const metadata=JSON.parse(sql.match(/-- place: stodola\n[^]*?'(\{"source"[^']*)'::jsonb\n  \)/)[1]);
  const app=placeFromCatalogue({id:'00000000-0000-0000-0000-000000000000',name:p.name,lat:p.lat,lng:p.lng,category_id:p.categoryId,area:p.area,metadata,image_meta:{},tags:[],ratings:[]},'warsaw');
  assert.deepEqual(app.cats,['nocne']);
  assert.equal(app.area,'Śródmieście');
  assert.equal(app.source.provider,'openstreetmap');
  for(const x of places.filter(x=>x.website))assert.match(sql,new RegExp(`-- place: ${x.id}\\n[^]*?"website":"https?://`));
});

test('migration 019 adds exactly these places and never edits editorial ones',()=>{
  assert.equal((sql.match(/-- place: /g)||[]).length,places.length);
  assert.equal((sql.match(/where public\.places\.metadata->'source'->>'provider'='openstreetmap'\n  returning id into v_place;\n  if v_place is null then raise exception/g)||[]).length,places.length);
  assert.doesNotMatch(sql,/update public\.places/);
  assert.doesNotMatch(sql,/public\.routes/);
  assert.match(sql,/OpenStreetMap parity failed/);
  for(const p of legacy)assert.ok(!sql.includes(`-- place: ${p.id}\n`),`019 must not touch ${p.id}`);
});
