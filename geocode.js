const WARSAW={lat:52.2297,lng:21.0122};
const DEFAULT_PHOTON='https://photon.komoot.io';

export function normalizePlaceQuery(value){
 const q=String(value||'').replace(/\s+/g,' ').trim();
 if(q.length<3||q.length>220)return '';
 return q;
}

function kmFromWarsaw(lat,lng){
 const toRad=x=>x*Math.PI/180,R=6371,dLat=toRad(lat-WARSAW.lat),dLng=toRad(lng-WARSAW.lng);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(WARSAW.lat))*Math.cos(toRad(lat))*Math.sin(dLng/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}

const queryForWarsaw=q=>/warszaw|warsaw/i.test(q)?q:`${q}, Warszawa, Polska`;

async function googleSearch(query,key,fetcher){
 if(!key)return null;
 const body={
  textQuery:queryForWarsaw(query),
  languageCode:'pl',
  regionCode:'PL',
  locationBias:{circle:{center:{latitude:WARSAW.lat,longitude:WARSAW.lng},radius:40000}}
 };
 let r;
 try{
  r=await fetcher('https://places.googleapis.com/v1/places:searchText',{
   method:'POST',
   headers:{'content-type':'application/json','x-goog-api-key':key,'x-goog-fieldmask':'places.id,places.displayName,places.formattedAddress,places.location,places.types'},
   body:JSON.stringify(body),
   signal:AbortSignal.timeout(6500)
  });
 }catch{return null;}
 if(!r.ok)return null;
 const data=await r.json().catch(()=>null),place=data?.places?.[0],loc=place?.location;
 if(!loc||!Number.isFinite(loc.latitude)||!Number.isFinite(loc.longitude)||kmFromWarsaw(loc.latitude,loc.longitude)>40)return null;
 return {status:'ok',provider:'google',location:{lat:loc.latitude,lng:loc.longitude},name:place.displayName?.text||'',address:place.formattedAddress||'',types:place.types||[]};
}

function photonAddress(p={}){
 const first=[p.street,p.housenumber].filter(Boolean).join(' '),city=p.city||p.locality||p.district||'',parts=[first,p.postcode,city].filter(Boolean);
 return parts.join(', ');
}

async function photonSearch(query,fetcher,baseUrl){
 let endpoint;
 try{
  const base=new URL(baseUrl||DEFAULT_PHOTON);if(base.protocol!=='https:')return null;
  endpoint=new URL('/api/',base);
 }catch{return null;}
 endpoint.searchParams.set('q',queryForWarsaw(query));
 endpoint.searchParams.set('lat',String(WARSAW.lat));
 endpoint.searchParams.set('lon',String(WARSAW.lng));
 endpoint.searchParams.set('limit','5');
 endpoint.searchParams.set('lang','pl');
 let r;
 try{
  r=await fetcher(endpoint.href,{headers:{'accept':'application/json','user-agent':'CityRoute-Warsaw/0.1','referer':'https://city-route-app.jakublojek.workers.dev/'},signal:AbortSignal.timeout(6500)});
 }catch{return null;}
 if(!r.ok)return null;
 const data=await r.json().catch(()=>null),features=Array.isArray(data?.features)?data.features:[];
 for(const feature of features){
  const coords=feature?.geometry?.coordinates,lat=Number(coords?.[1]),lng=Number(coords?.[0]);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||kmFromWarsaw(lat,lng)>40)continue;
  const p=feature.properties||{};
  return {status:'ok',provider:'photon-osm',location:{lat,lng},name:p.name||'',address:photonAddress(p),types:[p.osm_value,p.type].filter(Boolean)};
 }
 return null;
}

export async function searchPlaceAddress(value,{googleKey='',photonUrl=DEFAULT_PHOTON,fetcher=fetch}={}){
 const query=normalizePlaceQuery(value);if(!query)return {status:'invalid-query'};
 const google=await googleSearch(query,googleKey,fetcher);if(google)return google;
 const photon=await photonSearch(query,fetcher,photonUrl);if(photon)return photon;
 return {status:'not-found'};
}
