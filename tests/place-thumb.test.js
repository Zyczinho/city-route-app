// The thumbnail path must only use the free Places SKUs plus one Place Photo call, and never show another venue.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findGooglePlaceId,cachedGooglePlaceId,googlePhotoUri,placeIdCacheKey} from '../place-thumb.js';

const ID='ChIJabcdefghijklmnop';
function fakeGoogle({candidates=[{id:ID}],details={[ID]:{id:ID,displayName:{text:'Jabeerwocky'},location:{latitude:52.22966,longitude:21.01590}}},photos=[{name:`places/${ID}/photos/p1`,widthPx:1200,heightPx:800}]}={}){
 const calls=[];
 const fetcher=async(url,init={})=>{
  const mask=init.headers?.['x-goog-fieldmask']||'';calls.push({url:String(url),mask});
  const ok=body=>({ok:true,json:async()=>body});
  if(String(url).endsWith('places:searchText'))return ok({places:candidates});
  if(String(url).includes('/media?'))return ok({photoUri:'https://lh3.googleusercontent.com/places/abc=s320'});
  const id=String(url).split('/places/')[1];
  if(mask==='photos')return ok({photos});
  return ok(details[id]||{});
 };
 return {fetcher,calls};
}

test('place_id lookup uses only the IDs-only search and one confirming details call',async()=>{
 const g=fakeGoogle();
 const id=await findGooglePlaceId({name:'Jabeerwocky',lat:52.2296553,lng:21.0159019,googleKey:'k',fetcher:g.fetcher});
 assert.equal(id,ID);
 assert.deepEqual(g.calls.map(c=>c.mask),['places.id','id,displayName,location']);
});

test('a candidate with another name or far away is rejected',async()=>{
 const other=fakeGoogle({details:{[ID]:{id:ID,displayName:{text:'Zupełnie Inny Lokal'},location:{latitude:52.22966,longitude:21.0159}}}});
 assert.equal(await findGooglePlaceId({name:'Jabeerwocky',lat:52.2296553,lng:21.0159019,googleKey:'k',fetcher:other.fetcher}),null);
 const far=fakeGoogle({details:{[ID]:{id:ID,displayName:{text:'Jabeerwocky'},location:{latitude:52.26,longitude:21.05}}}});
 assert.equal(await findGooglePlaceId({name:'Jabeerwocky',lat:52.2296553,lng:21.0159019,googleKey:'k',fetcher:far.fetcher}),null);
});

test('confirmed ids and misses are cached, so the lookup runs once per place',async()=>{
 const store=new Map(),cache={match:async r=>store.get(r.url)?.clone(),put:async(r,res)=>{store.set(r.url,res);}};
 const g=fakeGoogle(),params={name:'Jabeerwocky',lat:52.2296553,lng:21.0159019,googleKey:'k',fetcher:g.fetcher};
 assert.equal(await cachedGooglePlaceId(params,{cache}),ID);
 assert.equal(await cachedGooglePlaceId(params,{cache}),ID);
 assert.equal(g.calls.length,2,'second request is served from the cache');
 assert.match(store.get(placeIdCacheKey('Jabeerwocky',52.2296553,21.0159019)).headers.get('cache-control'),/max-age=2592000/);
 const none=fakeGoogle({candidates:[]}),miss={...params,name:'Nieznany Bar',fetcher:none.fetcher};
 assert.equal(await cachedGooglePlaceId(miss,{cache}),null);
 assert.equal(await cachedGooglePlaceId(miss,{cache}),null);
 assert.equal(none.calls.length,1,'a miss is remembered too');
});

test('photo uri comes from the free photos field and one media call, sized for lists',async()=>{
 const g=fakeGoogle();
 assert.equal(await googlePhotoUri(ID,{googleKey:'k',fetcher:g.fetcher}),'https://lh3.googleusercontent.com/places/abc=s320');
 assert.equal(g.calls[0].mask,'photos');
 assert.match(g.calls[1].url,/\/media\?key=k&maxWidthPx=320&skipHttpRedirect=true$/);
 assert.equal(g.calls.length,2);
 assert.equal(await googlePhotoUri('bad id',{googleKey:'k',fetcher:g.fetcher}),null);
 assert.equal(await googlePhotoUri(ID,{googleKey:'k',fetcher:fakeGoogle({photos:[]}).fetcher}),null);
});

test('Worker exposes /api/place-thumb as a redirect with a tile-friendly 404',async()=>{
 const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(worker,/pathname==='\/api\/place-thumb'/);
 assert.match(worker,/status:302,headers:\{location:uri,'cache-control':'private, max-age=3600'/);
 assert.match(worker,/if\(!thumbAllowed\(env\)\)return notFound\(/,'thumbnails have their own daily cap');
 assert.match(worker,/Number\(env\.GOOGLE_THUMBS_DAILY_CAP\)\|\|3000/);
 assert.match(worker,/\['quota','unavailable'\]\.includes\(status\)\?60:600/,'a cap answer is retried after a minute');
 assert.match(worker,/maxWidthPx:url\.searchParams\.get\('w'\)==='800'\?800:320/,'card photos are 800 px, list photos 320 px');
 assert.match(worker,/\|\|await peekGooglePlaceId\(name,lat,lng,caches\.default\)/,'cards reuse a confirmed place_id');
});
