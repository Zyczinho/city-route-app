import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const start=worker.indexOf('function providerAccess(env){'),end=worker.indexOf('const sessionOf=url=>',start);
assert.ok(start>0&&end>start,'provider status helper is present');
const scope={
 googleDay:new Date().toISOString().slice(0,10),googleCalls:0,
 thumbDay:new Date().toISOString().slice(0,10),thumbCalls:0,
 contentDay:new Date().toISOString().slice(0,10),contentCalls:0,
 taDay:new Date().toISOString().slice(0,10),taCalls:0
};
vm.runInNewContext(worker.slice(start,end)+'\nthis.providerAccess=providerAccess;',scope);
const snapshot=env=>JSON.parse(JSON.stringify(scope.providerAccess(env)));
test('provider capabilities never expose API keys or consume quotas',()=>{
 const env={GOOGLE_PLACES_API_KEY:'DO-NOT-EXPOSE',GOOGLE_PLACES_BETA_ENABLED:'on',
  TRIPADVISOR_CONTENT_API_KEY:'SECRET-TA',TRIPADVISOR_CONTENT_BETA_ENABLED:'on'};
 const before=[scope.googleCalls,scope.thumbCalls,scope.contentCalls,scope.taCalls];
 const state=snapshot(env);
 assert.equal(state.google.photos,'ready');
 assert.equal(state.google.ratings,'ready');
 assert.equal(state.tripadvisor.content,'ready');
 assert.deepEqual([scope.googleCalls,scope.thumbCalls,scope.contentCalls,scope.taCalls],before);
 assert.doesNotMatch(JSON.stringify(state),/DO-NOT-EXPOSE|SECRET-TA/);
});
test('disabled, no-key and quota are distinct and correct',()=>{
 assert.equal(snapshot({}).google.photos,'no-key');
 assert.equal(snapshot({GOOGLE_PLACES_API_KEY:'key'}).google.photos,'disabled');
 scope.thumbCalls=3000;scope.googleCalls=300;
 const on={GOOGLE_PLACES_API_KEY:'key',GOOGLE_PLACES_BETA_ENABLED:'on'};
 assert.equal(snapshot(on).google.photos,'quota');
 assert.equal(snapshot(on).google.ratings,'quota');
 scope.thumbCalls=0;scope.googleCalls=0;
});
test('interface does not mistake unchecked ratings for ratings of zero',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/Oceny po otwarciu miejsca/);
 assert.match(app,/Źródła ocen niepodłączone/);
 assert.match(app,/Nie udało się pobrać ocen/);
 assert.match(app,/Sprawdzanie ocen/);
 assert.match(app,/data-provider-health/);
 assert.match(app,/providerStatus:data\.providerStatus/);
 assert.doesNotMatch(app,/<span>Brak ocen na obu platformach<\/span>/);
});
