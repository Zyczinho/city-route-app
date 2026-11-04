import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openingFor,PILOT_HOURS,validDate,localDate,scheduleRoute,feasibleFor} from '../opening-hours.js';
import {generate,generateAlternatives} from '../core.js';

const museum=(id,minutes=90)=>({id,cityId:'warsaw',name:id,categoryId:'museum',cats:['muzea'],
 lat:52.23,lng:21.01,minutes,cost:0,foodStyle:'none',tags:['culture'],tourist:'must',ratings:[]});
const outside={id:'park',name:'Park',cityId:'warsaw',categoryId:'park',cats:['zielen'],lat:52.232,lng:21.011,minutes:30,cost:0,
 foodStyle:'none',tags:['nature'],tourist:'balanced',ratings:[]};
const opts=(date='2026-11-06',startTime='10:00',more={})=>({cityId:'warsaw',date,startTime,mode:'inside',transport:'walking',maxMinutes:480,...more});
test('pilot hours record provenance and no paid API requests',()=>{
 for(const [city,places] of Object.entries(PILOT_HOURS))for(const [id,details] of Object.entries(places)){
  assert.match(details.source,/^https:\/\//,city+id);
 }
 const code=readFileSync(new URL('../opening-hours.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/fetch\(|supabase|api\/place-enrichment/i);
});
test('date validation handles real calendar days and selected timezone',()=>{
 assert.equal(validDate('2026-11-04'),true);
 assert.equal(validDate('2026-02-30'),false);
 assert.equal(validDate('not-a-date'),false);
 assert.equal(localDate('Europe/Warsaw',new Date('2026-11-04T23:30:00Z')),'2026-11-05');
});
test('2026 Chopin museum closure blocks inside visits; outside stays allowed',()=>{
 const p=museum('chopin-museum',20);
 assert.equal(openingFor(p,opts()).status,'closed');
 assert.equal(feasibleFor([p],opts()),false);
 assert.equal(openingFor(p,opts('2027-01-05')).status,'unknown','future year must not inherit stale closure');
 assert.equal(feasibleFor([p],opts('2026-11-06','10:00',{mode:'outside'})),true);
});
test('weekly closure and fixed visit duration prevent late museum admission',()=>{
 const p=museum('national-museum',15);
 assert.equal(openingFor(p,opts('2026-11-09')).status,'closed','Monday closed');
 const friday=openingFor(p,opts('2026-11-06'));
 assert.equal(friday.label,'10:00–20:00');
 assert.equal(scheduleRoute([p],opts('2026-11-06','18:30')).feasible,true,'60min fits before 20:00');
 assert.equal(scheduleRoute([p],opts('2026-11-06','19:30')).feasible,false,'minimum museum time extends beyond closing');
 const early=scheduleRoute([p],opts('2026-11-06','09:00'));
 assert.equal(early.rows[0].wait,60);
 assert.equal(early.rows[0].visitStart,'10:00');
 assert.equal(early.feasible,true);
 assert.equal(scheduleRoute([p],opts('2026-11-06','09:00',{maxMinutes:90})).feasible,false,'waiting consumes time budget');
});
test('specific holiday overrides and seasonal Krakow hours apply',()=>{
 const cop=museum('copernicus',70);
 assert.equal(openingFor(cop,opts('2026-11-09')).status,'closed');
 assert.equal(openingFor(cop,opts('2026-11-11')).label,'09:00–19:00');
 const krak={...museum('aviation-museum',120),cityId:'krakow'};
 assert.equal(openingFor(krak,{...opts('2026-11-06'),cityId:'krakow'}).label,'09:00–16:00');
 assert.equal(openingFor(krak,{...opts('2026-11-11'),cityId:'krakow'}).status,'closed');
 assert.equal(scheduleRoute([krak],{...opts('2026-11-06','14:50'),cityId:'krakow'}).feasible,false);
 const cz={...museum('czartoryski-museum',60),cityId:'krakow'};
 assert.equal(openingFor(cz,{...opts('2026-11-09'),cityId:'krakow'}).status,'closed');
 assert.equal(openingFor(cz,{...opts('2026-11-06'),cityId:'krakow'}).needsTicket,true);
});
test('unknown museum hours never become verified open status',()=>{
 const p=museum('not-curated',45);
 assert.equal(openingFor(p,opts()).status,'unknown');
 const s=scheduleRoute([p,outside],opts());
 assert.equal(s.unknownCount,1);
 assert.equal(s.rows[0].opening.status,'unknown');
 assert.equal(s.rows[1].opening.status,'not-applicable');
 assert.equal(s.feasible,true,'unknown data can be shown with warning, not silently discarded');
});
test('generator skips known-closed interior museums but keeps open-air options',()=>{
 const closed=museum('chopin-museum',20);
 const prefs={time:240,transport:'walking',budget:'premium',food:'none',tourist:'must',
  offers:'no',interests:['mix'],timeFeasible:ps=>feasibleFor(ps,opts())};
 const candidates=generateAlternatives([closed,outside],prefs,{count:3});
 assert.ok(candidates.length);
 assert.ok(candidates.every(xs=>xs.every(p=>p.id!=='chopin-museum')));
 assert.equal(generate([closed,outside],prefs).some(p=>p.id==='park'),true);
});
