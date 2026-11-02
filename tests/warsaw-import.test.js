import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const places=JSON.parse(await read('../data/places.json'));
const routes=JSON.parse(await read('../data/routes.json'));
const sql=await read('../supabase/migrations/004_import_warsaw_catalogue.sql');

const escapeSql=s=>String(s).replaceAll("'","''");

test('generated Warsaw migration has one block per current place and route',()=>{
 assert.equal((sql.match(/-- place: /g)||[]).length,places.length);
 assert.equal((sql.match(/-- editorial route: /g)||[]).length,routes.length);
 assert.match(sql,new RegExp(`expected at least ${places.length}`));
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
