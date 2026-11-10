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
 const expected=['mix','zabytki','swiatynie','muzea','zielen','ogrody','widoki','woda','ulice','okolice','jedzenie','bary','kluby','aktywnosci','sidequests'];
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

test('Lisbon: ONLY gardens, religious sites never leaks an unrelated category',()=>{
 for(const [interests,preciseTypes,expected] of [
  [['zielen'],['garden'],p=>p.categoryId==='garden'],
  [['zabytki'],['religious_site'],p=>p.categoryId==='religious_site']
 ]){
  const prefs=config({interests,preciseTypes,time:180,startTime:'14:00'});
  const res=planRoutesV2(lisbon,prefs,opts);
  assert.ok(res.routes.length>0,'expected places for '+interests.join(',')+'/'+preciseTypes.join(','));
  assert.ok(res.routes.every(r=>r.stops.every(expected)),JSON.stringify(res.routes.map(r=>r.stopIds)));
 }
});

test('Lisbon: ONLY clubs at 14:00 explains the closure instead of leaking another category',()=>{
 const res=planRoutesV2(lisbon,config({interests:['kluby'],time:180,startTime:'14:00'}),opts);
 assert.equal(res.routes.length,0,'clubs are closed in the afternoon: '+JSON.stringify(res.routes.map(r=>r.stopIds)));
 assert.equal(res.reason,'interests-closed');
 assert.deepEqual(res.hints.closedInterests.map(c=>c.id),['kluby']);
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

test('Start V3 asks only what changes the plan; date and time stay visible',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),ux=readFileSync(new URL('../ux-cleanup.js',import.meta.url),'utf8');
 for(const removed of [/name="preciseTypes"/,/radio\('focus'/,/radio\('visitMode'/,/radio\('tourist'/,/radio\('offers'/,/Mieszany \(szacunkowo\)/,/radio\('budget'/,/name="budgetAmount"/])
  assert.doesNotMatch(app,removed);
 assert.match(app,/name="coffee" value="yes" checked/);
 assert.match(app,/Kawa lub lokalna przekąska/);
 assert.match(app,/prefs\.focus=prefs\.interests\.includes\('mix'\)\?'prefer':'only'/,'chosen categories mean only these');
 assert.match(app,/prefs\.coffee=data\.get\('coffee'\)==='yes'\?'yes':'no'/);
 assert.match(app,/return prefs\.coffee==='yes'&&Number\(prefs\.time\)>=240&&h\*60\+m<17\*60\?'quick':'none'/,'automatic coffee only for daytime plans of 4 h or more');
 assert.match(app,/if\(prefs\.coffee\)prefs\.food=autoBreak\(prefs\)/);
 assert.match(app,/route-plan-feedback/);
 assert.match(ux,/primary\.append\(when\)/);
 assert.match(ux,/form\.replaceChildren\(climate\.details,primary,\.\.\.\(feedback\?\[feedback\]:\[\]\),submit,alternatives,advanced\.details\)/);
});

test('temples and gardens are ordinary interests, and gardens no longer require a subtype toggle',()=>{
 const garden=lisbon.find(p=>p.categoryId==='garden'),temple=lisbon.find(p=>p.categoryId==='religious_site');
 assert.ok(routeInterestMatch(garden,'ogrody')&&routeInterestMatch(garden,'zielen'));
 assert.ok(routeInterestMatch(temple,'swiatynie')&&routeInterestMatch(temple,'zabytki'));
 assert.ok(!routeInterestMatch(lisbon.find(p=>p.categoryId==='park'),'ogrody'));
 const res=planRoutesV2(lisbon,config({interests:['ogrody'],time:120,startTime:'11:00'}),opts);
 assert.ok(res.routes.length>0);
 assert.ok(res.routes.every(r=>r.stops.every(p=>p.categoryId==='garden')));
});
