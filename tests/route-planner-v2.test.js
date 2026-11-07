import test from 'node:test';
import assert from 'node:assert/strict';
import {planRoutesV2} from '../route-planner-v2.js';
import {runBenchmark,SCENARIOS,WARSAW_CATALOGUE,WARSAW_OSM} from '../scripts/evaluate-planner-v2.mjs';

const origin={id:'test-origin',lat:52.2300,lng:21.0130};
const prefs=(overrides={})=>({
  cityId:'warsaw',visitDate:'2026-11-07',startTime:'10:00',
  time:240,transport:'walking',interests:['mix'],food:'none',
  budget:'premium',offers:'no',visitMode:'inside',start:origin,...overrides
});
const p=(id,cat,extra={})=>({
  id,name:id,cityId:'warsaw',categoryId:cat,lat:52.23,lng:21.013,
  minutes:25,cost:0,foodStyle:'none',tags:[],ratings:[],
  partner:false,kind:'place',...extra
});

test('latest Warsaw fixture: 50 editorial and 258 imported, no Google rating threshold required',()=>{
  assert.equal(WARSAW_CATALOGUE.length,308);
  assert.equal(WARSAW_OSM.length,258);
  assert.ok(WARSAW_OSM.some(p=>p.ratings?.length===0));
});
const benchmarks=runBenchmark();
assert.equal(benchmarks.length,10,'all ten scenarios must execute');
for(let i=0;i<benchmarks.length;i++){
  test('Warsaw scenario '+benchmarks[i].scenario+' stays in its true experience budget',()=>{
    const b=benchmarks[i];
    assert.ok(b.options>0,`no plan for ${b.scenario}: ${b.reason}`);
    assert.ok(b.budgetRespected,`over budget for ${b.scenario}`);
    assert.ok(b.stopCount>=1&&b.stopCount<=8);
    assert.ok(b.totalMinutes<=b.requestedMinutes);
    assert.equal(b.totalMinutes,b.travelMinutes+b.visitMinutes+b.restMinutes+b.waitMinutes);
    assert.equal(new Set(b.stopIds).size,b.stopIds.length,'no place may repeat');
    assert.ok(b.route.rows.every(row=>Number.isFinite(row.departureMinute)));
    assert.ok(b.estimatedLegs>=0,'offline is transparent about approximate legs');
  });
}
test('benchmark actually compares thousands of candidates, and OSM venues appear in some routes',()=>{
  assert.ok(benchmarks.some(b=>b.considered>=1000),'beam search should compare thousands of combinations');
  assert.ok(benchmarks.some(b=>b.newOsmStops>0),'recent OSM venues must be eligible and actually selected');
});
test('outside-only excludes exhibitions and the known-closed Chopin museum is never proposed',()=>{
  const museum=p('chopin-museum','museum',{cats:['muzea'],tags:['culture'],minutes:60});
  const library=p('garden','garden',{tags:['nature']});
  const noIndoor=planRoutesV2([museum,library],prefs({visitMode:'outside',interests:['culture','nature']}));
  assert.ok(noIndoor.routes.length>0);
  assert.ok(noIndoor.routes.every(r=>!r.stopIds.includes('chopin-museum')));
  const closed=planRoutesV2([museum],prefs({visitMode:'inside',interests:['culture']}));
  assert.equal(closed.routes.length,0,'editorial opening-hour closure is a hard constraint');
});
test('no reviews is never an eligibility criterion, and normalized categories match interests',()=>{
  const highRating=p('irrelevant','landmark',{ratings:[{value:5,max:5,reviewCount:20000}]});
  const unrated=p('new-natural-spot','park',{ratings:[],tags:[],lat:52.2301,lng:21.0131});
  const out=planRoutesV2([highRating,unrated],prefs({time:60,interests:['nature']}),{count:2});
  assert.ok(out.routes[0].stopIds.includes('new-natural-spot'));
});
test('a pause is accounted for when visiting two demanding attractions',()=>{
  const a=p('a','landmark',{minutes:65,lat:52.230,lng:21.013});
  const b=p('b','landmark',{minutes:65,lat:52.231,lng:21.014});
  const out=planRoutesV2([a,b],prefs({time:240}),{restInterval:100,restMinutes:12,maxStops:2});
  const two=out.routes.find(r=>r.stopIds.length===2);
  assert.ok(two,'should offer a plan that includes both');
  assert.equal(two.breakdown.rests,12);
  assert.equal(two.totalMinutes,Object.values(two.breakdown).reduce((a,b)=>a+b,0));
});
test('transit without an actual leg matrix is never fabricated; directed matrix is supported',()=>{
  const a=p('a','landmark',{lat:52.229,lng:21.014,minutes:20});
  const b=p('b','park',{lat:52.228,lng:21.016,minutes:20});
  const config=prefs({transport:'transit',time:150});
  const missing=planRoutesV2([a,b],config);
  assert.equal(missing.routes.length,0);
  assert.equal(missing.reason,'transit-matrix-required');
  const matrix={
    'test-origin>a':{minutes:13,source:'transit-feed'},
    'test-origin>b':{minutes:19,source:'transit-feed'},
    'a>b':{minutes:9,source:'transit-feed'},
    'b>a':{minutes:17,source:'transit-feed'}
  };
  const withMatrix=planRoutesV2([a,b],config,{matrix});
  assert.ok(withMatrix.routes.length>0);
  assert.ok(withMatrix.routes.every(r=>r.estimatedLegs===0));
  assert.ok(withMatrix.routes.every(r=>r.rows.every(row=>row.travelSource==='transit-feed')));
});
test('route search is deterministic for the same catalogue and preferences',()=>{
  const subset=WARSAW_CATALOGUE.slice(0,65);
  const config=prefs({time:120,interests:['nature'],visitMode:'outside'});
  const first=planRoutesV2(subset,config,{beamWidth:12,maxExpansions:5000});
  const second=planRoutesV2(subset,config,{beamWidth:12,maxExpansions:5000});
  assert.deepEqual(first,second);
});
