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
import {resolveMaps} from './location.js';
import {placePreview,placePhoto} from './maps-preview.js';
import {searchPlaceAddress,suggestPlaces,placeDetails,placePhotoById,cityFromParams} from './geocode.js';
import {ticketmasterQuery,normalizeTicketmaster,dedupe} from './events.js';
import {enrichPlace} from './place-enrichment.js';
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
async function placeEnrichment(url,env){
 const name=String(url.searchParams.get('name')||'').replace(/\s+/g,' ').trim().slice(0,120);
 const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
 const params=new URLSearchParams(url.searchParams);
 params.set('lat',url.searchParams.get('centerLat')||'');params.set('lng',url.searchParams.get('centerLng')||'');
 params.set('name',url.searchParams.get('cityName')||'Warszawa');
 const city=cityFromParams(params);
 if(name.length<3||!url.searchParams.has('lat')||!url.searchParams.has('lng')||![lat,lng].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lng)>180||kmBetween({lat,lng},city.center)>city.radiusKm)return json({status:'invalid',ratings:[]},422);
 const googlePlaceId=String(url.searchParams.get('googleId')||'').slice(0,300);
 try{
  const result=await enrichPlace({name,lat,lng,googlePlaceId,city,googleKey:env.GOOGLE_PLACES_BETA_ENABLED==='on'?(env.GOOGLE_PLACES_API_KEY||''):'',terraKey:env.TRIPADVISOR_TERRA_API_KEY||'',
   contentKey:env.TRIPADVISOR_CONTENT_BETA_ENABLED==='on'?(env.TRIPADVISOR_CONTENT_API_KEY||''):'',
   allowContent:()=>contentAllowed(env),includeContentReviews:env.TRIPADVISOR_CONTENT_INCLUDE_REVIEWS==='on',allowGoogle:()=>googleAllowed(env),allowTerra:()=>terraAllowed(env),
   includeGoogleReviews:env.GOOGLE_PLACES_INCLUDE_REVIEWS==='on',
   includeTerraReviews:env.TRIPADVISOR_TERRA_INCLUDE_REVIEWS==='on'});
  return json(result,200);
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
  if(pathname==='/api/location'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   try{const result=await resolveMaps(url.searchParams.get('url'));return json(result,result.status==='ok'?200:422);}catch{return json({status:'unavailable'},502);}
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
   return placeEnrichment(url,env);
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
