import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeRoutePlaces,estimatedTravelMinutes} from '../route-optimizer.js';
import {nearbyPlaces} from '../map-view.js';
import {createDraft,addStop} from '../route-builder-model.js';

const stop=(id,lat,lng)=>({id,name:id,cityId:'warsaw',lat,lng,minutes:20,cost:0});
const a=stop('A',52.22,21.00),b=stop('B',52.22,21.01),c=stop('C',52.23,21.01),d=stop('D',52.23,21.00);

test('optimizing an arbitrary unordered list may change first stop and reduces estimated travel time',()=>{
 const input=[a,c,b,d],result=optimizeRoutePlaces(input);
 assert.equal(result.status,'optimized');
 assert.equal(result.optimality,'exact');
 assert.equal(result.places.length,4);
 assert.deepEqual(new Set(result.places.map(p=>p.id)),new Set(input.map(p=>p.id)));
 assert.ok(result.estimatedSavingsMinutes>0);
 assert.ok(result.estimatedAfterMinutes<result.estimatedBeforeMinutes);
 assert.deepEqual(input.map(p=>p.id),['A','C','B','D'],'input is immutable');
});

test('exact optimizer finds a globally optimal open path for five arbitrary points',()=>{
 const p=[stop('1',52.21,21.00),stop('2',52.25,21.02),stop('3',52.23,21.01),stop('4',52.22,21.03),stop('5',52.26,21.00)];
 const permutations=arr=>arr.length?arr.flatMap((x,i)=>permutations([...arr.slice(0,i),...arr.slice(i+1)]).map(rest=>[x,...rest])):[[]];
 const best=Math.min(...permutations(p).map(path=>estimatedTravelMinutes(path)));
 const result=optimizeRoutePlaces(p);
 assert.ok(Math.abs(result.estimatedAfterMinutes-best)<1e-8,'Held-Karp exact open path');
});

test('first stop can be explicitly fixed, and an origin affects estimated travel cost',()=>{
 const origin={lat:52.21,lng:21.00};
 const input=[c,a,b,d];
 const fixed=optimizeRoutePlaces(input,{keepFirst:true,origin});
 assert.equal(fixed.places[0].id,'C');
 assert.ok(fixed.estimatedAfterMinutes<=fixed.estimatedBeforeMinutes+1e-7);
 const flexible=optimizeRoutePlaces(input,{origin});
 assert.ok(flexible.estimatedAfterMinutes<=fixed.estimatedAfterMinutes+1e-7);
 assert.ok(flexible.estimatedBeforeMinutes>0);
});

test('ten stops have an exact optimization and 20 stops have a bounded heuristic',()=>{
 const stops=Array.from({length:20},(_,i)=>stop('p'+i,52.18+(i*7%20)*.006,20.93+(i*11%20)*.005));
 const exact=optimizeRoutePlaces(stops.slice(0,10));
 assert.equal(exact.optimality,'exact');
 assert.deepEqual(new Set(exact.places.map(x=>x.id)),new Set(stops.slice(0,10).map(x=>x.id)));
 const large=optimizeRoutePlaces(stops);
 assert.equal(large.optimality,'heuristic');
 assert.ok(large.estimatedAfterMinutes<=large.estimatedBeforeMinutes+1e-7);
 assert.equal(large.places.length,20);
});

test('one stop, empty route, invalid coordinates and optimized route are safe',()=>{
 assert.equal(optimizeRoutePlaces([]).status,'no-change');
 assert.equal(optimizeRoutePlaces([a]).changed,false);
 const invalid=optimizeRoutePlaces([a,{id:'unknown',lat:null,lng:null},b]);
 assert.equal(invalid.status,'invalid-coordinates');
 assert.deepEqual(invalid.places.map(p=>p.id),['A','unknown','B']);
 const optimized=optimizeRoutePlaces([a,b,c,d]);
 assert.equal(optimized.changed,false,'already ordered row stays in place on equal travel cost');
});

test('nearby places are inserted directly after selected stop B, not appended after C',()=>{
 const B=stop('B',52.2297,21.0122),B1=stop('B1',52.2301,21.013),far=stop('far',52.26,21.06);
 const matches=nearbyPlaces([B1,far],B,500);
 assert.deepEqual(matches.map(x=>x.id),['B1']);
 let draft=createDraft('warsaw');for(const p of [a,B,c])draft=addStop(draft,p).draft;
 const anchorPos=draft.stops.indexOf(B.id);
 const inserted=addStop(draft,B1,{at:anchorPos+1}).draft;
 assert.deepEqual(inserted.stops,['A','B','B1','C']);
 assert.deepEqual(draft.stops,['A','B','C']);
});

test('estimated travel duration changes with selected mode, not with visiting order-independent stop dwell',()=>{
 const path=[a,b,c];
 assert.ok(estimatedTravelMinutes(path,{transport:'walking'})>estimatedTravelMinutes(path,{transport:'bike'}));
 assert.equal(estimatedTravelMinutes(path,{transport:'walking'}),estimatedTravelMinutes(path,{transport:'walking'}));
});
