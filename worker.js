// Cloudflare Worker: serves the static app from dist/ and one data endpoint, /api/events.
// Secrets live in Cloudflare (Workers → city-route-app → Settings → Variables and Secrets), never in the repo:
//   TICKETMASTER_API_KEY   Discovery API key from developer.ticketmaster.com
//   TICKETMASTER_AFFILIATE optional Impact deep-link template containing {url}
import {ticketmasterQuery,normalizeTicketmaster,dedupe} from './events.js';

const json=(body,status=200,maxAge=0)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':maxAge?`public, max-age=${maxAge}`:'no-store'}});

async function events(request,env,ctx){
 const days=Number(new URL(request.url).searchParams.get('days'))||7;
 if(!env.TICKETMASTER_API_KEY)return json({status:'no-key',events:[],sources:[]});
 // Answers are shared for an hour per window so the free API quota is never a concern.
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
  const {pathname}=new URL(request.url);
  if(pathname==='/api/events')return events(request,env,ctx);
  return env.ASSETS.fetch(request);
 }
};
