import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placeFromCatalogue} from '../catalogue-client.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const patches=JSON.parse(read('scripts/data/lisbon-first30-descriptions-20261109.json'));
const fallback=JSON.parse(read('data/cities/lisbon/places.json'));
test('Lisbon description patch has exactly24 known places and matching offline content',()=>{
 assert.equal(patches.length,24);assert.equal(new Set(patches.map(x=>x.id)).size,24);
 for(const x of patches){
  const matches=fallback.filter(p=>p.id===x.id);
  assert.equal(matches.length,1,x.id);
  assert.equal(matches[0].description,x.description);
  assert.ok(x.description.length>=80&&x.description.length<=320);
  assert.ok(x.editorial.descriptionSources.length>0);
  assert.ok(x.editorial.descriptionSources.every(url=>new URL(url).protocol==='https:'));
  assert.equal(x.editorial.fieldTested,false);
  assert.deepEqual(matches[0].metadata.editorial,x.editorial);
  assert.equal(matches[0].metadata.source.provider,'openstreetmap','import provenance retained');
  const mapped=placeFromCatalogue({id:x.id,name:matches[0].name,description:x.description,metadata:{editorial:x.editorial}},'lisbon');
  assert.equal(mapped.description,matches[0].description,'hosted adapter and offline text agree');
  assert.deepEqual(mapped.editorial,x.editorial);
 }
});
test('questionable and closed venues have visible warnings instead of invented recommendations',()=>{
 const byId=new Map(patches.map(x=>[x.id,x]));
 assert.match(byId.get('osm-node-11893103024').description,/mundurków szkolnych/);
 assert.match(byId.get('osm-node-10253764125').description,/wymagają potwierdzenia/);
 assert.match(byId.get('osm-node-6268265385').description,/czasowym zamknięciu/);
 assert.match(byId.get('osm-node-4864514661').description,/zakończyła się w 2019/);
 assert.equal(patches.filter(x=>x.editorial.visitStatus==='listed').length,20);
});
test('hosted content script matches manifest and cannot overwrite unrelated content',()=>{
 const sql=read('scripts/staged-lisbon-descriptions-20261109.sql');
 assert.ok(sql.includes(JSON.stringify(patches)),'SQL payload equals reviewed manifest');
 assert.match(sql,/if matched<>24/);assert.match(sql,/if changed<>24/);
 assert.match(sql,/c.slug='lisbon'/);
 assert.match(sql,/coalesce\(p.description,''\)='' or p.description=u.description/);
 assert.doesNotMatch(sql,/delete from|alter table|truncate|image_url\s*=|ratings\s*=/i);
});
