import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const base='data/cities/krakow';

test('Krakow dataset is broad, balanced and route-complete',async()=>{
  const [places,routes,anchors,config,taxonomy]=await Promise.all([
    read(`${base}/places.json`),read(`${base}/routes.json`),read(`${base}/anchors.json`),read(`${base}/source-config.json`),read('data/taxonomy.json')
  ]);
  assert.ok(places.length>=150,`expected at least 150 Krakow places, got ${places.length}`);
  assert.ok(places.length<=Math.max(280,config.targetCount+60),`unexpectedly large dataset: ${places.length}`);
  assert.equal(routes.length,15);
  const ids=new Set(places.map(p=>p.id));
  assert.equal(ids.size,places.length,'place IDs must be unique');
  const valid=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
  for(const p of places){
    assert.ok(valid.has(p.categoryId),`invalid category ${p.id}: ${p.categoryId}`);
    assert.ok(Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)),`invalid coordinates: ${p.id}`);
    assert.equal(p.cityId??'krakow','krakow');
  }
  for(const a of anchors)assert.ok(ids.has(a.id),`missing curated anchor ${a.id}`);
  for(const r of routes){
    assert.ok(r.stops.length>=3,`route ${r.id} is too short`);
    for(const stop of r.stops)assert.ok(ids.has(stop),`route ${r.id} references missing ${stop}`);
  }
  const groups={
    sightseeing:new Set(['landmark','museum','gallery','architecture','religious_site','viewpoint','neighborhood','hidden_gem']),
    nature:new Set(['park','garden','waterfront','beach','walk']),
    food:new Set(['restaurant','cafe','breakfast','street_food','food_hall','bakery','dessert']),
    nightlife:new Set(['bar','pub','cocktail_bar','wine_bar','club','live_music']),
    stay:new Set(['hotel','hostel','apartment','guesthouse'])
  };
  const count=g=>places.filter(p=>groups[g].has(p.categoryId)).length;
  assert.ok(count('sightseeing')>=35,`too few sightseeing POIs: ${count('sightseeing')}`);
  assert.ok(count('food')>=35,`too few food POIs: ${count('food')}`);
  assert.ok(count('nightlife')>=10,`too few nightlife POIs: ${count('nightlife')}`);
  assert.ok(count('stay')>=10,`too few stay POIs: ${count('stay')}`);
});

test('Krakow remains data-driven rather than hardcoded into app runtime',async()=>{
  const app=await readFile('app.js','utf8');
  assert.doesNotMatch(app,/if\s*\([^\n)]*krakow/i);
  assert.doesNotMatch(app,/switch\s*\([^)]*\)[\s\S]{0,300}case\s+['"]krakow['"]/i);
});
