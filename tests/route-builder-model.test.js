import test from 'node:test';
import assert from 'node:assert/strict';
import {moveStop as coreMoveStop} from '../core.js';
import {MAX_STOPS,createDraft,hydrateDraft,addStop,removeStop,moveStop,moveStopBy,moveStopBefore,clearDraft,setName,setTransport,serializeDraft,toRoute,hasStop,stopPosition} from '../route-builder-model.js';

const NOW='2026-11-03T10:00:00.000Z';
const krk=id=>({id,cityId:'krakow',name:id});
const build=(...ids)=>ids.reduce((d,id)=>addStop(d,krk(id)).draft,createDraft('krakow'));

test('create and hydrate a city draft from today\'s basket array',()=>{
  const d=createDraft('krakow',{now:NOW});
  assert.deepEqual(serializeDraft(d),{version:1,cityId:'krakow',stops:[],name:'',transport:'walking',revision:0,updatedAt:NOW});
  assert.throws(()=>createDraft(''),/city-missing/);
  const known=new Set(['a','b','c']);
  const {draft,report}=hydrateDraft(['a','x','b','a',' c ',null,42],{cityId:'krakow',isKnown:id=>known.has(id)});
  assert.deepEqual(draft.stops,['a','b','c'],'keeps stored order, trims ids');
  assert.deepEqual(report,{dropped:['x','42'],deduped:['a'],crossCity:false});
  assert.deepEqual(hydrateDraft('garbage',{cityId:'krakow'}).draft.stops,[]);
  const roundtrip=hydrateDraft(serializeDraft(setName(build('a','b'),'Wieczór').draft),{cityId:'krakow'}).draft;
  assert.equal(roundtrip.name,'Wieczór');
  assert.deepEqual(roundtrip.stops,['a','b']);
  assert.equal(roundtrip.revision,3);
});

test('hydration never crosses cities and respects the stop limit',()=>{
  const stored={cityId:'warsaw',stops:['castle','old-town']};
  const {draft,report}=hydrateDraft(stored,{cityId:'krakow'});
  assert.deepEqual(draft.stops,[]);
  assert.equal(report.crossCity,true);
  assert.deepEqual(report.dropped,['castle','old-town']);
  const many=Array.from({length:MAX_STOPS+3},(_,i)=>`p${i}`);
  const h=hydrateDraft(many,{cityId:'krakow'});
  assert.equal(h.draft.stops.length,MAX_STOPS);
  assert.deepEqual(h.report.dropped,['p20','p21','p22']);
});

test('add keeps places unique, ordered and inside the draft city',()=>{
  let d=createDraft('krakow');
  let r=addStop(d,krk('wawel'),{now:NOW});
  assert.equal(r.changed,true);assert.equal(r.draft.revision,1);assert.equal(r.draft.updatedAt,NOW);
  d=r.draft;
  r=addStop(d,krk('wawel'));
  assert.equal(r.error,'duplicate');assert.equal(r.changed,false);assert.equal(r.draft,d,'no-op returns the same object');
  r=addStop(d,{id:'castle',cityId:'warsaw'});
  assert.equal(r.error,'cross-city');assert.equal(r.draft,d);
  assert.equal(addStop(d,{id:'legacy'}).changed,true,'places without cityId belong to the draft city');
  assert.equal(addStop(d,'').error,'invalid');
  d=addStop(addStop(d,'rynek').draft,'plac-nowy',{at:0}).draft;
  assert.deepEqual(d.stops,['plac-nowy','wawel','rynek']);
  assert.deepEqual(addStop(d,'x',{at:99}).draft.stops.at(-1),'x');
  let full=createDraft('krakow');for(let i=0;i<MAX_STOPS;i++)full=addStop(full,`p${i}`).draft;
  assert.equal(addStop(full,'one-more').error,'limit');
});

test('operations never mutate their input',()=>{
  const d=build('a','b','c'),snapshot=JSON.stringify(d);
  addStop(d,'d');removeStop(d,'a');moveStop(d,'a',2);moveStopBy(d,'c',-1);moveStopBefore(d,'c','a');clearDraft(d);setName(d,'X');setTransport(d,'bike');
  assert.equal(JSON.stringify(d),snapshot);
  assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.stops));
});

test('remove and clear are idempotent',()=>{
  const d=build('a','b');
  const r=removeStop(d,'a');
  assert.deepEqual(r.draft.stops,['b']);
  assert.equal(removeStop(r.draft,'a').changed,false);
  const c=clearDraft(d,{now:NOW});
  assert.deepEqual(c.draft.stops,[]);assert.equal(c.draft.updatedAt,NOW);
  assert.equal(clearDraft(c.draft).draft,c.draft);
  assert.equal(setName(c.draft,'  Wieczór   na  Kazimierzu ').draft.name,'Wieczór na Kazimierzu');
  assert.equal(clearDraft(setName(d,'Keep').draft).draft.name,'Keep','clear keeps name and transport');
});

test('move by index, by keyboard step and by drop target',()=>{
  const d=build('a','b','c','d');
  assert.deepEqual(moveStop(d,'a',2).draft.stops,['b','c','a','d']);
  assert.deepEqual(moveStop(d,'d',-5).draft.stops,['d','a','b','c'],'index is clamped');
  assert.equal(moveStop(d,'b',1).changed,false);
  assert.equal(moveStop(d,'zz',0).changed,false);
  assert.deepEqual(moveStopBy(d,'c',-1).draft.stops,['a','c','b','d']);
  assert.equal(moveStopBy(d,'a',-1).changed,false,'top edge');
  assert.equal(moveStopBy(d,'d',1).changed,false,'bottom edge');
  assert.equal(moveStopBefore(d,'a','a').changed,false);
  assert.equal(moveStopBefore(d,'a','missing').changed,false);
});

test('drag-and-drop matches the existing core.moveStop for every pair',()=>{
  const ids=['a','b','c','d','e'],d=build(...ids);
  for(const from of ids)for(const to of ids)assert.deepEqual([...moveStopBefore(d,from,to).draft.stops],coreMoveStop(ids,from,to),`${from}->${to}`);
});

test('transport, serialization and route shape',()=>{
  const d=build('a','b');
  assert.equal(setTransport(d,'bike').draft.transport,'bike');
  assert.equal(setTransport(d,'rocket').error,'invalid');
  assert.equal(setTransport(d,'walking').changed,false);
  assert.deepEqual(toRoute(d),{id:'draft',cityId:'krakow',name:'Moja trasa',description:'',stops:['a','b'],transport:'walking',cats:[]});
  assert.equal(toRoute(setName(d,'Mój Kraków').draft,{id:'mine-1'}).name,'Mój Kraków');
  assert.equal(hasStop(d,'b'),true);
  assert.deepEqual(stopPosition(d,'b'),{index:1,number:2,total:2});
  assert.equal(stopPosition(d,'zz'),null);
  const s=serializeDraft(d);s.stops.push('mutated');
  assert.deepEqual(d.stops,['a','b'],'serialized copy is detached');
});

test('same input gives the same output',()=>{
  const run=()=>JSON.stringify(serializeDraft(moveStopBy(addStop(build('a','b','c'),'d',{at:1,now:NOW}).draft,'a',2,{now:NOW}).draft));
  assert.equal(run(),run());
});
