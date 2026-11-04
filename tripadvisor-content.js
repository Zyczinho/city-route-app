// Tripadvisor Content API (self-serve) adapter. Calls are made on Cloudflare Worker
// using a secret key; nothing about this API key is shipped to the browser.
// Source: https://tripadvisor-content-api.readme.io/reference/overview
import {isSamePlace} from './place-enrichment.js';

const base='https://api.content.tripadvisor.com/api/v1/location/';
const httpsUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const photoUrl=s=>{const u=httpsUrl(s);return u&&/(^|\.)tripadvisor\.(com|[a-z]{2,3})$/i.test(new URL(u).hostname)?u:null;};
const properId=x=>/^[0-9]{1,12}$/.test(String(x||''))?String(x):null;
const safe=s=>String(s||'').slice(0,240);
const urlFor=(endpoint,key,params={})=>{const url=new URL(endpoint,base);url.searchParams.set('key',key);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));return url.href;};
async function jsonGet(endpoint,key,params,fetcher,allowCall){
 if(!allowCall())return null;
 try{
  const r=await fetcher(urlFor(endpoint,key,params),{headers:{accept:'application/json'},signal:AbortSignal.timeout(6500)});
  return r.ok?await r.json().catch(()=>null):null;
 }catch{return null;}
}
// Search produces approximate candidates. Always fetch details and double-check both
// name and coordinates before assigning provider data to a specific user's place.
export async function lookupContent({name,lat,lng,key,fetcher=fetch,allowCall=()=>true}={}){
 if(!key||!name||![lat,lng].every(Number.isFinite))return null;
 const search=await jsonGet('search',key,{searchQuery:name,latLong:lat+','+lng,radius:'0.5',radiusUnit:'km',language:'pl'},fetcher,allowCall);
 const candidates=Array.isArray(search?.data)?search.data:[];
 for(const candidate of candidates.slice(0,4)){
  const id=properId(candidate?.location_id);if(!id)continue;
  const info=await jsonGet(id+'/details',key,{language:'pl'},fetcher,allowCall);
  if(!info)continue;
  if(!isSamePlace({requestedName:name,requestedLat:lat,requestedLng:lng,
    candidateName:info.name||candidate.name,candidateLat:Number(info.latitude),candidateLng:Number(info.longitude),limitM:300}))continue;
  return {id,name:safe(info.name),rating:Number(info.rating),reviewCount:Number(info.num_reviews),
    url:httpsUrl(info.web_url),lat:Number(info.latitude),lng:Number(info.longitude)};
 }
 return null;
}
export async function contentPhoto({id,key,fetcher=fetch,allowCall=()=>true}={}){
 id=properId(id);if(!id||!key)return null;
 const body=await jsonGet(id+'/photos',key,{language:'pl',limit:1},fetcher,allowCall);
 const photo=Array.isArray(body?.data)?body.data[0]:null;
 const src=photoUrl(photo?.images?.large?.url||photo?.images?.medium?.url||photo?.images?.original?.url);
 if(!src)return null;
 return {src,credit:{author:safe(photo?.user?.username||photo?.user?.name||'Tripadvisor'),license:'Zdjęcie Tripadvisor',
   via:'Tripadvisor',source:httpsUrl(photo?.url)||'https://www.tripadvisor.com/'}};
}
export async function contentReviews({id,key,fetcher=fetch,allowCall=()=>true}={}){
 id=properId(id);if(!id||!key)return [];
 const body=await jsonGet(id+'/reviews',key,{language:'pl',limit:3},fetcher,allowCall);
 return (Array.isArray(body?.data)?body.data:[]).slice(0,3).map(r=>{
  const text=String(r.text||'').trim(),url=httpsUrl(r.url);
  if(!text||!url)return null;
  return {source:'tripadvisor',author:safe(r.user?.username||r.user?.name||'Użytkownik Tripadvisor'),
    text,url,authorUrl:httpsUrl(r.user?.url),avatar:photoUrl(r.user?.avatar?.medium?.url),
    rating:Number(r.rating)||null,when:String(r.published_date||'').slice(0,10),title:safe(r.title)};
 }).filter(Boolean);
}
