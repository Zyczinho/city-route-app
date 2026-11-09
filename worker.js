// Cloudflare Worker: serves the static app plus lightweight API endpoints.
// Secrets live in Cloudflare (Workers → city-route-app → Settings → Variables and Secrets), never in the repo:
//   TICKETMASTER_API_KEY   Discovery API key from developer.ticketmaster.com
//   TICKETMASTER_AFFILIATE optional Impact deep-link template containing {url}
//   GOOGLE_PLACES_API_KEY  optional Places API (New) key; enables photo and rating enrichment (paid)
//   TRIPADVISOR_TERRA_API_KEY optional Tripadvisor Terra partner key, only official licensed metadata/photos
//   TRIPADVISOR_CONTENT_API_KEY self-serve Content API key; prioritized over Terra
//   GOOGLE_PLACES_BETA_ENABLED / TRIPADVISOR_CONTENT_BETA_ENABLED set "on" explicitly to allow paid API calls
//   TRIPADVISOR_CONTENT_DAILY_CAP best-effort per-instance 50 calls; configure hard provider budgets independently
//   PLACE_GEOCODER_URL     optional Photon-compatible geocoder base URL; defaults to https://photon.komoot.io for MVP fallback
//   GOOGLE_PLACES_AUTOCOMPLETE  set to "on" to use Google Autocomplete for type-ahead (paid per session; off = OSM Photon only)
//   GOOGLE_PLACES_DAILY_CAP     optional soft cap of Google calls per Worker instance per day (default 300); the hard cap belongs in Google Cloud quotas
//   GOOGLE_THUMBS_DAILY_CAP     optional separate soft cap for list thumbnails (/api/place-thumb) per instance per day (default 3000)
import {resolveMaps} from './location.js';
import {routeShareResponse} from './share-preview.js';
import {createRestRpcClient} from './catalogue-client.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
import {placePreview,placePhoto} from './maps-preview.js';
import {searchPlaceAddress,suggestPlaces,placeDetails,placePhotoById,cityFromParams} from './geocode.js';
import {ticketmasterQuery,normalizeTicketmaster,dedupe} from './events.js';
import {enrichPlace} from './place-enrichment.js';
import {cachedGooglePlaceId,googlePhotoUri,placeIdCacheKey} from './place-thumb.js';
import {kmBetween} from './geocode.js';

const json=(body,status=200,maxAge=0)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':maxAge?`public, max-age=${maxAge}`:'no-store'}});

async function events(request,env,ctx){
 const days=Number(new URL(request.url).searchParams.get('days'))||7;
 if(!env.TICKETMASTER_API_KEY)return json({status:'no-key',events:[],sources:[]});
 const cache=caches.default,cacheKey=new Request(`https://city-route-cache/events?days=${days}`);
 const hit=await cache.match(cacheKey);if(hit)return hit;
 try{
  const r=await fetch(ticketmasterQuery(env.TICKETMASTER_API_KEY,days));
  if(!r.ok)return json({status:'source-error',code:r.status,events:[],sources:['ticketmaster']},502);
  const list=dedupe(normalizeTicketmaster(await r.json(),{affiliate:env.TICKETMASTER_AFFILIATE}));
  const res=json({status:'ok',updatedAt:new Date().toISOString(),events:list,sources:['ticketmaster']},200,3600);
  ctx.waitUntil(cache.put(cacheKey,res.clone()));return res;
 }catch{return json({status:'source-error',events:[],sources:['ticketmaster']},502);}
}

async function placeSearch(url,env,ctx){
 const q=String(url.searchParams.get('q')||'').replace(/\s+/g,' ').trim();
 if(q.length<3||q.length>220)return json({status:'invalid-query'},422);
 const city=cityFromParams(url.searchParams);
 const cache=caches.default,cacheKey=new Request(`https://city-route-cache/place-search-v2?c=${city.center.lat},${city.center.lng},${city.radiusKm}&q=${encodeURIComponent(q.toLowerCase())}`);
 const hit=await cache.match(cacheKey);if(hit)return hit;
 try{
  const result=await searchPlaceAddress(q,{googleKey:googleAllowed(env)?env.GOOGLE_PLACES_API_KEY:'',photonUrl:env.PLACE_GEOCODER_URL||'https://photon.komoot.io',city});
  const ok=result.status==='ok',res=json(result,ok?200:404,ok&&result.provider!=='google'?86400:0);
  if(ok&&result.provider!=='google')ctx.waitUntil(cache.put(cacheKey,res.clone()));
  return res;
 }catch{return json({status:'unavailable'},502);}
}

// Soft, per-instance guard so a runaway client cannot burn the Google budget. Real limits live in Google Cloud quotas.
let googleDay='',googleCalls=0;
function googleAllowed(env){
 if(!env.GOOGLE_PLACES_API_KEY||env.GOOGLE_PLACES_BETA_ENABLED!=='on')return false;
 const day=new Date().toISOString().slice(0,10);if(day!==googleDay){googleDay=day;googleCalls=0;}
 // Default 300/instance/day as documented above; GOOGLE_PLACES_DAILY_CAP may raise it up to 5000. The hard budget is the Google Cloud quota.
 const cap=Math.max(1,Math.min(5000,Number(env.GOOGLE_PLACES_DAILY_CAP)||300));if(googleCalls>=cap)return false;
 googleCalls++;return true;
}
// List thumbnails have their own counter: each costs one Place Photo call ($7/1000), so they must not use up the
// pool for rating lookups on cards. GOOGLE_THUMBS_DAILY_CAP (default 3000, max 20000) per instance per day.
let thumbDay='',thumbCalls=0;
function thumbAllowed(env){
 if(!env.GOOGLE_PLACES_API_KEY||env.GOOGLE_PLACES_BETA_ENABLED!=='on')return false;
 const day=new Date().toISOString().slice(0,10);if(day!==thumbDay){thumbDay=day;thumbCalls=0;}
 const cap=Math.max(1,Math.min(20000,Number(env.GOOGLE_THUMBS_DAILY_CAP)||3000));if(thumbCalls>=cap)return false;
 thumbCalls++;return true;
}
// A safe, zero-cost capability snapshot for UI and QA: never returns secrets,
// and never consumes a paid provider quota counter.
function providerAccess(env){
 const configured=!!env.GOOGLE_PLACES_API_KEY,enabled=env.GOOGLE_PLACES_BETA_ENABLED==='on';
 const cap=Math.max(1,Math.min(5000,Number(env.GOOGLE_PLACES_DAILY_CAP)||300));
 const tcap=Math.max(1,Math.min(20000,Number(env.GOOGLE_THUMBS_DAILY_CAP)||3000));
 const day=new Date().toISOString().slice(0,10);
 const state=(hasKey,isOn,used,max)=>!hasKey?'no-key':!isOn?'disabled':used>=max?'quota':'ready';
 return {google:{
  ratings:state(configured,enabled,googleDay===day?googleCalls:0,cap),
  photos:state(configured,enabled,thumbDay===day?thumbCalls:0,tcap)
 },tripadvisor:{
  content:state(!!env.TRIPADVISOR_CONTENT_API_KEY,env.TRIPADVISOR_CONTENT_BETA_ENABLED==='on',
    contentDay===day?contentCalls:0,Math.max(1,Math.min(50,Number(env.TRIPADVISOR_CONTENT_DAILY_CAP)||50))),
  terra:state(!!env.TRIPADVISOR_TERRA_API_KEY,true,taDay===day?taCalls:0,Number(env.TRIPADVISOR_TERRA_DAILY_CAP)||80)
 }};
}
const sessionOf=url=>String(url.searchParams.get('session')||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);

let taDay='',taCalls=0;
function terraAllowed(env){
 if(!env.TRIPADVISOR_TERRA_API_KEY)return false;
 const day=new Date().toISOString().slice(0,10);if(day!==taDay){taDay=day;taCalls=0;}
 const cap=Number(env.TRIPADVISOR_TERRA_DAILY_CAP)||80;
 if(taCalls>=cap)return false;
 taCalls++;return true;
}

let contentDay='',contentCalls=0;
function contentAllowed(env){
 if(!env.TRIPADVISOR_CONTENT_API_KEY||env.TRIPADVISOR_CONTENT_BETA_ENABLED!=='on')return false;
 const day=new Date().toISOString().slice(0,10);if(day!==contentDay){contentDay=day;contentCalls=0;}
 const cap=Math.max(1,Math.min(50,Number(env.TRIPADVISOR_CONTENT_DAILY_CAP)||50));
 if(contentCalls>=cap)return false;
 contentCalls++;return true;
}
// /api/place-thumb: list photo for a catalogue place. Redirects to Google's photo URL or answers 404 (the app then
// shows its category tile). Costs one Place Photo call; the place_id lookup is free or cached (see place-thumb.js).
async function placeThumb(url,env,ctx){
 const name=String(url.searchParams.get('name')||'').replace(/\s+/g,' ').trim().slice(0,120);
 const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
 const cityName=String(url.searchParams.get('cityName')||'Warszawa').replace(/\s+/g,' ').trim().slice(0,60);
 const center={lat:Number(url.searchParams.get('centerLat')),lng:Number(url.searchParams.get('centerLng'))};
 const radiusKm=Math.min(50,Number(url.searchParams.get('r'))||40);
 // A cap or provider hiccup is retried after a minute; a real "no match / no photo" answer is kept for ten.
 const notFound=status=>new Response(null,{status:404,headers:{'cache-control':`private, max-age=${['quota','unavailable','disabled','no-key'].includes(status)?60:600}`,'x-thumb-status':status}});
 if(name.length<2||![lat,lng,center.lat,center.lng].every(Number.isFinite)||kmBetween({lat,lng},center)>radiusKm)return notFound('invalid');
 const photoAvailability=providerAccess(env).google.photos;
  if(photoAvailability!=='ready')return notFound(photoAvailability);
  if(!thumbAllowed(env))return notFound('quota');
 try{
  const key=env.GOOGLE_PLACES_API_KEY;
  const id=String(url.searchParams.get('googleId')||'')||await cachedGooglePlaceId({name,lat,lng,cityName,googleKey:key},{cache:caches.default,ctx});
  const uri=id&&await googlePhotoUri(id,{googleKey:key,maxWidthPx:url.searchParams.get('w')==='800'?800:320});
  if(!uri)return notFound(id?'no-photo':'no-match');
  return new Response(null,{status:302,headers:{location:uri,'cache-control':'private, max-age=3600','referrer-policy':'no-referrer'}});
 }catch{return notFound('unavailable');}
}
async function peekGooglePlaceId(name,lat,lng,cache){
 if(!name||![lat,lng].every(Number.isFinite))return '';
 try{const hit=await cache.match(new Request(placeIdCacheKey(name,lat,lng)));const v=hit&&await hit.json();return typeof v?.id==='string'?v.id:'';}catch{return '';}
}
async function placeEnrichment(url,env,ctx){
 const name=String(url.searchParams.get('name')||'').replace(/\s+/g,' ').trim().slice(0,120);
 const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
 const params=new URLSearchParams(url.searchParams);
 params.set('lat',url.searchParams.get('centerLat')||'');params.set('lng',url.searchParams.get('centerLng')||'');
 params.set('name',url.searchParams.get('cityName')||'Warszawa');
 const city=cityFromParams(params);
 if(name.length<3||!url.searchParams.has('lat')||!url.searchParams.has('lng')||![lat,lng].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lng)>180||kmBetween({lat,lng},city.center)>city.radiusKm)return json({status:'invalid',ratings:[]},422);
 // A place_id confirmed by a list thumbnail lets the card use Place Details instead of the dearer Text Search.
 const googlePlaceId=String(url.searchParams.get('googleId')||'').slice(0,300)||await peekGooglePlaceId(name,lat,lng,caches.default);
 try{
  const result=await enrichPlace({name,lat,lng,googlePlaceId,city,googleKey:env.GOOGLE_PLACES_BETA_ENABLED==='on'?(env.GOOGLE_PLACES_API_KEY||''):'',terraKey:env.TRIPADVISOR_TERRA_API_KEY||'',
   contentKey:env.TRIPADVISOR_CONTENT_BETA_ENABLED==='on'?(env.TRIPADVISOR_CONTENT_API_KEY||''):'',
   allowContent:()=>contentAllowed(env),includeContentReviews:env.TRIPADVISOR_CONTENT_INCLUDE_REVIEWS==='on',allowGoogle:()=>googleAllowed(env),allowTerra:()=>terraAllowed(env),
   includeGoogleReviews:env.GOOGLE_PLACES_INCLUDE_REVIEWS==='on',
   includeTerraReviews:env.TRIPADVISOR_TERRA_INCLUDE_REVIEWS==='on'});
  // Remember the place_id a card lookup confirmed, so list thumbnails skip their own confirmation call.
  const found=String(result?.image?.src||'').match(/\/api\/place-photo\?id=([A-Za-z0-9_-]{10,300})/)?.[1];
  if(found&&found!==googlePlaceId)ctx?.waitUntil?.(caches.default.put(new Request(placeIdCacheKey(name,lat,lng)),new Response(JSON.stringify({id:found}),{headers:{'content-type':'application/json','cache-control':'public, max-age=2592000'}})));
  return json({...result,providerStatus:providerAccess(env)},200);
 }catch{return json({status:'unavailable',ratings:[]},502);}
}


async function placeSuggest(url,env,ctx){
 const q=String(url.searchParams.get('q')||'').replace(/\s+/g,' ').trim();
 if(q.length<3||q.length>120)return json({status:'invalid-query',suggestions:[]},422);
 const city=cityFromParams(url.searchParams),useGoogle=env.GOOGLE_PLACES_AUTOCOMPLETE==='on'&&googleAllowed(env);
 // OSM results may be cached; Google predictions are never cached (Places terms).
 const cache=caches.default,cacheKey=new Request(`https://city-route-cache/place-suggest-v1?c=${city.center.lat},${city.center.lng},${city.radiusKm}&q=${encodeURIComponent(q.toLowerCase())}`);
 if(!useGoogle){const hit=await cache.match(cacheKey);if(hit)return hit;}
 try{
  const result=await suggestPlaces(q,{city,googleKey:env.GOOGLE_PLACES_API_KEY||'',googleAutocomplete:useGoogle,photonUrl:env.PLACE_GEOCODER_URL||'https://photon.komoot.io',sessionToken:sessionOf(url)});
  const cacheable=result.status==='ok'&&result.provider!=='google',res=json(result,result.status==='unavailable'?502:200,cacheable?86400:0);
  if(cacheable)ctx.waitUntil(cache.put(cacheKey,res.clone()));
  return res;
 }catch{return json({status:'unavailable',suggestions:[]},502);}
}

async function placeDetail(url,env){
 if(!googleAllowed(env))return json({status:env.GOOGLE_PLACES_API_KEY?'quota':'no-key'},404);
 try{const result=await placeDetails(url.searchParams.get('id'),{googleKey:env.GOOGLE_PLACES_API_KEY,sessionToken:sessionOf(url),city:cityFromParams(url.searchParams)});return json(result,result.status==='ok'?200:422);}
 catch{return json({status:'unavailable'},502);}
}

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),{pathname}=url;
  // Crawlers cannot see #hash fragments. /r/... serves real metadata and redirects browsers.
  if(pathname.startsWith('/r/'))return routeShareResponse(request,createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY}));
  if(pathname==='/api/location'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   try{const result=await resolveMaps(url.searchParams.get('url'));return json(result,result.status==='ok'?200:422);}catch{return json({status:'unavailable'},502);}
  }
  if(pathname==='/api/provider-status'){
    if(request.method!=='GET')return json({status:'method-not-allowed'},405);
    return json({status:'ok',providers:providerAccess(env)});
   }
   if(pathname==='/api/place-search'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   return placeSearch(url,env,ctx);
  }
  if(pathname==='/api/place-preview'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   try{const result=await placePreview(url.searchParams.get('url'),googleAllowed(env)?env.GOOGLE_PLACES_API_KEY:'',fetch,cityFromParams(url.searchParams));return json(result,result.status==='ok'?200:422);}catch{return json({status:'unavailable'},502);}
  }
  if(pathname==='/api/place-suggest'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   return placeSuggest(url,env,ctx);
  }
  if(pathname==='/api/place-enrichment'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   return placeEnrichment(url,env,ctx);
  }
  if(pathname==='/api/photo-capabilities'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   // Public capability flag only; never expose credentials or quota counters.
   return new Response(JSON.stringify({googleThumbnails:!!env.GOOGLE_PLACES_API_KEY&&env.GOOGLE_PLACES_BETA_ENABLED==='on',commons:true}),{
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=120','x-content-type-options':'nosniff'}});
  }
  if(pathname==='/api/place-thumb'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   return placeThumb(url,env,ctx);
  }
  if(pathname==='/api/place-details'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   return placeDetail(url,env);
  }
  if(pathname==='/api/place-photo'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   if(!googleAllowed(env))return json({status:env.GOOGLE_PLACES_API_KEY?'quota':'no-key'},404);
   try{
    const id=url.searchParams.get('id'),result=id?await placePhotoById(id,{googleKey:env.GOOGLE_PLACES_API_KEY}):await placePhoto(url.searchParams.get('url'),env.GOOGLE_PLACES_API_KEY,fetch,cityFromParams(url.searchParams));
    return result||json({status:'no-photo'},404);
   }catch{return json({status:'unavailable'},502);}
  }
  if(pathname==='/api/events')return events(request,env,ctx);
  return env.ASSETS.fetch(request);
 }
};
