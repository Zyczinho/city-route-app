// Provider metadata displayed on demand. Do not store provider photo bytes, review text
// or Google ratings in Supabase/localStorage. Official API credentials remain on Worker.
import {kmBetween} from './geocode.js';
import {lookupContent,contentPhoto,contentReviews} from './tripadvisor-content.js';
import {bestGooglePhoto,pickGooglePhoto,MAX_GOOGLE_PHOTO_CHOICE} from './photo-quality.js';

const countryOf=city=>/^[A-Z]{2}$/.test(String(city?.countryCode||'').toUpperCase())?String(city.countryCode).toUpperCase():'PL';
const GOOGLE_MASK='id,displayName,location,rating,userRatingCount,photos,googleMapsUri';
const GOOGLE_SEARCH_MASK=GOOGLE_MASK.split(',').map(x=>'places.'+x).join(',');
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const fold=s=>String(s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const tokens=s=>new Set(fold(s).split(' ').filter(x=>x.length>2&&!['warszawa','krakow','polska','hotel','restauracja'].includes(x)));
export function isSamePlace({requestedName,requestedLat,requestedLng,candidateName,candidateLat,candidateLng,limitM=300}={}){
 const a={lat:Number(requestedLat),lng:Number(requestedLng)},b={lat:Number(candidateLat),lng:Number(candidateLng)};
 if(![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite))return false;
 if(kmBetween(a,b)*1000>limitM)return false;
 const x=tokens(requestedName),y=tokens(candidateName);
 if(!x.size||!y.size)return false;
 let common=0;for(const t of x)if(y.has(t))common++;
 if(common/Math.max(x.size,y.size)>=0.5)return true;
 // OSM often has the short name ("Charlotte") and Google the long one ("Charlotte. Chleb i Wino"):
 // accept when every word of the shorter name is in the longer one AND both points are within 100 m.
 return common>0&&common===Math.min(x.size,y.size)&&kmBetween(a,b)*1000<=100;
}
const rating=(source,score,count,url,name,checked)=>Number.isFinite(Number(score))&&Number(score)>=1&&Number(score)<=5&&Number.isSafeInteger(Number(count))&&Number(count)>0&&safeUrl(url)?{
 source,value:Number(score),reviewCount:Number(count),max:5,url:safeUrl(url),listing:String(name||'').slice(0,140),checked,method:'licensed-official-api'
}:null;
async function googleLookup({name,lat,lng,googlePlaceId,key,fetcher,city,includeReviews=false}){
 if(!key)return null;
 let url,opts;
 if(googlePlaceId&&/^[A-Za-z0-9_-]{10,300}$/.test(googlePlaceId)){
  url='https://places.googleapis.com/v1/places/'+encodeURIComponent(googlePlaceId)+'?languageCode=pl';
  opts={headers:{'x-goog-api-key':key,'x-goog-fieldmask':GOOGLE_MASK+(includeReviews?',reviews':'')}};
 }else{
  url='https://places.googleapis.com/v1/places:searchText';
  opts={method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key,'x-goog-fieldmask':GOOGLE_SEARCH_MASK+(includeReviews?',places.reviews':'')},body:JSON.stringify({
   textQuery:name+', '+String(city?.name||'Warszawa'),languageCode:'pl',regionCode:countryOf(city),
   locationBias:{circle:{center:{latitude:lat,longitude:lng},radius:500}}
  })};
 }
 let r;try{r=await fetcher(url,{...opts,signal:AbortSignal.timeout(7000)});}catch{return null;}
 if(!r.ok)return null;
 const data=await r.json().catch(()=>null),rows=Array.isArray(data?.places)?data.places:[data];
 return rows.find(x=>isSamePlace({requestedName:name,requestedLat:lat,requestedLng:lng,candidateName:x?.displayName?.text,candidateLat:x?.location?.latitude,candidateLng:x?.location?.longitude,limitM:googlePlaceId?350:230}))||null;
}
const terraName=x=>Array.isArray(x?.names)?(x.names.find(y=>y.primary)?.value||x.names[0]?.value):x?.name||'';
async function terraLookup({name,lat,lng,key,fetcher,city}){
 if(!key)return null;
 const url=new URL('https://terra.tripadvisor.com/api/locations/search');
 url.searchParams.set('version','1');url.searchParams.set('query',name);url.searchParams.set('size','5');url.searchParams.set('country_code',countryOf(city));
 if(city?.name)url.searchParams.set('geo_name',city.name);
 let r;try{r=await fetcher(url.href,{headers:{'x-api-key':key,'accept':'application/json'},signal:AbortSignal.timeout(7000)});}catch{return null;}
 if(!r.ok)return null;
 const data=await r.json().catch(()=>null),rows=Array.isArray(data?.data)?data.data.map(x=>x.location||x):[];
 return rows.find(x=>isSamePlace({requestedName:name,requestedLat:lat,requestedLng:lng,candidateName:terraName(x),candidateLat:x?.coordinates?.latitude,candidateLng:x?.coordinates?.longitude,limitM:280}))||null;
}
async function terraPhoto(id,key,fetcher){
 if(!key||!/^[0-9]{1,12}$/.test(String(id||'')))return null;
 let r;try{r=await fetcher('https://terra.tripadvisor.com/api/locations/'+id+'/photos?version=1&page=1&size=1',{
  headers:{'x-api-key':key,'accept':'application/json'},signal:AbortSignal.timeout(7000)
 });}catch{return null;}
 if(!r.ok)return null;
 const data=await r.json().catch(()=>null),pic=data?.data?.[0];
 const src=safeUrl(pic?.original_size_url||pic?.images?.large?.url||pic?.url);
 if(!src)return null;
 const host=new URL(src).hostname;
 if(!/(^|\.)tripadvisor\.com$/.test(host))return null;
 return {src,credit:{author:String(pic?.user?.name||pic?.contributor?.name||'Tripadvisor'),license:'Treść Tripadvisor',via:'Tripadvisor',source:'https://www.tripadvisor.com/'}};
}

const authorName=(value,fallback)=>String(value||fallback).slice(0,180);
const textInLanguage=values=>Array.isArray(values)?values.find(x=>x.primary)?.value||values[0]?.value||'':String(values||'');
function googleReview(r,placeUrl){
 const text=String(r?.text?.text||'').trim(),author=r?.authorAttribution;
 if(!text)return null;
 const avatar=safeUrl(author?.photoUri),url=safeUrl(r.googleMapsUri)||safeUrl(placeUrl);
 return {source:'google',text,author:authorName(author?.displayName,'Użytkownik Google Maps'),avatar,
  authorUrl:safeUrl(author?.uri),url,rating:Number(r.rating)||null,when:String(r.relativePublishTimeDescription||''),translated:!!r.originalText?.text&&r.originalText.text!==text};
}
async function terraReviews(id,key,fetcher){
 if(!/^[0-9]{1,12}$/.test(String(id||'')))return [];
 const u=new URL('https://terra.tripadvisor.com/api/locations/'+id+'/reviews');
 u.searchParams.set('version','1');u.searchParams.set('page','1');u.searchParams.set('size','3');
 u.searchParams.set('language','primary');
 let response;
 try{response=await fetcher(u.href,{headers:{'x-api-key':key,'accept':'application/json'},signal:AbortSignal.timeout(7000)});}catch{return [];}
 if(!response.ok)return [];
 const body=await response.json().catch(()=>null);
 return (Array.isArray(body?.data)?body.data:[]).slice(0,3).map(r=>{
  const txt=String(textInLanguage(r?.text)||'').trim(),url=safeUrl(r?.url);
  if(!txt||!url)return null;
  return {source:'tripadvisor',text:txt,title:String(textInLanguage(r.title)||''),
   rating:Number(r.rating)||null,author:authorName(r.user?.username||r.user?.display_name||r.user?.name,'Użytkownik Tripadvisor'),
   authorUrl:safeUrl(r.user?.url),avatar:safeUrl(r.user?.avatar_url),url,
   when:String(r.publish_ts||'').slice(0,10),translated:false};
 }).filter(Boolean);
}
export async function enrichPlace({name,lat,lng,googlePlaceId='',city=null,googleKey='',terraKey='',contentKey='',fetcher=fetch,allowGoogle=()=>true,allowTerra=()=>true,allowContent=()=>true,includeGoogleReviews=false,includeTerraReviews=false,includeContentReviews=false}={}){
 name=String(name||'').replace(/\s+/g,' ').trim().slice(0,120);lat=Number(lat);lng=Number(lng);
 if(name.length<3||![lat,lng].every(Number.isFinite)||lat<-90||lat>90||lng<-180||lng>180)return {status:'invalid',ratings:[],image:null};
 const checked=new Date().toISOString(),ratings=[],reviews=[];
 const providers={google:!!googleKey,tripadvisor:!!contentKey||!!terraKey};
 const google=providers.google&&allowGoogle()?await googleLookup({name,lat,lng,googlePlaceId,key:googleKey,fetcher,city,includeReviews:includeGoogleReviews}):null;
 if(google){
  const found=rating('google',google.rating,google.userRatingCount,google.googleMapsUri,google.displayName?.text,checked);if(found)ratings.push(found);
  if(includeGoogleReviews)reviews.push(...(Array.isArray(google.reviews)?google.reviews:[]).slice(0,3).map(r=>googleReview(r,google.googleMapsUri)).filter(Boolean));
 }
 const content=contentKey?await lookupContent({name,lat,lng,key:contentKey,fetcher,allowCall:allowContent}):null;
 if(content){
  const found=rating('tripadvisor',content.rating,content.reviewCount,content.url,content.name,checked);
  if(found)ratings.push(found);
  if(includeContentReviews)reviews.push(...await contentReviews({id:content.id,key:contentKey,fetcher,allowCall:allowContent}));
 }
 const terraQuota=!contentKey&&!!terraKey&&allowTerra();
 const ta=terraQuota?await terraLookup({name,lat,lng,key:terraKey,fetcher,city}):null;
 if(ta){
  const overall=ta.traveler_ratings?.overall||{},link=typeof ta.urls?.tripadvisor==='string'?ta.urls.tripadvisor:ta.urls?.tripadvisor?.url;
  const found=rating('tripadvisor',overall.rating,overall.count,link,terraName(ta),checked);if(found)ratings.push(found);
  if(includeTerraReviews&&allowTerra())reviews.push(...await terraReviews(ta.id,terraKey,fetcher));
 }
 let image=null;
 const photo=bestGooglePhoto(google?.photos)?.photo,author=photo?.authorAttributions?.[0];
 if(photo?.name&&google?.id){
  image={src:'/api/place-photo?id='+encodeURIComponent(google.id),credit:{
   author:String(author?.displayName||'Google Maps'),license:'Zdjęcie Google Maps',via:'Google Maps',
   source:safeUrl(author?.uri)||safeUrl(google.googleMapsUri)||'https://maps.google.com'
  }};
  // "Inne zdjęcie": authors of the other photos, in the order /api/place-photo?n=1… serves them (same response, no extra call).
  image.more=[];
  for(let n=1;n<=MAX_GOOGLE_PHOTO_CHOICE;n++){
   const p=pickGooglePhoto(google.photos,n)?.photo;if(!p?.name)break;
   const a=p.authorAttributions?.[0];
   image.more.push({author:String(a?.displayName||'Google Maps'),source:safeUrl(a?.uri)||safeUrl(google.googleMapsUri)||'https://maps.google.com'});
  }
 }else if(content?.id){
  image=await contentPhoto({id:content.id,key:contentKey,fetcher,allowCall:allowContent});
  if(image&&content.url)image.credit.source=content.url;
 }else if(ta?.id&&terraQuota){
  image=await terraPhoto(ta.id,terraKey,fetcher);
  if(image){
   const url=typeof ta.urls?.tripadvisor==='string'?ta.urls.tripadvisor:ta.urls?.tripadvisor?.url;
   if(safeUrl(url))image.credit.source=safeUrl(url);
  }
 }
 return {status:ratings.length||image||reviews.length?'ok':!providers.google&&!providers.tripadvisor?'no-key':'no-match',
  ratings,reviews,image,googlePlaceId:google?.id||null,tripadvisorId:content?.id||ta?.id||null,available:providers,checked};
}
