// Cloudflare Worker: serves the static app plus lightweight API endpoints.
// Secrets live in Cloudflare (Workers → city-route-app → Settings → Variables and Secrets), never in the repo:
//   TICKETMASTER_API_KEY   Discovery API key from developer.ticketmaster.com
//   TICKETMASTER_AFFILIATE optional Impact deep-link template containing {url}
//   GOOGLE_PLACES_API_KEY  optional Google Places API (New) key; enables automatic place photo preview
import {resolveMaps} from './location.js';
import {placePreview,placePhoto} from './maps-preview.js';
import {ticketmasterQuery,normalizeTicketmaster,dedupe} from './events.js';

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

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),{pathname}=url;
  if(pathname==='/api/location'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   try{const result=await resolveMaps(url.searchParams.get('url'));return json(result,result.status==='ok'?200:422);}catch{return json({status:'unavailable'},502);}
  }
  if(pathname==='/api/place-preview'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   try{const result=await placePreview(url.searchParams.get('url'),env.GOOGLE_PLACES_API_KEY);return json(result,result.status==='ok'?200:422);}catch{return json({status:'unavailable'},502);}
  }
  if(pathname==='/api/place-photo'){
   if(request.method!=='GET')return json({status:'method-not-allowed'},405);
   try{const result=await placePhoto(url.searchParams.get('url'),env.GOOGLE_PLACES_API_KEY);return result||json({status:env.GOOGLE_PLACES_API_KEY?'no-photo':'no-key'},404);}catch{return json({status:'unavailable'},502);}
  }
  if(pathname==='/api/events')return events(request,env,ctx);
  return env.ASSETS.fetch(request);
 }
};
