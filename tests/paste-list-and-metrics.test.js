import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePastedList,resolvePastedItem,resolvePastedList,isMapsUrl,nameFromMapsUrl,MAX_PASTED_PLACES} from '../paste-list.js';
import {parseMetric,recordMetric,hashDevice,METRIC_TYPES} from '../metrics.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

const CHAT=`Oto 8 lokalnych miejsc w Warszawie:

1. **Teatro Cubano** – kubański bar z muzyką na żywo. [Google Maps](https://maps.app.goo.gl/AbCd123)
2. **Noodlani**: ramen na Żurawiej — https://www.google.com/maps/place/Noodlani/@52.2276,21.0117,17z
- Hala Koszyki (Śródmieście)
Najlepiej iść wieczorem, bo jest mniej ludzi i lepszy klimat przy zachodzie słońca.
https://maps.app.goo.gl/ZZZ999
3. Teatro Cubano`;

test('a list pasted from ChatGPT becomes names and Maps links, without headers or descriptions',()=>{
 const {items,skipped}=parsePastedList(CHAT);
 assert.deepEqual(items,[
  {name:'Teatro Cubano',url:'https://maps.app.goo.gl/AbCd123'},
  {name:'Noodlani',url:'https://www.google.com/maps/place/Noodlani/@52.2276,21.0117,17z'},
  {name:'Hala Koszyki',url:''},
  {name:'',url:'https://maps.app.goo.gl/ZZZ999'},
  {name:'Teatro Cubano',url:''}
 ]);
 assert.equal(skipped,0);
 assert.ok(isMapsUrl('https://www.google.pl/maps/place/X'));
 assert.ok(!isMapsUrl('https://example.com/maps/place/X'));
 assert.equal(nameFromMapsUrl('https://www.google.com/maps/place/K%C4%85pielisko+Red%C5%82owo/@54,18,17z'),'Kąpielisko Redłowo');
 const many=Array.from({length:20},(_,i)=>'Miejsce numer '+(i+1)).join('\n');
 const capped=parsePastedList(many);
 assert.equal(capped.items.length,MAX_PASTED_PLACES);
 assert.equal(capped.skipped,20-MAX_PASTED_PLACES);
});

test('pasted items resolve through the city-scoped endpoints: link → preview, name → suggest → details',async()=>{
 const urls=[];
 const fetcher=async url=>{urls.push(url);
  if(url.startsWith('/api/place-preview'))return json({status:'ok',location:{lat:52.2421,lng:21.0098},name:'Teatro Cubano',placeId:'ChIJteatrocubano'});
  if(url.startsWith('/api/place-suggest'))return json({status:'ok',suggestions:[{provider:'google',placeId:'ChIJnoodlani123',name:'Noodlani'}]});
  if(url.startsWith('/api/place-details'))return json({status:'ok',placeId:'ChIJnoodlani123',name:'Noodlani',location:{lat:52.2276,lng:21.0117}});
  return json({},404);
 };
 const link=await resolvePastedItem({name:'',url:'https://maps.app.goo.gl/AbCd123'},{cityQuery:'city=warsaw',fetcher});
 assert.deepEqual(link,{name:'Teatro Cubano',lat:52.2421,lng:21.0098,url:'https://maps.app.goo.gl/AbCd123',placeId:'ChIJteatrocubano'});
 const name=await resolvePastedItem({name:'Noodlani',url:''},{cityQuery:'city=warsaw',session:'s1',fetcher});
 assert.equal(name.placeId,'ChIJnoodlani123');
 assert.equal(name.lat,52.2276);
 assert.ok(urls.every(u=>u.includes('city=warsaw')||u.startsWith('/api/location')),'every lookup stays in the active city');
 const none=await resolvePastedItem({name:'Nie istnieje',url:''},{fetcher:async()=>json({status:'not-found',suggestions:[]})});
 assert.equal(none,null);
 const down=await resolvePastedList([{name:'A',url:''},{name:'B',url:''}],{fetcher:async()=>{throw new Error('offline');}});
 assert.deepEqual(down.map(r=>r.place),[null,null]);
});

test('"Wklej listę" lives in Moja trasa and on Start, adds stops to the route and is counted',()=>{
 const app=read('app.js');
 assert.match(app,/data-action="paste-list"/);
 assert.ok(app.includes('href="#my-route/paste" data-paste-entry'),'Start links to the paste box');
 assert.match(app,/if\(action==='paste-list'\)\{pasteList\(\);return;\}/);
 assert.match(app,/addStop\(builderDraft,all\[id\],\{now:now\(\)\}\),\{eventType:'builder_add',eventData:\{place_id:id,source:'paste'\}\}/);
 assert.match(app,/log\('list_paste',\{lines:items\.length,found:/);
 assert.ok(read('service-worker.js').includes("'./paste-list.js'"));
 assert.ok(read('scripts/build.mjs').includes("'paste-list.js'"));
});

test('metrics: only allow-listed anonymous events, hashed device, production host only',async()=>{
 assert.deepEqual(parseMetric({t:'whole_route_maps',c:'warsaw',d:'3f1c2a9e-1111-2222-3333-444455556666',n:3}),{type:'whole_route_maps',city:'warsaw',device:'3f1c2a9e-1111-2222-3333-444455556666',n:3});
 assert.equal(parseMetric({t:'email',c:'warsaw'}),null);
 assert.equal(parseMetric({t:'place_add',c:'<script>'}).city,'');
 assert.equal(parseMetric({t:'place_add',d:'jan@example.com'}).device,'');
 const h=await hashDevice('abc-device-id');
 assert.match(h,/^[0-9a-f]{16}$/);
 assert.notEqual(h,'abc-device-id');
 for(const t of ['app_open','list_paste','build_generate','whole_route_maps'])assert.ok(METRIC_TYPES.includes(t));
 const rows=[];
 const env={METRICS:{prepare:sql=>({bind:(...v)=>({run:async()=>{rows.push({sql,v});}})})}};
 const post=(host,body)=>new Request(`https://${host}/api/metric`,{method:'POST',body:JSON.stringify(body)});
 assert.equal((await recordMetric(post('city-route-app.jakublojek.workers.dev',{t:'list_paste',c:'warsaw',d:'abc-device-id',n:4}),env)).status,204);
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0].v.slice(2),['list_paste','warsaw',h,4]);
 await recordMetric(post('preview-city-route-app.jakublojek.workers.dev',{t:'list_paste'}),env);
 await recordMetric(post('city-route-app.jakublojek.workers.dev',{t:'not_allowed'}),env);
 assert.equal(rows.length,1,'previews and unknown events are not stored');
 assert.equal((await recordMetric(new Request('https://city-route-app.jakublojek.workers.dev/api/metric'),env)).status,405);
 const cfg=read('wrangler.jsonc');
 assert.match(cfg,/"binding": "METRICS", "database_name": "city-route-metrics"/);
 assert.match(read('worker.js'),/pathname==='\/api\/metric'\)return recordMetric\(request,env,ctx\)/);
 assert.match(read('app.js'),/navigator\.sendBeacon\('\/api\/metric'/);
});
