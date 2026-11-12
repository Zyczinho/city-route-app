import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ticketmasterQuery,eventMarket} from '../events.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Warsaw, Krakow and Lisbon use distinct Ticketmaster city/country filters',()=>{
 const when=new Date('2026-11-10T12:00:00Z');
 for(const [id,name,country] of [['warsaw','Warsaw','PL'],['krakow','Krakow','PL'],['lisbon','Lisboa','PT']]){
  const q=new URL(ticketmasterQuery('KEY',7,when,id)).searchParams;
  assert.equal(q.get('city'),name);assert.equal(q.get('countryCode'),country);
 }
 assert.equal(eventMarket('invalid'),null);
 assert.throws(()=>ticketmasterQuery('KEY',7,when,'invalid'),/unsupported-event-city/);
});
test('server cache separates cities and client requests include city id',()=>{
 const worker=read('worker.js'),app=read('app.js');
 assert.match(worker,/eventMarket\(cityId\)/);
 assert.match(worker,/events\?city=\$\{cityId\}&days=\$\{days\}/);
 assert.match(worker,/ticketmasterQuery\(env\.TICKETMASTER_API_KEY,days,new Date\(\),cityId\)/);
 assert.match(app,/cityId\+':'\+days/);
 assert.match(app,/api\/events\?city=\$\{encodeURIComponent\(cityId\)\}/);
 assert.match(app,/city\(\)\.id===cityId\)render\(\)/);
});
