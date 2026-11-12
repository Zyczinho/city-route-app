// Planner reliability P0 (audit 2026-11-10): the founder's Lisbon request returned
// "Nie znaleziono wykonalnej trasy" because every café was labelled as a sit-down meal and the
// coffee break was a hard filter; bars were also scheduled at 10:00 because only a few museums
// had opening hours. These tests pin the fixed behaviour on the real checked-in catalogue.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRoutesV2} from '../route-planner-v2.js';
import {openingFor,parseOsmOpeningHours,openWindows,visitSlot,osmOpeningHoursOf} from '../opening-hours.js';
import {routeBreakSuitable} from '../route-preferences.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const lisbon=read('../data/cities/lisbon/places.json').map(p=>({...p,cityId:'lisbon'}));
const opts={count:3,candidateLimit:72,beamWidth:32,maxExpansions:12000};
// Exactly the Start choices from the founder report; the origin is Bairro Alto ("Erasmus Corner").
const founder=(extra={})=>({cityId:'lisbon',visitDate:'2026-11-11',startTime:'10:00',time:'360',
 interests:['okolice','jedzenie','bary','kluby'],focus:'prefer',transport:'walking',food:'quick',
 visitMode:'mix',tourist:'balanced',offers:'no',avoid:[],preciseTypes:[],
 start:{lat:38.7117,lng:-9.1455,id:'custom-origin'},...extra});
const insideWindow=(place,row,date)=>{
 const hours=openingFor(place,{cityId:'lisbon',date,mode:'mix'});
 if(!Array.isArray(hours.intervals))return true;
 return hours.intervals.some(([open,close])=>open<=row.visitStartMinute&&row.departureMinute<=close);
};

test('Lisbon cafés are quick stops in the fallback JSON, the importer and a forward migration',()=>{
 const cafes=lisbon.filter(p=>p.categoryId==='cafe');
 assert.ok(cafes.length>=20);
 assert.ok(cafes.every(p=>p.foodStyle==='quick'),'every café must be a quick stop');
 const importer=readFileSync(new URL('../scripts/import-lisbon-osm.mjs',import.meta.url),'utf8');
 assert.match(importer,/import \{foodFor\} from '\.\/city-curation\.mjs'/);
 assert.doesNotMatch(importer,/\['restaurant','cafe'\]\.includes\(cat\)\?'sit'/);
 const sql=readFileSync(new URL('../supabase/migrations/028_lisbon_cafe_quick_food_style.sql',import.meta.url),'utf8');
 assert.match(sql,/set food_style='quick'/);
 assert.match(sql,/category_id='cafe'/);
 assert.match(sql,/metadata->'source'->>'provider'='openstreetmap'/);
 assert.doesNotMatch(sql,/\bdelete\b|\bdrop\b|\btruncate\b/i,'additive data correction only');
});

test('founder scenario: Lisbon, 10:00, 6 h, coffee break now returns real, open-at-visit routes',()=>{
 const result=planRoutesV2(lisbon,founder(),opts);
 assert.equal(result.reason,null);
 assert.ok(result.routes.length>=1,'the reported request must produce a plan');
 const byId=new Map(lisbon.map(p=>[p.id,p]));
 for(const route of result.routes){
  assert.ok(route.totalMinutes<=360);
  for(const row of route.rows)assert.ok(insideWindow(byId.get(row.id),row,'2026-11-11'),`${row.name} is closed at ${row.visitStartMinute}`);
  const index=route.stopIds.indexOf(route.breakStopId);
  assert.ok(index>0&&index<route.stopIds.length-1,'the coffee break interrupts the route');
  assert.ok(routeBreakSuitable(byId.get(route.breakStopId),'quick'));
  assert.equal(route.rows[index].role,'break');
 }
 assert.ok(result.hints.closedInterests.some(c=>c.id==='kluby'),'clubs are closed in the daytime and the user is told');
});

test('stale sit-down labels (Supabase before migration 028) no longer break the coffee request',()=>{
 const stale=lisbon.map(p=>p.categoryId==='cafe'?{...p,foodStyle:'sit'}:p);
 const result=planRoutesV2(stale,founder(),opts);
 assert.ok(result.routes.length>=1);
 assert.ok(result.routes.every(r=>r.breakStopId&&stale.find(p=>p.id===r.breakStopId).categoryId==='cafe'));
});

test('a requested break is a soft slot: no café keeps the route and explains it',()=>{
 const noCafe=lisbon.filter(p=>!['cafe','bakery','dessert','breakfast','street_food','food_hall'].includes(p.categoryId));
 const result=planRoutesV2(noCafe,founder({interests:['zabytki','widoki']}),opts);
 assert.ok(result.routes.length>=1,'missing break venues must not erase the whole plan');
 assert.ok(result.routes.every(r=>r.relaxations.includes('break-dropped')&&r.breakStopId===null));
});

test('choosing food as a theme is no longer cut to one stop by the coffee break',()=>{
 const result=planRoutesV2(lisbon,founder({interests:['jedzenie'],focus:'only',startTime:'11:00'}),opts);
 assert.ok(result.routes.length>=1);
 assert.ok(result.routes.some(r=>r.stops.filter(p=>p.categoryId==='restaurant').length>=1),'restaurants stay eligible for a food route');
 assert.ok(result.routes.some(r=>r.rows.filter(row=>row.role!=='stop').length>=3),'several food stops are allowed');
});

test('bars are only planned while open; a closed choice gets a concrete later start',()=>{
 const day=planRoutesV2(lisbon,founder({interests:['bary'],focus:'only',food:'none'}),opts);
 const byId=new Map(lisbon.map(p=>[p.id,p]));
 for(const route of day.routes)for(const row of route.rows)assert.ok(insideWindow(byId.get(row.id),row,'2026-11-11'));
 const bars=['a','b','c'].map((id,i)=>({id:'bar-'+id,name:'Bar '+id,cityId:'lisbon',categoryId:'bar',lat:38.711+i*0.001,lng:-9.145,
  minutes:60,cost:0,foodStyle:'none',tags:['nightlife'],ratings:[],osmTags:{opening_hours:'Mo-Su 18:00-02:00'}}));
 const closed=planRoutesV2(bars,founder({interests:['bary'],focus:'only',food:'none',time:'120'}),opts);
 assert.equal(closed.routes.length,0);
 assert.equal(closed.reason,'interests-closed');
 assert.deepEqual(closed.hints.closedInterests.map(c=>[c.id,c.suggestedStart]),[['bary','18:00']]);
 const evening=planRoutesV2(bars,founder({interests:['bary'],focus:'only',food:'none',time:'120',startTime:'18:00'}),opts);
 assert.ok(evening.routes.length>=1);
});

test('exclusions still win and produce an explicit no-candidates reason',()=>{
 const result=planRoutesV2(lisbon,founder({interests:['bary'],focus:'only',food:'none',avoid:['nightlife']}),opts);
 assert.equal(result.routes.length,0);
 assert.equal(result.reason,'no-candidates');
 assert.ok(result.diagnostics.rejected.excluded>0);
});

test('OSM opening_hours subset: weekdays, overnight spans, months, dates and additional rules',()=>{
 const windows=(value,date)=>openWindows(parseOsmOpeningHours(value),date);
 assert.deepEqual(windows('Mo-Fr 18:00-02:00, Su 21:00-02:00, Sa 18:00-03:00, PH 18:00-03:00','2026-11-11'),[[0,120],[1080,1560],[2520,2880]]);
 assert.deepEqual(windows('Oct-Apr: Tu-Su 10:00-17:30; May-Sep: Tu-Su 10:00-18:30','2026-11-09'),[[2040,2490]],'closed on Monday');
 assert.deepEqual(windows('09:00-20:00; Oct 01-Mar 31: 09:00-17:00','2026-11-11'),[[540,1020],[1980,2460]]);
 assert.deepEqual(windows('PH,Th-Tu 11:00-02:00','2026-11-11'),[[0,120],[2100,2880]]);
 assert.deepEqual(windows('Tu-Fr 10:00-18:00; Sa,Su 10:00-13:00,14:00-18:00; Jan 01,May 01,Jun 13,Dec 24-25,31 off; easter off','2026-12-25'),[[2040,2220],[2280,2520]]);
 assert.deepEqual(windows('24/7','2026-11-11'),[[0,2880]]);
 assert.deepEqual(windows('Mo-Fr 11:00+','2026-11-11'),[[660,1020],[2100,2460]]);
 for(const bad of ['Su 16:00-:00','Pon-Czw 14:30–19:00','Mo-Fr 12:00+; Sa-Su','Mo-Sa 06:30 20:00'])assert.equal(parseOsmOpeningHours(bad),null,bad);
});

test('unreadable or missing hours are never reported as closed',()=>{
 const pub={id:'pub',categoryId:'pub',osmTags:{opening_hours:'Mo-We 16:00-00:00; Su 16:00-:00'}};
 const hours=openingFor(pub,{cityId:'lisbon',date:'2026-11-11',mode:'mix'});
 assert.equal(hours.status,'typical','an unreadable pub value falls back to typical evening hours');
 assert.equal(visitSlot(hours,600,60,{maxWait:45}),null,'not at 10:00');
 const museum={id:'m',categoryId:'museum',cats:['muzea'],osmTags:{opening_hours:'Pon-Czw 10:00-18:00'}};
 assert.equal(openingFor(museum,{cityId:'lisbon',date:'2026-11-11'}).status,'unknown');
 assert.equal(openingFor({id:'park',categoryId:'park'},{cityId:'lisbon',date:'2026-11-11'}).status,'not-applicable');
 assert.equal(openingFor({id:'c',categoryId:'club'},{cityId:'lisbon',date:'2026-11-11'}).status,'typical');
});

test('the parser reads at least 95% of the real checked-in OpenStreetMap values',()=>{
 const values=[...new Set([
  ...lisbon,...read('../data/cities/warsaw/places.json'),...read('../data/cities/krakow/places.json')
 ].map(osmOpeningHoursOf).filter(Boolean))];
 const unread=values.filter(v=>!parseOsmOpeningHours(v));
 assert.ok(values.length>300);
 assert.ok(unread.length/values.length<=0.05,`unparsed (${unread.length}/${values.length}): ${unread.join(' | ')}`);
});

test('Start shows the cause instead of a generic "no route" message',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/planNoResults\(prefs,result\)/);
 assert.match(app,/Najwcześniej otwierają się ok\./);
 assert.match(app,/więc plan jest bez przerwy/);
 assert.doesNotMatch(app,/Nie znaleziono wykonalnej trasy\. Zmień czas, datę lub kategorię\./);
});
