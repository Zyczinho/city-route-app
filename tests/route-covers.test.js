import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {coverKey,assignRouteCovers,duplicateCovers} from '../route-covers.js';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const allRoutes=async()=>{
  const cities=await read('data/cities.json');
  const out=[...(await read('data/routes.json')).map(r=>({...r,cityId:'warsaw'}))];
  for(const c of cities.filter(c=>c.id!=='warsaw')){
    try{out.push(...(await read(`data/cities/${c.id}/routes.json`)).map(r=>({...r,cityId:c.id})));}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return out;
};
const placeImages=async()=>{
  const cities=await read('data/cities.json');const out=[...(await read('data/places.json'))];
  for(const c of cities.filter(c=>c.id!=='warsaw'))try{out.push(...await read(`data/cities/${c.id}/places.json`));}catch(e){if(e.code!=='ENOENT')throw e;}
  return out.filter(p=>p.image);
};

test('coverKey normalises paths, URLs and Commons thumbnail prefixes',()=>{
  assert.equal(coverKey('route-wawel.jpg'),'route-wawel.jpg');
  assert.equal(coverKey('./assets/images/Route-Wawel.JPG'),'route-wawel.jpg');
  assert.equal(coverKey('https://upload.wikimedia.org/a/b/1280px-Wawel%20x.jpg?x=1'),'wawel x.jpg');
  assert.equal(coverKey(null),'');
});

test('routes sharing stops never share a main photo',()=>{
  const places=new Map([['a',{id:'a',name:'A',image:'a.jpg'}],['b',{id:'b',name:'B',image:'b.jpg'}],['c',{id:'c',name:'C'}]]);
  const routes=[
    {id:'editorial',image:'cover.jpg',stops:['a','b']},
    {id:'r1',stops:['a','b']},
    {id:'r2',stops:['a','b']},
    {id:'r3',stops:['a','b','c']},
    {id:'dup-editorial',image:'./assets/images/COVER.jpg',stops:['c']}
  ];
  const covers=assignRouteCovers(routes,places);
  assert.equal(covers.get('editorial').image,'cover.jpg');
  assert.equal(covers.get('r1').placeId,'a');
  assert.equal(covers.get('r2').placeId,'b');
  assert.equal(covers.get('r3'),null,'no photo is better than a repeated photo');
  assert.equal(covers.get('dup-editorial'),null,'a repeated editorial cover is dropped, not shown twice');
  const shown=[...covers.values()].filter(Boolean).map(c=>coverKey(c.image));
  assert.equal(new Set(shown).size,shown.length);
  assert.equal(assignRouteCovers([{id:'x',stops:['a']}],places,{reserved:['a.jpg']}).get('x'),null,'reserved photos are not reused');
  assert.deepEqual(duplicateCovers(routes),[{key:'cover.jpg',routes:['editorial','dup-editorial']}]);
});

test('every editorial route has its own credited main photo, unique across all cities',async()=>{
  const routes=await allRoutes();
  const keys=new Map(),sources=new Map();
  for(const r of routes){
    assert.ok(r.image,`${r.cityId}/${r.id} has no main photo`);
    assert.match(r.image,/^route-[a-z0-9-]+\.jpg$/,`${r.id} cover must be a local route-*.jpg file`);
    await stat(`assets/images/${r.image}`).catch(()=>assert.fail(`${r.id}: assets/images/${r.image} is missing`));
    const c=r.imageCredit||{};
    for(const k of ['author','license','licenseUrl','source'])assert.ok(c[k],`${r.id} cover credit lacks ${k}`);
    assert.ok(r.imageCaption,`${r.id} cover needs a caption`);
    const key=coverKey(r.image),src=String(c.source).toLowerCase();
    assert.ok(!keys.has(key),`${r.id} repeats the main photo of ${keys.get(key)}`);
    assert.ok(!sources.has(src),`${r.id} uses the same source photo as ${sources.get(src)}`);
    keys.set(key,r.id);sources.set(src,r.id);
  }
  assert.deepEqual(duplicateCovers(routes),[]);
  const placeSources=new Set((await placeImages()).map(p=>String(p.imageCredit?.source||'').toLowerCase()).filter(Boolean));
  for(const r of routes)assert.ok(!placeSources.has(String(r.imageCredit.source).toLowerCase()),`${r.id} cover repeats a place photo`);
});
