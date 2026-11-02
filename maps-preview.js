import {allowedMapsUrl} from './location.js';
import {parseLocation} from './core.js';

const shortHost=h=>h==='maps.app.goo.gl'||h==='goo.gl';
const clean=s=>{try{return decodeURIComponent(String(s||'').replace(/\+/g,' ')).replace(/\s+/g,' ').trim();}catch{return String(s||'').replace(/\+/g,' ').replace(/\s+/g,' ').trim();}};

export function mapsLabel(value){
 const u=allowedMapsUrl(value);if(!u)return '';
 const m=u.pathname.match(/\/maps\/place\/([^/]+)/i);if(m)return clean(m[1]);
 for(const key of ['q','query']){const raw=u.searchParams.get(key);if(raw&&!/^[-+]?\d+[.,]\d+\s*[,;]\s*[-+]?\d+[.,]\d+$/.test(raw.trim()))return clean(raw);}
 return '';
}

export async function resolveMapsPreview(value,fetcher=fetch){
 let u=allowedMapsUrl(value);if(!u)return {status:'invalid-link'};
 let location=parseLocation(u.href),name=mapsLabel(u.href);
 for(let n=0;n<6;n++){
  if(location&&name)return {status:'ok',location,name,finalUrl:u.href};
  if(location&&!shortHost(u.hostname))return {status:'ok',location,name,finalUrl:u.href};
  let r;try{r=await fetcher(u.href,{redirect:'manual',signal:AbortSignal.timeout(6000)});}catch{return location?{status:'ok',location,name,finalUrl:u.href}:{status:'unavailable'};}
  const next=r.headers.get('location');
  if(![301,302,303,307,308].includes(r.status)||!next)return location?{status:'ok',location,name,finalUrl:u.href}:{status:'no-coordinates'};
  u=allowedMapsUrl(new URL(next,u).href);if(!u)return {status:'unsupported-redirect'};
  location=parseLocation(u.href)||location;name=mapsLabel(u.href)||name;
 }
 return location?{status:'ok',location,name,finalUrl:u.href}:{status:'too-many-redirects'};
}

const distance2=(a,b)=>{if(!a||!b||!Number.isFinite(a.latitude)||!Number.isFinite(a.longitude))return Infinity;const x=(a.latitude-b.lat)*Math.cos((a.latitude+b.lat)*Math.PI/360),y=a.longitude-b.lng;return x*x+y*y;};
async function searchPlace(key,name,location,fetcher=fetch){
 if(!key||!name)return null;
 const body={textQuery:`${name} Warszawa`};
 if(location)body.locationBias={circle:{center:{latitude:location.lat,longitude:location.lng},radius:1500}};
 const r=await fetcher('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key,'x-goog-fieldmask':'places.id,places.location,places.photos,places.types'},body:JSON.stringify(body),signal:AbortSignal.timeout(6000)});
 if(!r.ok)return null;const data=await r.json(),list=Array.isArray(data.places)?data.places:[];return list.sort((a,b)=>distance2(a.location,location)-distance2(b.location,location))[0]||null;
}

export async function placePreview(value,key,fetcher=fetch){
 const resolved=await resolveMapsPreview(value,fetcher);if(resolved.status!=='ok')return resolved;
 const place=await searchPlace(key,resolved.name,resolved.location,fetcher),photo=place?.photos?.[0],attr=photo?.authorAttributions?.[0];
 return {status:'ok',location:resolved.location,name:resolved.name||'',finalUrl:resolved.finalUrl,types:place?.types||[],photoEnabled:!!key,photo:photo?{available:true,authorName:attr?.displayName||'Google Maps',authorUri:attr?.uri||''}:{available:false}};
}

export async function placePhoto(value,key,fetcher=fetch){
 if(!key)return null;const resolved=await resolveMapsPreview(value,fetcher);if(resolved.status!=='ok'||!resolved.name)return null;
 const place=await searchPlace(key,resolved.name,resolved.location,fetcher),photo=place?.photos?.[0];if(!photo)return null;
 const r=await fetcher(`https://places.googleapis.com/v1/${photo.name}/media?key=${encodeURIComponent(key)}&maxWidthPx=1200`,{redirect:'follow',signal:AbortSignal.timeout(8000)});if(!r.ok)return null;
 const headers=new Headers();headers.set('content-type',r.headers.get('content-type')||'image/jpeg');headers.set('cache-control','private, no-store');return new Response(r.body,{status:200,headers});
}
