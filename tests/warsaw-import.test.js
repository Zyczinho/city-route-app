import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const places=JSON.parse(await read('../data/places.json'));
const routes=JSON.parse(await read('../data/routes.json'));
const sql=await read('../supabase/migrations/004_import_warsaw_catalogue.sql');
const batch014=await read('../supabase/migrations/014_warsaw_museums_restaurants.sql');
const basePlaces=50; // migration 004 was already applied: never rewrite it when the catalogue grows

const escapeSql=s=>String(s).replaceAll("'","''");

test('immutable migration 004 and forward migration 014 together cover the current Warsaw catalogue',()=>{
 assert.equal((sql.match(/-- place: /g)||[]).length,basePlaces);
 assert.equal((batch014.match(/-- place: /g)||[]).length,places.length-basePlaces);
 assert.equal((sql.match(/-- editorial route: /g)||[]).length,routes.length);
 assert.match(sql,new RegExp(`expected at least ${basePlaces}`));
 assert.match(sql,new RegExp(`expected at least ${routes.length}`));
});

test('missing source ratings stay SQL NULL rather than becoming zero',()=>{
 const missing=places.flatMap(p=>(p.ratings||[]).filter(r=>r.value==null).map(r=>({place:p.id,...r})));
 assert.ok(missing.length>0,'fixture should include at least one missing rating');
 for(const r of missing){
  const listing=escapeSql(r.listing||'');
  const source=escapeSql(r.source||'');
  const needle=`v_place,'${source}',null,'${listing}'`;
  const at=sql.indexOf(needle);
  assert.notEqual(at,-1,`missing source row for ${r.place}/${r.source}`);
  const row=sql.slice(at,sql.indexOf(');',at));
  assert.match(row,/,null,[0-9.]+,null,/i,`missing rating was not preserved for ${r.place}/${r.source}`);
 }
});

test('all route stops are imported by legacy slug',()=>{
 for(const route of routes)for(const stop of route.stops||[]){
  assert.ok(sql.includes(`p.slug='${escapeSql(stop)}'`),`missing route stop ${route.id}/${stop}`);
 }
});
