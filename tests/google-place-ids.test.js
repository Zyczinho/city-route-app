// GOOGLE-PLACE-IDS-176: stored place ids are bound to the same place and never cost a Google call to collect.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyGooglePlaceIds,loadCatalogueWithFallback} from '../catalogue-client.js';
import {mergePlaceIds} from '../scripts/collect-google-place-ids.mjs';

const GID='ChIJ0RhONcBEFkcRmzXP5nbUn3c';
const place={id:'chaton',name:'Chaton',lat:52.2297,lng:21.0122};
const file=places=>({version:1,city:'warsaw',places});

test('a stored id is applied only to the same catalogue id and name',()=>{
 assert.equal(applyGooglePlaceIds([place],file({chaton:{name:'Chaton',googlePlaceId:GID,source:'manual'}}))[0].googlePlaceId,GID);
 for(const bad of [{name:'Inny Lokal',googlePlaceId:GID},{name:'Chaton',googlePlaceId:'bad id!'},{name:'Chaton'}])
  assert.equal(applyGooglePlaceIds([place],file({chaton:bad}))[0],place);
 assert.equal(applyGooglePlaceIds([place],file({other:{name:'Chaton',googlePlaceId:GID}}))[0],place);
 const own={...place,googlePlaceId:'ChIJexistingexistingid'};
 assert.equal(applyGooglePlaceIds([own],file({chaton:{name:'Chaton',googlePlaceId:GID}}))[0],own);
 assert.deepEqual(applyGooglePlaceIds([place],null),[place]);
});

test('stored ids are applied on the live catalogue and on the JSON fallback',async()=>{
 const ids=file({chaton:{name:'Chaton',googlePlaceId:GID,source:'confirmed'}});
 const client={rpc:async n=>({data:n==='catalogue_places'?[{id:'chaton',name:'Chaton',lat:52.2297,lng:21.0122,category_id:'club'}]:[],error:null})};
 assert.equal((await loadCatalogueWithFallback({client,city:{id:'warsaw'},fallback:{places:[],routes:[]},placeIds:ids})).places[0].googlePlaceId,GID);
 const broken={rpc:async()=>({data:null,error:new Error('offline')})};
 assert.equal((await loadCatalogueWithFallback({client:broken,city:{id:'warsaw'},fallback:{places:[place],routes:[]},placeIds:ids})).places[0].googlePlaceId,GID);
});

test('collecting keeps manual fixes, adds confirmed ids and drops entries whose place changed',()=>{
 const catalogue=[place,{id:'hopito',name:'Hopito'},{id:'renamed',name:'Nowa Nazwa'}];
 const existing=file({
  chaton:{name:'Chaton',googlePlaceId:GID,source:'manual'},
  renamed:{name:'Stara Nazwa',googlePlaceId:'ChIJoldoldoldold',source:'confirmed'},
  gone:{name:'Zamknięte',googlePlaceId:'ChIJgonegonegone',source:'confirmed'}});
 const {places,dropped}=mergePlaceIds(existing,catalogue,{chaton:'ChIJautoautoauto',hopito:'ChIJhopitohopito',nowhere:'ChIJnowherenowhere'});
 assert.deepEqual(places.chaton,{name:'Chaton',googlePlaceId:GID,source:'manual'});
 assert.deepEqual(places.hopito,{name:'Hopito',googlePlaceId:'ChIJhopitohopito',source:'confirmed'});
 assert.equal(places.nowhere,undefined);
 assert.deepEqual(dropped.sort(),['gone','renamed']);
});

test('shipped id files are valid and every entry names a catalogue place',async()=>{
 for(const city of ['warsaw','krakow','lisbon']){
  const ids=JSON.parse(await readFile(new URL(`../data/google-place-ids/${city}.json`,import.meta.url),'utf8'));
  const catalogue=new Map(JSON.parse(await readFile(new URL(`../data/cities/${city}/places.json`,import.meta.url),'utf8')).map(p=>[p.id,p]));
  assert.equal(ids.city,city);
  for(const [id,e] of Object.entries(ids.places)){
   assert.match(e.googlePlaceId,/^[A-Za-z0-9_-]{10,300}$/,`${city}/${id}`);
   assert.ok(['confirmed','manual'].includes(e.source),`${city}/${id} source`);
   if(e.source==='confirmed')assert.ok(catalogue.has(id),`${city}/${id} is not a catalogue place`);
  }
 }
});

test('the id endpoint only reads the Worker cache and the app loads and precaches the files',async()=>{
 const [worker,app,sw]=await Promise.all(['worker.js','app.js','service-worker.js'].map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
 const handler=worker.slice(worker.indexOf('async function placeIdFromCache'),worker.indexOf('async function placeEnrichment'));
 assert.match(handler,/peekGooglePlaceId\(/);
 assert.doesNotMatch(handler,/cachedGooglePlaceId|googleAllowed|thumbAllowed|GOOGLE_PLACES_API_KEY|fetch\(/);
 assert.match(worker,/pathname==='\/api\/place-id'/);
 assert.match(app,/placeIds:await loadGooglePlaceIds\(next\)/);
 assert.match(app,/placeIds:await loadGooglePlaceIds\(activeCity\)/);
 for(const city of ['warsaw','krakow','lisbon'])assert.ok(sw.includes(`'./data/google-place-ids/${city}.json'`),city);
});
