import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate,generateAlternatives} from '../core.js';
import {planRoutesV2} from '../route-planner-v2.js';
import {ROUTE_INTERESTS,routeAllowedByFocus,routeInterestMatch,routeKnownCost,routeBudgetLimit,routeBudgetEligible,isExcludedRoutePlace} from '../route-preferences.js';

const lisbon=JSON.parse(readFileSync(new URL('../data/cities/lisbon/places.json',import.meta.url),'utf8'));
const config=(extra={})=>({cityId:'lisbon',visitDate:'2026-11-16',startTime:'19:00',
 time:180,transport:'walking',budget:'premium',interests:['bary'],focus:'only',
 food:'none',avoid:[],visitMode:'mix',offers:'no',tourist:'balanced',...extra});
const opts={count:3,candidateLimit:72,beamWidth:32,maxExpansions:10000};

test('Start options match the fine-grained POI category vocabulary without saved/mine filtering',()=>{
 const expected=['mix','zabytki','muzea','zielen','widoki','woda','ulice','okolice','jedzenie','bary','kluby','aktywnosci','sidequests'];
 assert.deepEqual(ROUTE_INTERESTS.map(x=>x.id),expected);
});

test('Lisbon: ONLY bars returns bars, also without a forced food stop',()=>{
 const prefs=config();
 const out=planRoutesV2(lisbon,prefs,opts);
 assert.ok(out.routes.length>0,'nightlife candidates must no longer be hard blocked');
 const bar=p=>['bar','pub','cocktail_bar','wine_bar','live_music'].includes(p.categoryId);
 for(const r of out.routes){
  assert.ok(r.stops.length>0);
  assert.ok(r.stops.every(bar),'no monuments or restaurants in bars-only');
 }
 const transit=generate(lisbon,{...prefs,transport:'transit'});
 assert.ok(transit.length>0,'V1 must also support bars-only');
 assert.ok(transit.every(bar));
});

test('Lisbon: ONLY clubs, gardens, religious sites never leaks an unrelated category',()=>{
 for(const [interests,preciseTypes,expected] of [
  [['kluby'],[],p=>p.categoryId==='club'],
  [['zielen'],['garden'],p=>p.categoryId==='garden'],
  [['zabytki'],['religious_site'],p=>p.categoryId==='religious_site']
 ]){
  const prefs=config({interests,preciseTypes,time:180,startTime:'14:00'});
  const res=planRoutesV2(lisbon,prefs,opts);
  assert.ok(res.routes.length>0,'expected places for '+interests.join(',')+'/'+preciseTypes.join(','));
  assert.ok(res.routes.every(r=>r.stops.every(expected)),JSON.stringify(res.routes.map(r=>r.stopIds)));
 }
});

test('exclusions override a positive focus (conflicting choices produce no misleading substitutes)',()=>{
 const prefs=config({avoid:['nightlife']});
 const v2=planRoutesV2(lisbon,prefs,opts);
 assert.equal(v2.routes.length,0);
 assert.deepEqual(generate(lisbon,{...prefs,transport:'transit'}),[]);
});

test('garden and temple subtypes do not depend on the inside/outside mode',()=>{
 const club=lisbon.find(p=>p.categoryId==='club');
 assert.ok(routeAllowedByFocus(club,config({interests:['kluby'],visitMode:'outside'})));
 const garden=lisbon.find(p=>p.categoryId==='garden');
 assert.ok(routeAllowedByFocus(garden,config({interests:['mix'],preciseTypes:['garden']})));
 const temple=lisbon.find(p=>p.categoryId==='religious_site');
 assert.ok(routeAllowedByFocus(temple,config({interests:['mix'],preciseTypes:['religious_site']})));
 assert.ok(!routeAllowedByFocus(garden,config({interests:['mix'],preciseTypes:['religious_site']})));
 assert.ok(!routeAllowedByFocus(club,config({interests:['mix']})));
});

test('Lisbon 0 cost is unknown, not a verified free entry or free restaurant meal',()=>{
 const bar=lisbon.find(p=>p.categoryId==='bar');
 assert.equal(bar.cost,0);assert.equal(routeKnownCost(bar),null);
 assert.equal(routeBudgetEligible(bar,config({budget:'free'})),false);
 assert.equal(routeBudgetEligible(bar,config({budget:'custom',budgetAmount:250})),true);
 assert.equal(routeBudgetLimit(config({budget:'custom',budgetAmount:250})),250);
 assert.equal(routeBudgetLimit(config({budget:'custom',budgetAmount:'invalid'})),NaN);
 assert.equal(routeBudgetEligible({...bar,cost:0,priceVerified:true},config({budget:'free'})),true);
 assert.equal(routeBudgetEligible({...bar,cost:40},config({budget:'custom',budgetAmount:25})),false);
});

test('new filter choices and date placement are visible in Start without a duplicate builder',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),ux=readFileSync(new URL('../ux-cleanup.js',import.meta.url),'utf8');
 assert.match(app,/name="preciseTypes"/);
 assert.match(app,/radio\('focus'/);
 assert.match(app,/radio\('budget'/);
 assert.match(app,/name="budgetAmount"/);
 assert.match(app,/city\(\)\.currency/);
 assert.match(app,/route-plan-feedback/);
 assert.match(ux,/form\.replaceChildren\(climate\.details,primary,\.\.\.\(feedback\?\[feedback\]:\[\]\),submit,alternatives,advanced\.details,whenDetails\.details\)/);
});
