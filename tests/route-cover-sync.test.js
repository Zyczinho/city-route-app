import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeFromCatalogue} from '../catalogue-client.js';

const read=async path=>JSON.parse(await readFile(path,'utf8'));

test('route adapter preserves cover metadata stored in metadata.legacy',()=>{
  const route=routeFromCatalogue({
    id:'demo',name:'Demo',description:'',transport:'walking',tags:[],stops:['a'],
    metadata:{legacy:{image:'route-demo.jpg',imageCaption:'Demo cover',imageCredit:{author:'A',license:'CC BY 4.0',licenseUrl:'https://example.com/license',source:'https://example.com/source',via:'Example'}}}
  },'warsaw');
  assert.equal(route.image,'route-demo.jpg');
  assert.equal(route.imageCaption,'Demo cover');
  assert.equal(route.imageCredit.author,'A');
});

test('migration 010 synchronizes every active editorial route cover',async()=>{
  const [cities,warsaw,krakow,sql]=await Promise.all([
    read('data/cities.json'),
    read('data/routes.json'),
    read('data/cities/krakow/routes.json'),
    readFile('supabase/migrations/010_sync_route_covers.sql','utf8')
  ]);
  const active=new Set(cities.filter(c=>['launch','next'].includes(c.status)).map(c=>c.id));
  assert.ok(active.has('warsaw')&&active.has('krakow'));
  const routes=[...warsaw.map(r=>({city:'warsaw',...r})),...krakow.map(r=>({city:'krakow',...r}))];
  assert.equal(routes.length,27);
  for(const route of routes){
    assert.ok(route.image&&route.imageCaption&&route.imageCredit,`${route.city}/${route.id} lacks cover metadata`);
    assert.match(sql,new RegExp(`c\\.slug='${route.city}'.*r\\.slug='${route.id}'`,'s'),`${route.city}/${route.id} missing from migration 010`);
    assert.ok(sql.includes(route.image),`${route.id} image missing from migration 010`);
    assert.ok(sql.includes(JSON.stringify(route.imageCaption).slice(1,-1).replaceAll("'","''"))||sql.includes(route.imageCaption.replaceAll("'","''")),`${route.id} caption missing from migration 010`);
  }
  assert.match(sql,/metadata->'legacy'/);
  assert.match(sql,/imageCredit/);
  assert.match(sql,/Safe to re-run/);
});
