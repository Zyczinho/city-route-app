import {sharedStopFraction} from '../route-diversity.js';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {generate, generateAlternatives, summary} from '../core.js';

const point=(id,categoryId,overrides={})=>({
  id, name:id, cityId:'warsaw', lat:52.23, lng:21.01,
  kind:'place', categoryId, cats:[], tags:[], ratings:[],
  foodStyle:'none', tourist:'balanced', partner:false, top:false,
  minutes:20, cost:0, ...overrides
});
const prefs=(extras={})=>({
  time:120, transport:'walking', budget:'premium', food:'none',
  tourist:'balanced', offers:'no', interests:['mix'], ...extras
});

test('outside-only visit never suggests a museum or gallery solely as a facade',()=>{
  const m=point('chopin-museum','museum',{cats:['muzea'],tags:['culture']});
  const g=point('gallery','gallery',{tags:['culture']});
  const park=point('garden','park',{tags:['nature']});
  const outside=generate([m,g,park],prefs({visitMode:'outside',interests:['culture','nature']}));
  assert.deepEqual(outside.map(p=>p.id),['garden']);
  const inside=generate([m],prefs({visitMode:'inside',interests:['culture']}));
  assert.deepEqual(inside.map(p=>p.id),['chopin-museum']);
});

test('new OSM POI with category but no editorial tags/reviews is considered',()=>{
  const imported=point('osm-park','park',{ratings:[],tags:[]});
  const unrelated=point('unrelated','landmark',{ratings:[],tags:[]});
  const chosen=generate([unrelated,imported],prefs({interests:['nature']}));
  assert.equal(chosen[0]?.id,'osm-park','category affinity must work without hand-written tags');
  assert.equal(chosen.length,2,'missing ratings must not cause exclusion');
});

test('mixed-interest planner discourages consecutive copies of one POI category',()=>{
  const places=[
    point('a','park'),
    point('b','park'),
    point('c','museum'),
    point('d','landmark')
  ];
  const result=generate(places,prefs({time:180,visitMode:'inside'}));
  assert.equal(result[0].id,'a');
  assert.equal(result[1].id,'c','category novelty beats the next identical park at the same distance');
  assert.ok(summary(result).minutes<=180);
});

test('mixed-interest variants remain deterministic and within the configured time budget',()=>{
  const places=[
    point('garden-a','park',{lat:52.21,lng:21.01}),
    point('garden-b','garden',{lat:52.211,lng:21.011}),
    point('museum','museum',{lat:52.212,lng:21.012}),
    point('river','waterfront',{lat:52.2125,lng:21.013}),
    point('landmark','landmark',{lat:52.213,lng:21.012}),
    point('view','viewpoint',{lat:52.215,lng:21.015})
  ];
  const config=prefs({time:120,visitMode:'outside'});
  const variants=generateAlternatives(places,config,{count:3});
  assert.deepEqual(variants,generateAlternatives(places,config,{count:3}));
  for(const v of variants){
    assert.ok(v.every(p=>p.categoryId!=='museum'));
    assert.ok(summary(v,'walking').minutes<=config.time);
  }
});

test('actual Warsaw OSM layer participates in route generation alongside the editorial seed',()=>{
  const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
  const editorial=read('../data/places.json');
  const imported=read('../data/cities/warsaw/places.json');
  assert.ok(imported.length>=250,'latest Warsaw import fixture must be present');
  const ids=new Set(imported.map(p=>p.id));
  const chosen=generate([...editorial,...imported],prefs({
    time:480,interests:['nature'],start:{lat:52.2297,lng:21.0122},visitMode:'outside'
  }));
  assert.ok(chosen.length>0,'route should be feasible');
  assert.ok(chosen.some(p=>ids.has(p.id)),'the generated route should use some of the newly imported Warsaw layer');
});

test('V1 rejects an alternative that is a subset of another route',()=>{
 assert.equal(sharedStopFraction(['a','b'],['a','b','c','d']),1);
 const all=Array.from({length:16},(_,i)=>point('v-'+i,['park','landmark','garden','viewpoint'][i%4],{lat:52.23+(i%4)*0.0004,lng:21.01+Math.floor(i/4)*0.0004}));
 const routes=generateAlternatives(all,prefs({time:100,interests:['mix']}),{count:3});
 assert.ok(routes.length>=2);
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)
  assert.ok(sharedStopFraction(routes[i],routes[j])<=0.55);
});
