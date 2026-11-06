import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sha256Hex,verifyProductionApp} from '../scripts/verify-production-app.mjs';

const URL_ROOT='https://city-route-app.example.workers.dev';
const expected=Buffer.from('const cityRouteVersion = "new";\n');
const ok=js=>new Response(js,{status:200,headers:{'content-type':'application/javascript'}});

test('production gate accepts only byte-for-byte SHA-256 equality',async()=>{
 const requests=[],logs=[];
 const result=await verifyProductionApp({
  expectedBytes:expected,productionOrigin:URL_ROOT,commitSha:'abc123',maxAttempts:3,intervalMs:0,
  fetchImpl:async(url,opts)=>{requests.push({url,opts});return ok(expected);},
  log:x=>logs.push(x)
 });
 assert.equal(result.matched,true);assert.equal(result.attempt,1);
 assert.equal(result.actual,sha256Hex(expected));assert.equal(result.wanted,sha256Hex(expected));
 assert.equal(requests.length,1);
 const request=new URL(requests[0].url);
 assert.equal(request.pathname,'/app.js');assert.equal(request.searchParams.get('commit'),'abc123');
 assert.equal(request.searchParams.get('probe'),'1');
 assert.equal(requests[0].opts.headers['Cache-Control'],'no-cache');
 assert.ok(logs.some(x=>x.startsWith('PASS: production /app.js exactly matches')));
});

test('production gate retries stale files and uses a new cache-busting probe per request',async()=>{
 const requests=[],sleeps=[];
 const result=await verifyProductionApp({
  expectedBytes:expected,productionOrigin:URL_ROOT,commitSha:'deploy-sha',maxAttempts:4,intervalMs:99,
  fetchImpl:async url=>{requests.push(url);return ok(requests.length===3?expected:'const cityRouteVersion = "old";\n');},
  sleepImpl:async ms=>sleeps.push(ms),log:()=>{}
 });
 assert.equal(result.attempt,3);
 assert.deepEqual(requests.map(url=>new URL(url).searchParams.get('probe')),['1','2','3']);
 assert.deepEqual(sleeps,[99,99]);
});

test('SPA 200 HTML fallback is a mismatch, never proof that app.js deployed',async()=>{
 const messages=[];
 await assert.rejects(verifyProductionApp({
  expectedBytes:expected,productionOrigin:URL_ROOT,commitSha:'def456',maxAttempts:2,intervalMs:0,
  fetchImpl:async()=>new Response('<html>index</html>',{status:200,headers:{'content-type':'text/html'}}),
  sleepImpl:async()=>{},log:x=>messages.push(x)
 }),error=>{
  assert.match(error.message,/does not match Git commit def456/);
  assert.match(error.message,/Expected SHA-256: [0-9a-f]{64}/);
  assert.match(error.message,/HTML fallback instead of app\.js/);
  assert.match(error.message,/after 2 attempts/);
  return true;
 });
 assert.ok(messages.some(x=>x.includes('HTML fallback')));
});

test('network and 404 errors do not produce a false green result',async()=>{
 let attempt=0;
 await assert.rejects(verifyProductionApp({
  expectedBytes:expected,productionOrigin:URL_ROOT,maxAttempts:3,intervalMs:0,
  fetchImpl:async()=>{attempt++;if(attempt===1)throw new Error('socket closed');return new Response('missing',{status:404});},
  sleepImpl:async()=>{},log:()=>{}
 }),/last observed: unavailable \(HTTP 404\)/);
 assert.equal(attempt,3);
});

test('empty artifacts, insecure URLs and invalid attempts are rejected before fetching',async()=>{
 const fetchImpl=async()=>{throw new Error('should never fetch');};
 await assert.rejects(verifyProductionApp({expectedBytes:Buffer.alloc(0),productionOrigin:URL_ROOT,fetchImpl}),/empty or missing/);
 await assert.rejects(verifyProductionApp({expectedBytes:expected,productionOrigin:'http://example.com',fetchImpl}),/must be HTTPS/);
 await assert.rejects(verifyProductionApp({expectedBytes:expected,productionOrigin:'javascript:alert(1)',fetchImpl}),/invalid productionOrigin|must be HTTPS/);
 await assert.rejects(verifyProductionApp({expectedBytes:expected,productionOrigin:URL_ROOT,maxAttempts:0,fetchImpl}),/invalid maxAttempts/);
});

test('main deployment workflow builds dist and verifies exact app.js before its other checks',async()=>{
 const workflow=await readFile('.github/workflows/production-smoke.yml','utf8');
 assert.match(workflow,/push:\s*\n\s*branches: \[main\]/);
 assert.match(workflow,/run: npm run build/);
 assert.match(workflow,/node scripts\/verify-production-app\.mjs/);
 assert.match(workflow,/CITY_ROUTE_PROD: https:\/\/city-route-app\.jakublojek\.workers\.dev/);
 assert.doesNotMatch(workflow,/grep -Eo 'city-route-v\[0-9\]\+'/);
 const source=await readFile('scripts/build.mjs','utf8');
 assert.match(source,/['"]app\.js['"]/);
});
