import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {legacyCategory} from '../city-context.js';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [places,routes,taxonomy]=await Promise.all([
 read('../data/places.json'),read('../data/routes.json'),read('../data/taxonomy.json')
]);
const categoryIds=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
const placeIds=new Set(places.map(p=>p.id));

test('every current Warsaw place maps to the global taxonomy',()=>{
 const bad=[];
 for(const p of places){
  const categoryId=legacyCategory(p,taxonomy.legacyAliases);
  if(!categoryIds.has(categoryId))bad.push({id:p.id,cats:p.cats,categoryId});
 }
 assert.deepEqual(bad,[]);
});

test('every editorial Warsaw route references existing places',()=>{
 const missing=[];
 for(const route of routes)for(const stop of route.stops||[])if(!placeIds.has(stop))missing.push({route:route.id,stop});
 assert.deepEqual(missing,[]);
});

test('legacy catalogue has stable ids before database migration',()=>{
 assert.equal(new Set(places.map(p=>p.id)).size,places.length);
 assert.equal(new Set(routes.map(r=>r.id)).size,routes.length);
 assert.ok(places.length>=40,'expected the current Warsaw catalogue, not an empty fixture');
 assert.ok(routes.length>=10,'expected the current Warsaw editorial routes');
});
