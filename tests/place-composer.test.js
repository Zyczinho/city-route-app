import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {classifyInput,parseCoordinates,cityCheck,activeCity,cityParams,catalogueMatches,findDuplicate,categoryFromTypes,latestOnly} from '../place-composer-model.js';
import {suggestPlaces,placeDetails,cityFromParams,searchPlaceAddress} from '../geocode.js';
import {placePreview} from '../maps-preview.js';

const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
const cities=JSON.parse(await read('data/cities.json'));
const WARSAW=cities.find(c=>c.id==='warsaw'),KRAKOW=cities.find(c=>c.id==='krakow');
const asCity=c=>({id:c.id,name:c.name,center:c.center,radiusKm:c.radiusKm});
const jsonResponse=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

test('one input understands a name, Maps links, coordinates and other links',()=>{
 assert.equal(classifyInput('Nudlani').kind,'text');
 assert.equal(classifyInput('Nu').kind,'short');
 assert.equal(classifyInput('   ').kind,'empty');
 assert.equal(classifyInput('https://maps.app.goo.gl/AbC123').kind,'maps');
 assert.equal(classifyInput('https://www.google.com/maps/place/Nudlani/@52.23,21.0,17z').kind,'maps');
 assert.equal(classifyInput('https://example.com/x').kind,'other-link');
 assert.deepEqual(classifyInput('52.230123, 21.012345').location,{lat:52.230123,lng:21.012345});
});

test('coordinates accept Polish decimal commas and reject nonsense',()=>{
 assert.deepEqual(parseCoordinates('52,230123, 21,012345'),{lat:52.230123,lng:21.012345});
 assert.deepEqual(parseCoordinates('50,0614; 19,9366'),{lat:50.0614,lng:19.9366});
 assert.deepEqual(parseCoordinates('52.23 21.01'),{lat:52.23,lng:21.01});
 assert.equal(parseCoordinates('152.23, 21.01'),null);
 assert.equal(parseCoordinates('Sekretny punkt widokowy'),null);
});

test('coordinates are checked against the active city, not Warsaw',()=>{
 const wawel={lat:50.0540,lng:19.9354};
 assert.equal(cityCheck(wawel,KRAKOW).ok,true);
 const wrong=cityCheck(wawel,WARSAW);
 assert.equal(wrong.ok,false);
 assert.ok(wrong.km>200);
 assert.equal(cityCheck({lat:47.4979,lng:19.0402},KRAKOW).ok,false,'Budapest is not Kraków');
});

test('active city follows the picker, then saved state, then Warsaw',()=>{
 assert.equal(activeCity(cities,{selectValue:'krakow'}).id,'krakow');
 assert.equal(activeCity(cities,{state:{cityId:'krakow'}}).id,'krakow');
 assert.equal(activeCity(cities,{}).id,'warsaw');
 const params=new URLSearchParams(cityParams(KRAKOW));
 assert.equal(params.get('city'),'krakow');
 assert.equal(cityFromParams(params).center.lat,KRAKOW.center.lat);
 assert.equal(cityFromParams(new URLSearchParams('lat=abc')).id,'warsaw');
 assert.equal(cityFromParams(new URLSearchParams('lat=50&lng=19&r=999')).radiusKm,50,'radius is capped');
});

test('catalogue is searched first and a near duplicate is detected',async()=>{
 const places=JSON.parse(await read('data/cities/krakow/places.json'));
 const first=places[0],hits=catalogueMatches(first.name.split(' ').slice(0,2).join(' '),places);
 assert.ok(hits.some(p=>p.id===first.id));
 const dup=findDuplicate({name:first.name,location:{lat:first.lat+0.0003,lng:first.lng}},places);
 assert.equal(dup?.place.id,first.id);
 assert.equal(findDuplicate({name:'Zupełnie inne',location:{lat:first.lat+0.01,lng:first.lng}},places),null);
});

test('category is suggested from provider types and Polish names',()=>{
 assert.equal(categoryFromTypes(['ramen_restaurant','food']),'jedzenie');
 assert.equal(categoryFromTypes(['museum']),'muzea');
 assert.equal(categoryFromTypes(['viewpoint']),'widoki');
 assert.equal(categoryFromTypes([],'Barbakan'),'zabytki','"bar" inside a name is not a bar');
 assert.equal(categoryFromTypes([],'Sekretny punkt widokowy'),'widoki');
 assert.equal(categoryFromTypes([],'Podwórko'),'okolice');
});

test('a stale type-ahead response is ignored',()=>{
 const guard=latestOnly(),slow=guard.next(),fast=guard.next();
 assert.equal(guard.isCurrent(slow),false);
 assert.equal(guard.isCurrent(fast),true);
 guard.cancel();assert.equal(guard.isCurrent(fast),false);
});

test('Kraków suggestions come from OSM inside a Kraków box and drop Warsaw hits',async()=>{
 let called='';
 const fetcher=async url=>{called=String(url);return jsonResponse({features:[
  {geometry:{coordinates:[21.01,52.23]},properties:{name:'Nudlani',city:'Warszawa',osm_type:'N',osm_id:1}},
  {geometry:{coordinates:[19.94,50.06]},properties:{name:'Nudlani',street:'Józefa',housenumber:'2',city:'Kraków',district:'Kazimierz',osm_value:'restaurant',osm_type:'N',osm_id:2}}
 ]});};
 const result=await suggestPlaces('Nudlani',{city:asCity(KRAKOW),fetcher});
 assert.equal(result.status,'ok');
 assert.equal(result.provider,'photon-osm');
 assert.equal(result.suggestions.length,1);
 assert.equal(result.suggestions[0].address,'Józefa 2, Kraków');
 assert.deepEqual(result.suggestions[0].location,{lat:50.06,lng:19.94});
 const u=new URL(called);
 assert.ok(u.searchParams.get('bbox'),'search is restricted to the city box');
 assert.equal(u.searchParams.get('lat'),String(KRAKOW.center.lat));
 assert.notEqual(u.searchParams.get('lang'),'pl','public Photon answers 400 to lang=pl');
});

test('Google autocomplete runs only when explicitly switched on',async()=>{
 const urls=[];
 const fetcher=async url=>{urls.push(String(url));return String(url).includes('googleapis')?jsonResponse({suggestions:[{placePrediction:{placeId:'ChIJabcdefghijk',structuredFormat:{mainText:{text:'Nudlani'},secondaryText:{text:'Warszawa'}},types:['restaurant']}}]}):jsonResponse({features:[]});};
 await suggestPlaces('Nudlani',{city:asCity(WARSAW),googleKey:'k',fetcher});
 assert.ok(urls.every(u=>!u.includes('googleapis')),'key alone does not enable paid autocomplete');
 urls.length=0;
 const on=await suggestPlaces('Nudlani',{city:asCity(WARSAW),googleKey:'k',googleAutocomplete:true,sessionToken:'s1',fetcher});
 assert.equal(on.provider,'google');
 assert.equal(on.suggestions[0].placeId,'ChIJabcdefghijk');
 assert.equal(on.suggestions[0].location,undefined,'coordinates come from details on selection');
});

test('Google answers when Photon is down, and only then',async()=>{
 const google=jsonResponse({suggestions:[{placePrediction:{placeId:'ChIJteatrocubano',structuredFormat:{mainText:{text:'Teatro Cubano'},secondaryText:{text:'Fredry 6, Warszawa'}},types:['night_club']}}]});
 const urls=[];
 const photonDown=async url=>{urls.push(String(url));if(String(url).includes('googleapis'))return google.clone();throw new Error('timeout');};
 let asked=0;const fallback=()=>{asked++;return true;};
 const out=await suggestPlaces('cubano',{city:asCity(WARSAW),googleKey:'k',googleFallback:fallback,fetcher:photonDown});
 assert.equal(out.status,'ok');
 assert.equal(out.provider,'google');
 assert.equal(out.suggestions[0].name,'Teatro Cubano');
 assert.equal(asked,1);
 // Photon healthy: no paid call, the budget check is not even consulted.
 urls.length=0;asked=0;
 const photonUp=async url=>{urls.push(String(url));return jsonResponse({features:[{properties:{name:'Teatro Cubano',street:'Fredry',housenumber:'6',osm_type:'N',osm_id:1},geometry:{coordinates:[21.0122,52.2397]}}]});};
 const ok=await suggestPlaces('cubano',{city:asCity(WARSAW),googleKey:'k',googleFallback:fallback,fetcher:photonUp});
 assert.equal(ok.provider,'photon-osm');
 assert.equal(asked,0);
 assert.ok(urls.every(u=>!u.includes('googleapis')));
 // Budget exhausted: stays "unavailable" without calling Google.
 urls.length=0;
 const capped=await suggestPlaces('cubano',{city:asCity(WARSAW),googleKey:'k',googleFallback:()=>false,fetcher:photonDown});
 assert.equal(capped.status,'unavailable');
 assert.ok(urls.every(u=>!u.includes('googleapis')));
});

test('no API and no network still answers instead of throwing',async()=>{
 const down=await suggestPlaces('Sekretny punkt',{city:asCity(KRAKOW),fetcher:async()=>{throw new Error('offline');}});
 assert.equal(down.status,'unavailable');
 assert.deepEqual(down.suggestions,[]);
 const none=await suggestPlaces('Sekretny punkt widokowy',{city:asCity(KRAKOW),fetcher:async()=>jsonResponse({features:[]})});
 assert.equal(none.status,'not-found');
 assert.deepEqual(await placeDetails('ChIJabcdefghijk',{}),{status:'no-key'});
});

test('place details reject a Google result outside the active city',async()=>{
 const fetcher=async()=>jsonResponse({id:'ChIJabcdefghijk',displayName:{text:'Nudlani'},location:{latitude:52.23,longitude:21.01},types:['restaurant']});
 const result=await placeDetails('ChIJabcdefghijk',{googleKey:'k',fetcher,city:asCity(KRAKOW)});
 assert.equal(result.status,'outside-city');
 const ok=await placeDetails('ChIJabcdefghijk',{googleKey:'k',fetcher,city:asCity(WARSAW)});
 assert.equal(ok.status,'ok');
 assert.equal(ok.photo.available,false);
});

test('address search on save is scoped to Kraków',async()=>{
 let body;
 const fetcher=async(url,opts)=>{body=JSON.parse(opts.body);return jsonResponse({places:[{id:'x',displayName:{text:'Wawel'},location:{latitude:50.054,longitude:19.935},types:['castle']}]});};
 const result=await searchPlaceAddress('Wawel',{googleKey:'k',fetcher,city:asCity(KRAKOW)});
 assert.equal(result.status,'ok');
 assert.match(body.textQuery,/Kraków/);
 assert.doesNotMatch(body.textQuery,/Warszawa/);
});

test('Maps link preview of a Kraków place never searches "… Warszawa"',async()=>{
 let body;
 const fetcher=async(url,opts)=>{body=JSON.parse(opts.body);return jsonResponse({places:[]});};
 const result=await placePreview('https://www.google.com/maps/place/Nudlani/@50.0513,19.9449,17z','k',fetcher,asCity(KRAKOW));
 assert.equal(result.status,'ok');
 assert.equal(result.name,'Nudlani');
 assert.doesNotMatch(body.textQuery,/Warszawa/);
 assert.equal(body.locationBias.circle.center.latitude,50.0513);
});

test('Worker exposes suggest/details and degrades without Google',async()=>{
 const store=new Map();
 globalThis.caches={default:{match:async r=>store.get(r.url),put:async(r,res)=>{store.set(r.url,res);}}};
 const realFetch=globalThis.fetch;
 globalThis.fetch=async()=>jsonResponse({features:[{geometry:{coordinates:[19.94,50.06]},properties:{name:'Nudlani',city:'Kraków',osm_type:'N',osm_id:2}}]});
 try{
  const {default:worker}=await import('../worker.js');
  const ctx={waitUntil(){}},env={ASSETS:{fetch:async()=>new Response('static')}};
  const q=`city=krakow&lat=${KRAKOW.center.lat}&lng=${KRAKOW.center.lng}&r=${KRAKOW.radiusKm}`;
  const ok=await worker.fetch(new Request(`https://x.test/api/place-suggest?q=Nudlani&${q}`),env,ctx);
  assert.equal(ok.status,200);
  assert.equal((await ok.json()).suggestions[0].name,'Nudlani');
  const short=await worker.fetch(new Request('https://x.test/api/place-suggest?q=Nu'),env,ctx);
  assert.equal(short.status,422);
  const details=await worker.fetch(new Request('https://x.test/api/place-details?id=ChIJabcdefghijk'),env,ctx);
  assert.equal((await details.json()).status,'no-key');
  const photo=await worker.fetch(new Request('https://x.test/api/place-photo?id=ChIJabcdefghijk'),env,ctx);
  assert.equal(photo.status,404);
 }finally{globalThis.fetch=realFetch;delete globalThis.caches;}
});

test('Google photos are never copied into the user photo upload',async()=>{
 const enhancements=await read('enhancements.js');
 assert.doesNotMatch(enhancements,/DataTransfer|google-place\.jpg|attachPhoto/);
 assert.doesNotMatch(enhancements,/20\.35,52\.55,21\.55,51\.90/,'no fixed Warsaw viewbox');
 const composer=await read('place-composer.js');
 assert.doesNotMatch(composer,/DataTransfer|\.files\s*=/,'composer only previews Google photos');
 assert.match(composer,/Wyświetlamy je z Google, nie kopiujemy pliku/);
});

test('composer ships, loads after app.js and leaves app.js the only writer of places',async()=>{
 const [html,build,composer]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('place-composer.js')]);
 assert.match(html,/place-composer\.js\?v=9/);
 assert.match(html,/place-composer\.css\?v=\d+/);
 assert.ok(html.indexOf('./app.js')<html.indexOf('place-composer.js'));
 for(const f of ['place-composer.js','place-composer-model.js','place-composer.css'])assert.ok(build.includes(`'${f}'`),`${f} must ship in dist`);
 assert.doesNotMatch(composer,/from '\.\/app\.js'|localStorage\.setItem/,'saving stays in app.js; nothing is published');
 assert.doesNotMatch(composer,/nominatim/i,'no public Nominatim type-ahead');
 for(const f of ['place-composer.js','place-composer-model.js','enhancements.js','worker.js']){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
  assert.equal(r.status,0,r.stderr);
 }
});

test('a new query drops the earlier pick unless the pin was placed by hand',async()=>{
 const {keepsSelection,normalizeQuery}=await import('../place-composer-model.js');
 const picked={source:'photon-osm',query:'Wawel',location:{lat:50.054,lng:19.935}};
 assert.equal(keepsSelection(picked,'Wawel'),true,'same query keeps the pick (re-render, repeated input event)');
 assert.equal(keepsSelection(picked,'  Wawel '),true);
 assert.equal(keepsSelection(picked,'Wawel Zamek'),false,'A → B drops A');
 assert.equal(keepsSelection(picked,''),false,'clearing the box drops A');
 assert.equal(keepsSelection({source:'google',query:'Nudlani',location:{lat:1,lng:1}},'Nudlani Kraków'),false,'an adjusted Google pick is still a pick');
 assert.equal(keepsSelection({source:'pin',query:'Punkt',location:{lat:1,lng:1}},'Sekretny punkt'),true,'a hand-placed pin survives renaming');
 assert.equal(keepsSelection({source:'pin',query:'Punkt'},'Inny'),false,'a pin not placed yet is not kept');
 assert.equal(keepsSelection(null,'x'),false);
 assert.equal(normalizeQuery(' a   b '),'a b');
});

test('composer clears stale coordinates on every new query, async pick and re-render',async()=>{
 const code=await read('place-composer.js');
 const onQuery=code.slice(code.indexOf('function onQuery'),code.indexOf('const MARKUP'));
 assert.ok(onQuery.indexOf('resetSelection(form)')<onQuery.indexOf("input.kind==='empty'"),'reset runs before any branch, including an emptied box');
 const choose=code.slice(code.indexOf('async function choose'),code.indexOf('function renderPreview'));
 assert.equal((choose.match(/gen!==generation/g)||[]).length,2,'a pick resolving after a new query is dropped');
 const pick=code.slice(code.indexOf('async function pick'),code.indexOf('async function readMapsLink'));
 assert.match(pick,/if\(gen!==generation\)return;/,'Google details arriving late are dropped');
 const reset=code.slice(code.indexOf('function resetSelection'),code.indexOf('async function choose'));
 assert.match(reset,/where\.value===form\.dataset\.pcWhere/,'only coordinates the composer wrote are cleared');
 assert.match(reset,/pcAuto/,'an auto-filled name is cleared, a typed one is kept');
 const decorate=code.slice(code.indexOf('function decorate'),code.indexOf("window.addEventListener('hashchange'"));
 assert.match(decorate,/staleWhere&&where\?\.value===staleWhere/,'re-render from an old draft cannot restore A');
});
