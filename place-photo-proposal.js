// PHOTO-COVERAGE-039 / P0 #1: automatic photo proposal inside Add Place.
// After the user picks a venue we look for a photo of THAT exact place, never a look-alike:
//  1. Google Places photo of the picked Google result (only when the Worker has a key; preview via proxy),
//  2. the lead image of the Wikipedia article about the place (pl, then en), accepted only when the
//     article's coordinates sit within 350 m AND its title shares the place's distinctive name words,
//     then re-checked on Commons for a free licence, author and resolution,
//  3. named, geotagged Commons files within ~100 m (existing card fallback) as alternatives.
// The user always decides (Use / Other / Skip). Nothing found means an honest "no photo".
import {commonsTokens,licensedCommonsImage,findCommonsPhotos,distanceM} from './commons-photo-source.js';

export const MAX_WIKI_METERS=350;
export const MAX_CANDIDATES=6;
const GENERIC=new Set(['muzeum','museum','budynek','obiekt','hotel','restauracja','restaurant','kawiarnia','cafe','park','plac','square','ulica','street','kosciol','church','palac','palace','hala','brama','gate','zamek','castle','synagoga','synagogue','pomnik','bar','pub','klub','club','galeria','gallery','centrum','dom','house']);
const stem=t=>t.slice(0,5);
const same=(a,b)=>a===b||(a.length>=5&&b.length>=5&&stem(a)===stem(b));

// Share of the place's own words found in an article title; requires one distinctive (non-generic) word.
export function titleMatch(name,title){
 const want=commonsTokens(name),have=commonsTokens(title);
 if(!want.length||!have.length)return 0;
 const found=want.filter(w=>have.some(h=>same(w,h)));
 if(!found.some(w=>!GENERIC.has(w)))return 0;
 return found.length/want.length;
}

export function wikiSearchUrl(place,{city='',lang='pl'}={}){
 const name=String(place?.name||'').trim();
 if(name.length<3||!['pl','en'].includes(lang))return null;
 const u=new URL(`https://${lang}.wikipedia.org/w/api.php`);
 const params={action:'query',generator:'search',gsrsearch:[name,city].filter(Boolean).join(' '),gsrlimit:'5',gsrnamespace:'0',prop:'coordinates|pageimages',piprop:'name',format:'json',formatversion:'2',origin:'*'};
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 return u.href;
}

// Pages are kept only with a lead image, coordinates near the picked venue and a matching title.
export function pickWikiPages(place,pages=[]){
 const here={lat:Number(place?.lat),lng:Number(place?.lng)};
 if(!Number.isFinite(here.lat)||!Number.isFinite(here.lng))return [];
 return pages.map(p=>{
  const c=p?.coordinates?.[0];
  if(!p?.pageimage||!c||!Number.isFinite(Number(c.lat))||!Number.isFinite(Number(c.lon)))return null;
  const m=distanceM(here,{lat:Number(c.lat),lng:Number(c.lon)}),match=titleMatch(place.name,p.title);
  return m<=MAX_WIKI_METERS&&match>=.5?{title:p.title,file:p.pageimage,m,match,index:Number(p.index)||99}:null;
 }).filter(Boolean).sort((a,b)=>b.match-a.match||a.index-b.index||a.m-b.m);
}

export function commonsInfoUrl(files=[]){
 const titles=[...new Set(files.filter(f=>typeof f==='string'&&f&&!/[|#<>[\]{}]/.test(f)))].slice(0,MAX_CANDIDATES);
 if(!titles.length)return null;
 const u=new URL('https://commons.wikimedia.org/w/api.php');
 const params={action:'query',titles:titles.map(t=>'File:'+t.replace(/_/g,' ')).join('|'),prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiurlwidth:'960',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist',iiextmetadatalanguage:'en',format:'json',formatversion:'2',origin:'*'};
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 return u.href;
}

// Google photos stay behind the Worker proxy; they are referenced by place id, never copied.
export function googleCandidate(selection){
 const id=String(selection?.placeId||'');
 if(selection?.source!=='google'||!selection?.photo?.available||!/^[A-Za-z0-9_-]{10,300}$/.test(id))return null;
 const author=String(selection.photo.authorName||'Google Maps').slice(0,120);
 const authorUri=/^https:\/\//i.test(selection.photo.authorUri||'')?selection.photo.authorUri:null;
 return {src:'/api/place-photo?id='+encodeURIComponent(id),author,license:'Google Maps',licenseUrl:null,source:authorUri||'https://www.google.com/maps/place/?q=place_id:'+encodeURIComponent(id),via:'Google Maps',kind:'google',googlePlaceId:id};
}

// "Inne zdjęcie": the other Google photos of the same place, each with its own author (from place details).
export function googleAlternatives(selection){
 const first=googleCandidate(selection);if(!first)return [];
 const more=Array.isArray(selection.photo.more)?selection.photo.more.slice(0,3):[];
 return more.map((a,i)=>{
  const n=i+1,authorUri=/^https:\/\//i.test(a?.authorUri||'')?a.authorUri:null;
  return {...first,src:first.src+'&n='+n,author:String(a?.authorName||'Google Maps').slice(0,120),source:authorUri||first.source,photoChoice:n};
 });
}

// For an OSM / pin / Maps-link pick: ask the Worker (Google Text Search, same-place check ≤300 m + name)
// for the Google photo of THIS venue. Only runs when the Worker has a Google key; otherwise 'no-key'.
export function enrichmentUrl(place,cityInfo={}){
 const c=cityInfo?.center;
 if(!c||!Number.isFinite(Number(place?.lat))||!Number.isFinite(Number(place?.lng))||String(place?.name||'').trim().length<3)return null;
 const q=new URLSearchParams({name:String(place.name).trim().slice(0,120),lat:String(place.lat),lng:String(place.lng),city:cityInfo.id||'',cityName:cityInfo.name||'',centerLat:String(c.lat),centerLng:String(c.lng),r:String(cityInfo.radiusKm||40),googleId:''});
 return '/api/place-enrichment?'+q.toString();
}
export function googleCandidateFromEnrichment(data){
 const image=data?.image,credit=image?.credit||{};
 const m=/^\/api\/place-photo\?id=([A-Za-z0-9_-]{10,300})$/.exec(String(image?.src||''));
 if(!m||credit.via&&credit.via!=='Google Maps')return null;
 const id=decodeURIComponent(m[1]);
 return {src:image.src,author:String(credit.author||'Google Maps').slice(0,120),license:'Google Maps',licenseUrl:null,
  source:/^https:\/\//i.test(credit.source||'')?credit.source:'https://www.google.com/maps/place/?q=place_id:'+encodeURIComponent(id),via:'Google Maps',kind:'google',googlePlaceId:id};
}

const dedupe=list=>{const seen=new Set();return list.filter(c=>c&&!seen.has(c.src)&&seen.add(c.src));};
async function getJson(url,{fetcher,signal}){
 const r=await fetcher(url,{signal,headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('http-'+r.status);
 return r.json();
}

// Returns {status:'ok'|'none'|'error', candidates}. 'error' means we could not check (offline, rate limit),
// which the UI reports differently from a genuine "no photo of this place".
export async function findPlacePhotoCandidates(selection,{city='',cityInfo=null,fetcher=fetch,signal}={}){
 const place={id:selection?.placeId||selection?.osmId||'',name:selection?.name,lat:selection?.location?.lat,lng:selection?.location?.lng};
 const candidates=[googleCandidate(selection),...googleAlternatives(selection)];
 let failures=0,attempts=0;
 if(String(place.name||'').trim().length>=3&&Number.isFinite(Number(place.lat))&&Number.isFinite(Number(place.lng))){
  for(const lang of ['pl','en']){
   attempts++;
   try{
    const data=await getJson(wikiSearchUrl(place,{city,lang}),{fetcher,signal});
    const pages=pickWikiPages(place,data?.query?.pages||[]);
    if(!pages.length)continue;
    const info=await getJson(commonsInfoUrl(pages.map(p=>p.file)),{fetcher,signal});
    const byTitle=new Map((info?.query?.pages||[]).map(p=>[String(p.title||'').replace(/^File:/i,''),p]));
    for(const page of pages){
     const hit=byTitle.get(page.file.replace(/_/g,' '));
     const image=hit&&licensedCommonsImage(hit,place);
     if(image){const {width,height,...c}=image;candidates.push({...c,kind:'wikipedia',article:page.title});}
    }
    if(candidates.some(c=>c?.kind==='wikipedia'))break;
   }catch(error){if(error?.name==='AbortError')throw error;failures++;}
  }
  // Cafés, bars and restaurants rarely have a free photo: then ask Google (one Text Search per pick).
  const enrich=!candidates.some(c=>c?.kind==='google'||c?.kind==='wikipedia')&&enrichmentUrl(place,cityInfo);
  if(enrich){
   try{const r=await fetcher(enrich,{signal,headers:{accept:'application/json'}});const g=googleCandidateFromEnrichment(await r.json());if(g)candidates.push(g);}
   catch(error){if(error?.name==='AbortError')throw error;}
  }
  attempts++;
  try{for(const c of await findCommonsPhotos(place,{fetcher,signal}))candidates.push({...c,kind:'commons'});}
  catch(error){if(error?.name==='AbortError')throw error;failures++;}
 }
 // Other Google photos of the same place come last: they are alternatives, not the proposal.
 const rank=c=>c.kind==='google'&&c.photoChoice?3:({wikipedia:0,google:1,commons:2}[c.kind]??4);
 const list=dedupe(candidates).sort((a,b)=>rank(a)-rank(b)).slice(0,MAX_CANDIDATES);
 return {status:list.length?'ok':failures&&failures===attempts?'error':'none',candidates:list};
}

// Prefill only a photo with a verifiable source and identity, never a generic nearby Commons match.
// Google results have an exact Place ID (or the Worker checked name + coordinates); Wikipedia
// candidates passed both article identity/geolocation and the Commons free-licence gate.
// Users can still replace or skip the preselection before saving.
export function autoPhotoCandidateIndex(candidates=[]){
 if(!Array.isArray(candidates))return -1;
 return candidates.findIndex(c=>c?.kind==='wikipedia'&&!!acceptedPhotoRecord(c)||
  c?.kind==='google'&&!!acceptedGooglePlaceId(c));
}

// app.js reads the accepted proposal from the form; anything malformed or off-allow-list is ignored.
export function readAcceptedPhoto(json){
 let value;try{value=JSON.parse(String(json||'null'));}catch{return null;}
 const credit=value?.imageCredit;
 if(!credit||credit.via!=='Wikimedia Commons')return null;
 if(!/^https:\/\//.test(String(credit.source||''))||(credit.licenseUrl&&!/^https:\/\//.test(String(credit.licenseUrl))))return null;
 return acceptedPhotoRecord({src:value.image,...credit});
}

// What app.js stores on the new place when the user accepts a proposal. Only freely licensed
// Wikimedia files are stored; a Google photo stays a preview (Google terms) and keeps showing
// through the place's googlePlaceId and the Worker proxy.
export const acceptedGooglePhotoChoice=candidate=>acceptedGooglePlaceId(candidate)&&Number.isInteger(candidate.photoChoice)&&candidate.photoChoice>0&&candidate.photoChoice<=3?candidate.photoChoice:0;
export const acceptedGooglePlaceId=candidate=>candidate?.via==='Google Maps'&&/^[A-Za-z0-9_-]{10,300}$/.test(String(candidate.googlePlaceId||''))?candidate.googlePlaceId:'';
export function acceptedPhotoRecord(candidate){
 if(!candidate||typeof candidate.src!=='string'||candidate.via!=='Wikimedia Commons')return null;
 if(!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(candidate.src))return null;
 return {image:candidate.src,imageCredit:{author:String(candidate.author||'').slice(0,120),license:String(candidate.license||'').slice(0,40),licenseUrl:candidate.licenseUrl||null,source:candidate.source,via:candidate.via}};
}
