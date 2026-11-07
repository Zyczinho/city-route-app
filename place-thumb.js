// List thumbnails on the cheapest compliant Google Places path (Places API New pricing, checked 2026-11-07):
//   1. place_id: Text Search with field mask `places.id` (Essentials IDs Only, free, unlimited), then one
//      Place Details `id,displayName,location` (Pro) to confirm it is the same venue. Google allows caching
//      place_id indefinitely, so the confirmed id is kept in the Cloudflare cache and step 1 runs once per place.
//   2. photo: Place Details `photos` (Essentials IDs Only, free) and Place Photo media (the only paid call per
//      thumbnail). The browser is redirected to Google's short-lived photoUri; no photo bytes or ratings are stored.
import {isSamePlace} from './place-enrichment.js';
import {bestGooglePhoto} from './photo-quality.js';

const GOOGLE='https://places.googleapis.com/v1/';
const ID_RE=/^[A-Za-z0-9_-]{10,300}$/;
const fold=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,' ').trim();
export const placeIdCacheKey=(name,lat,lng)=>`https://city-route-cache/google-place-id-v1?n=${encodeURIComponent(fold(name))}&lat=${Number(lat).toFixed(4)}&lng=${Number(lng).toFixed(4)}`;

async function call(fetcher,url,init){
 try{const r=await fetcher(url,{...init,signal:AbortSignal.timeout(6500)});return r.ok?await r.json().catch(()=>null):null;}catch{return null;}
}

// Returns a confirmed Google place id or null. Never returns an id whose name and position do not match.
export async function findGooglePlaceId({name,lat,lng,cityName='Warszawa',googleKey,fetcher=fetch}){
 if(!googleKey||String(name||'').trim().length<2||![lat,lng].every(Number.isFinite))return null;
 const search=await call(fetcher,GOOGLE+'places:searchText',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':googleKey,'x-goog-fieldmask':'places.id'},
  body:JSON.stringify({textQuery:`${name}, ${cityName}`,languageCode:'pl',regionCode:'PL',maxResultCount:3,locationBias:{circle:{center:{latitude:lat,longitude:lng},radius:300}}})});
 for(const candidate of (search?.places||[]).slice(0,2)){
  if(!ID_RE.test(String(candidate?.id||'')))continue;
  const d=await call(fetcher,GOOGLE+'places/'+candidate.id,{headers:{'x-goog-api-key':googleKey,'x-goog-fieldmask':'id,displayName,location'}});
  if(d&&isSamePlace({requestedName:name,requestedLat:lat,requestedLng:lng,candidateName:d.displayName?.text,candidateLat:d.location?.latitude,candidateLng:d.location?.longitude}))return candidate.id;
 }
 return null;
}

// Cached place_id lookup. A miss is remembered for a week so unknown venues do not repeat the confirmation call.
export async function cachedGooglePlaceId(params,{cache,ctx}){
 const key=new Request(placeIdCacheKey(params.name,params.lat,params.lng));
 const hit=cache&&await cache.match(key);
 if(hit){const v=await hit.json().catch(()=>null);return v?.id&&ID_RE.test(v.id)?v.id:null;}
 const id=await findGooglePlaceId(params);
 if(cache){
  const res=new Response(JSON.stringify({id}),{headers:{'content-type':'application/json','cache-control':`public, max-age=${id?2592000:604800}`}});
  const put=cache.put(key,res);ctx?.waitUntil?ctx.waitUntil(put):await put;
 }
 return id;
}

// Short-lived Google photo URL for a place id, sized for list thumbnails.
export async function googlePhotoUri(placeId,{googleKey,fetcher=fetch,maxWidthPx=320}){
 if(!googleKey||!ID_RE.test(String(placeId||'')))return null;
 const d=await call(fetcher,GOOGLE+'places/'+placeId,{headers:{'x-goog-api-key':googleKey,'x-goog-fieldmask':'photos'}});
 const photo=bestGooglePhoto(d?.photos)?.photo;if(!photo?.name)return null;
 const media=await call(fetcher,`${GOOGLE}${photo.name}/media?key=${encodeURIComponent(googleKey)}&maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`,{});
 const uri=String(media?.photoUri||'');
 return /^https:\/\/[a-z0-9.-]+\.(googleusercontent|google)\.com\//i.test(uri)?uri:null;
}
