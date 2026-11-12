import {bestGooglePhoto,pickGooglePhoto,MAX_GOOGLE_PHOTO_CHOICE} from './photo-quality.js';
// Place lookup for the Worker. Everything is scoped to the active city (centre + radius) that the client sends,
// so Kraków searches stay in Kraków. Google Places is used only when a key is configured; autocomplete per keystroke
// additionally needs GOOGLE_PLACES_AUTOCOMPLETE=on, so no new paid usage starts without an explicit switch.
const WARSAW={id:'warsaw',name:'Warszawa',countryCode:'PL',center:{lat:52.2297,lng:21.0122},radiusKm:40};
const DEFAULT_PHOTON='https://photon.komoot.io';

export function normalizePlaceQuery(value){
 const q=String(value||'').replace(/\s+/g,' ').trim();
 if(q.length<3||q.length>220)return '';
 return q;
}

// Reads ?city=&lat=&lng=&r= from a request. Anything missing or invalid falls back to Warsaw, the launch city.
export function cityFromParams(params){
 const get=k=>params?.get?.(k);
 const lat=Number(get('lat')),lng=Number(get('lng')),r=Number(get('r'));
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return WARSAW;
 const id=String(get('city')||'').replace(/[^a-z0-9-]/gi,'').slice(0,40)||'custom';
 const name=String(get('name')||'').replace(/\s+/g,' ').trim().slice(0,60);
 const requestedCountry=String(get('country')||'PL').toUpperCase();
 const countryCode=/^[A-Z]{2}$/.test(requestedCountry)?requestedCountry:'PL';
 return {id,name,countryCode,center:{lat,lng},radiusKm:Number.isFinite(r)&&r>0?Math.min(r,50):40};
}

export function kmBetween(a,b){
 const toRad=x=>x*Math.PI/180,R=6371,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);
 const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}

const inCity=(lat,lng,city)=>Number.isFinite(lat)&&Number.isFinite(lng)&&kmBetween(city.center,{lat,lng})<=city.radiusKm;
const fold=s=>String(s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'');
const queryForCity=(q,city)=>!city.name||fold(q).includes(fold(city.name))?q:`${q}, ${city.name}`;

function bbox(city){
 const dLat=city.radiusKm/111,dLng=city.radiusKm/(111*Math.cos(city.center.lat*Math.PI/180));
 return [city.center.lng-dLng,city.center.lat-dLat,city.center.lng+dLng,city.center.lat+dLat].map(n=>n.toFixed(4)).join(',');
}

async function postJson(fetcher,url,key,fieldMask,body){
 const headers={'content-type':'application/json','x-goog-api-key':key};if(fieldMask)headers['x-goog-fieldmask']=fieldMask;
 let r;try{r=await fetcher(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(6500)});}catch{return null;}
 return r.ok?r.json().catch(()=>null):null;
}

async function googleSearch(query,key,fetcher,city){
 if(!key)return null;
 const data=await postJson(fetcher,'https://places.googleapis.com/v1/places:searchText',key,'places.id,places.displayName,places.formattedAddress,places.location,places.types',{
  textQuery:queryForCity(query,city),languageCode:'pl',regionCode:city.countryCode||'PL',
  locationBias:{circle:{center:{latitude:city.center.lat,longitude:city.center.lng},radius:Math.min(50000,city.radiusKm*1000)}}
 });
 const place=data?.places?.[0],loc=place?.location;
 if(!loc||!inCity(loc.latitude,loc.longitude,city))return null;
 return {status:'ok',provider:'google',placeId:place.id||'',location:{lat:loc.latitude,lng:loc.longitude},name:place.displayName?.text||'',address:place.formattedAddress||'',types:place.types||[]};
}

function photonAddress(p={}){
 const first=[p.street,p.housenumber].filter(Boolean).join(' '),city=p.city||p.locality||p.district||'',parts=[first,p.postcode,city].filter(Boolean);
 return parts.join(', ');
}

async function photonFeatures(query,fetcher,baseUrl,city,{limit=5,restrict=false,timeoutMs=6500}={}){
 let endpoint;
 try{
  const base=new URL(baseUrl||DEFAULT_PHOTON);if(base.protocol!=='https:')return null;
  endpoint=new URL('/api/',base);
 }catch{return null;}
 endpoint.searchParams.set('q',restrict?query:queryForCity(query,city));
 endpoint.searchParams.set('lat',String(city.center.lat));
 endpoint.searchParams.set('lon',String(city.center.lng));
 if(restrict)endpoint.searchParams.set('bbox',bbox(city));
 endpoint.searchParams.set('limit',String(limit));
 // Photon accepts only default/en/de/fr; "pl" returns HTTP 400. "default" keeps local Polish names.
 endpoint.searchParams.set('lang','default');
 let r;
 try{
  r=await fetcher(endpoint.href,{headers:{'accept':'application/json','user-agent':'CityRoute/0.2','referer':'https://city-route-app.jakublojek.workers.dev/'},signal:AbortSignal.timeout(timeoutMs)});
 }catch{return null;}
 if(!r.ok)return null;
 const data=await r.json().catch(()=>null);
 return Array.isArray(data?.features)?data.features:[];
}

function photonPlace(feature,city){
 const coords=feature?.geometry?.coordinates,lat=Number(coords?.[1]),lng=Number(coords?.[0]);
 if(!inCity(lat,lng,city))return null;
 const p=feature.properties||{},address=photonAddress(p);
 return {provider:'photon-osm',location:{lat,lng},name:p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||address,address,district:p.district||p.locality||'',types:[p.osm_value,p.type].filter(Boolean),osmId:p.osm_type&&p.osm_id?`${p.osm_type}${p.osm_id}`:''};
}

async function photonSearch(query,fetcher,baseUrl,city){
 const features=await photonFeatures(query,fetcher,baseUrl,city);
 for(const feature of features||[]){const place=photonPlace(feature,city);if(place)return {status:'ok',...place};}
 return null;
}

export async function searchPlaceAddress(value,{googleKey='',photonUrl=DEFAULT_PHOTON,fetcher=fetch,city=WARSAW}={}){
 const query=normalizePlaceQuery(value);if(!query)return {status:'invalid-query'};
 const google=await googleSearch(query,googleKey,fetcher,city);if(google)return google;
 const photon=await photonSearch(query,fetcher,photonUrl,city);if(photon)return photon;
 return {status:'not-found'};
}

async function googleAutocomplete(query,key,fetcher,city,sessionToken,limit){
 const region=(city.countryCode||'PL').toLowerCase();
 const body={input:query,languageCode:'pl',regionCode:region,includedRegionCodes:[region],
  locationRestriction:{circle:{center:{latitude:city.center.lat,longitude:city.center.lng},radius:Math.min(50000,city.radiusKm*1000)}}};
 if(sessionToken)body.sessionToken=sessionToken;
 const data=await postJson(fetcher,'https://places.googleapis.com/v1/places:autocomplete',key,'',body);
 if(!data)return null;
 return (Array.isArray(data.suggestions)?data.suggestions:[]).map(s=>s.placePrediction).filter(p=>p?.placeId).slice(0,limit).map(p=>({
  id:'google:'+p.placeId,provider:'google',placeId:p.placeId,
  name:p.structuredFormat?.mainText?.text||p.text?.text||'',address:p.structuredFormat?.secondaryText?.text||'',types:p.types||[]
 }));
}

// Type-ahead suggestions. Google results carry only a placeId (coordinates come from placeDetails on selection,
// inside the same billing session); OSM results carry coordinates directly.
// googleFallback: optional budget check, asked only when Photon fails, so a Photon outage does not leave search empty.
export async function suggestPlaces(value,{city=WARSAW,googleKey='',googleAutocomplete:useGoogle=false,googleFallback=null,photonUrl=DEFAULT_PHOTON,fetcher=fetch,sessionToken='',limit=5}={}){
 const query=normalizePlaceQuery(value);if(!query)return {status:'invalid-query',suggestions:[]};
 if(useGoogle&&googleKey){
  const google=await googleAutocomplete(query,googleKey,fetcher,city,sessionToken,limit);
  if(google?.length)return {status:'ok',provider:'google',suggestions:google};
 }
 const canFallback=!useGoogle&&googleKey&&typeof googleFallback==='function';
 // With a fallback ready, give up on a slow Photon sooner so the person is not left waiting.
 const features=await photonFeatures(query,fetcher,photonUrl,city,{limit:limit+3,restrict:true,timeoutMs:canFallback?3500:6500});
 if(features===null){
  if(canFallback&&googleFallback()){
   const google=await googleAutocomplete(query,googleKey,fetcher,city,sessionToken,limit);
   if(google)return {status:google.length?'ok':'not-found',provider:'google',suggestions:google};
  }
  return {status:'unavailable',suggestions:[]};
 }
 const seen=new Set(),suggestions=[];
 for(const feature of features){
  const place=photonPlace(feature,city);if(!place)continue;
  // OSM often returns one place twice (node + building way): same name and address means same place.
  const key=fold(place.name)+'|'+fold(place.address);if(seen.has(key))continue;seen.add(key);
  suggestions.push({id:'osm:'+(place.osmId||key),...place});if(suggestions.length>=limit)break;
 }
 return {status:suggestions.length?'ok':'not-found',provider:'photon-osm',suggestions};
}

export async function placeDetails(placeId,{googleKey='',fetcher=fetch,sessionToken='',city=WARSAW}={}){
 const id=String(placeId||'');if(!/^[A-Za-z0-9_-]{10,300}$/.test(id))return {status:'invalid-id'};
 if(!googleKey)return {status:'no-key'};
 const u=new URL('https://places.googleapis.com/v1/places/'+id);u.searchParams.set('languageCode','pl');if(sessionToken)u.searchParams.set('sessionToken',sessionToken);
 let r;try{r=await fetcher(u.href,{headers:{'x-goog-api-key':googleKey,'x-goog-fieldmask':'id,displayName,formattedAddress,location,types,photos'},signal:AbortSignal.timeout(6500)});}catch{return {status:'unavailable'};}
 if(!r.ok)return {status:'unavailable'};
 const place=await r.json().catch(()=>null),loc=place?.location;
 if(!loc||!Number.isFinite(loc.latitude)||!Number.isFinite(loc.longitude))return {status:'no-coordinates'};
 if(!inCity(loc.latitude,loc.longitude,city))return {status:'outside-city',location:{lat:loc.latitude,lng:loc.longitude}};
 const photo=bestGooglePhoto(place.photos)?.photo,attr=photo?.authorAttributions?.[0];
 // Authors of the other photos ("Inne zdjęcie"), in the same order the photo proxy serves them. Same response, no extra call.
 const authorOf=p=>({authorName:p?.authorAttributions?.[0]?.displayName||'Google Maps',authorUri:p?.authorAttributions?.[0]?.uri||''});
 const more=[];for(let n=1;n<=MAX_GOOGLE_PHOTO_CHOICE;n++){const p=pickGooglePhoto(place.photos,n)?.photo;if(!p?.name)break;more.push(authorOf(p));}
 return {status:'ok',provider:'google',placeId:place.id||id,name:place.displayName?.text||'',address:place.formattedAddress||'',location:{lat:loc.latitude,lng:loc.longitude},types:place.types||[],
  photo:photo?{available:true,...authorOf(photo),more}:{available:false}};
}

// Streams the best-sized Google photo for display only. Never cached by City Route;
// the media request uses a fresh photo name, as required by Google Places terms.
export async function placePhotoById(placeId,{googleKey='',fetcher=fetch,photoChoice=0}={}){
 const id=String(placeId||'');if(!googleKey||!/^[A-Za-z0-9_-]{10,300}$/.test(id))return null;
 let r;try{r=await fetcher('https://places.googleapis.com/v1/places/'+id,{headers:{'x-goog-api-key':googleKey,'x-goog-fieldmask':'photos'},signal:AbortSignal.timeout(6500)});}catch{return null;}
 if(!r.ok)return null;
 const photo=pickGooglePhoto((await r.json().catch(()=>null))?.photos,photoChoice)?.photo;if(!photo?.name)return null;
 let media;try{media=await fetcher(`https://places.googleapis.com/v1/${photo.name}/media?key=${encodeURIComponent(googleKey)}&maxWidthPx=800`,{redirect:'follow',signal:AbortSignal.timeout(8000)});}catch{return null;}
 if(!media.ok)return null;
 const headers=new Headers();headers.set('content-type',media.headers.get('content-type')||'image/jpeg');headers.set('cache-control','private, no-store');
 return new Response(media.body,{status:200,headers});
}
