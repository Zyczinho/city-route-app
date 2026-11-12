import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRoutesV2} from '../route-planner-v2.js';
import {sharedStopFraction} from '../route-diversity.js';

const lisbon=JSON.parse(readFileSync(new URL('../data/cities/lisbon/places.json',import.meta.url),'utf8'));
test('real Lisbon seeded catalogue supports distinct 4-hour walking plans',()=>{
 const prefs={cityId:'lisbon',visitDate:'2026-11-16',startTime:'10:00',time:240,
  transport:'walking',interests:['mix'],avoid:[],food:'none',budget:'premium',offers:'no',
  tourist:'balanced',visitMode:'mix'};
 const results=planRoutesV2(lisbon,prefs,{count:3,candidateLimit:72,beamWidth:32,maxExpansions:12000});
 assert.ok(results.routes.length>=2,'Lisbon should not collapse to one near-duplicate option');
 for(const a of results.routes)assert.ok(a.totalMinutes<=240);
 for(let i=0;i<results.routes.length;i++)for(let j=i+1;j<results.routes.length;j++)
  assert.ok(sharedStopFraction(results.routes[i].stopIds,results.routes[j].stopIds)<=0.55);
});
