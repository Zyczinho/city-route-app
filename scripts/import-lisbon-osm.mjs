// #148 — bounded, provenance-preserving OpenStreetMap import for the Lisbon pilot.
// Download from Overpass only in an explicit one-time workflow, never at app runtime.
// © OpenStreetMap contributors; ODbL https://www.openstreetmap.org/copyright
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Shared category → food style mapping; a separate copy here once marked every café as a sit-down meal.
import {foodFor} from './city-curation.mjs';

const cityId='lisbon';
const city=JSON.parse(await readFile('data/cities.json','utf8')).find(x=>x.id===cityId);
if(!city)throw new Error('Lisbon city config missing; merge pilot #147 first');
const BBOX=[38.684,-9.235,38.803,-9.075]; // small, Lisbon-focused; not the whole 25 km operating radius
const bbox=BBOX.join(',');
const selectors=[
 'nwr["tourism"~"^(museum|gallery|viewpoint|attraction|hotel|hostel|guest_house)$"]('+bbox+');',
 'nwr["historic"~"^(castle|fort|monument|memorial|ruins|archaeological_site|city_gate)$"]('+bbox+');',
 'nwr["amenity"~"^(restaurant|cafe|bar|pub|nightclub|place_of_worship|arts_centre|theatre)$"]('+bbox+');',
 'nwr["leisure"~"^(park|garden|sports_centre|fitness_centre)$"]('+bbox+');'
];
const query='[out:json][timeout:100];('+selectors.join('')+');out center tags;';
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
let payload=null,sourceUrl='';
for(const endpoint of endpoints){
 try{
  const r=await fetch(endpoint,{
   method:'POST',
   headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'CityRoute/0.2 (Lisbon beta snapshot; ODbL attribution)','accept':'application/json'},
   body:new URLSearchParams({data:query}),
   signal:AbortSignal.timeout(130000)
  });
  if(!r.ok)throw new Error('HTTP '+r.status);
  const data=await r.json();
  if(!Array.isArray(data.elements)||data.elements.length<150)throw new Error('Unexpected low result count');
  payload=data;sourceUrl=endpoint;break;
 }catch(error){console.warn('Overpass endpoint unavailable:',endpoint,String(error.message||error));}
}
if(!payload)throw new Error('Could not fetch a valid OpenStreetMap result; no dataset generated');
const rawCount=payload.elements.length,osmTimestamp=payload.osm3s?.timestamp_osm_base||'unknown';
const CATEGORY_QUOTAS=[
 ['museum',18],['gallery',9],['viewpoint',13],['landmark',15],['religious_site',7],
 ['park',12],['garden',6],['restaurant',31],['cafe',23],['bar',14],
 ['pub',7],['club',8],['experience',8],['sport',5],['hotel',7],['hostel',5]
];
const possible=new Set(CATEGORY_QUOTAS.map(([x])=>x));
function classify(t){
 if(t.tourism==='museum')return 'museum';
 if(t.tourism==='gallery')return 'gallery';
 if(t.tourism==='viewpoint')return 'viewpoint';
 if(t.historic&&/^(castle|fort|monument|memorial|ruins|archaeological_site|city_gate)$/.test(t.historic))return 'landmark';
 if(t.amenity==='place_of_worship')return 'religious_site';
 if(t.leisure==='park')return 'park';
 if(t.leisure==='garden')return 'garden';
 if(t.amenity==='restaurant')return 'restaurant';
 if(t.amenity==='cafe')return 'cafe';
 if(t.amenity==='bar')return 'bar';
 if(t.amenity==='pub')return 'pub';
 if(t.amenity==='nightclub')return 'club';
 if(t.leisure==='sports_centre'||t.leisure==='fitness_centre')return 'sport';
 if(t.amenity==='arts_centre'||t.amenity==='theatre')return 'experience';
 if(t.tourism==='hotel')return 'hotel';
 if(t.tourism==='hostel'||t.tourism==='guest_house')return 'hostel';
 if(t.tourism==='attraction')return 'experience';
 return null;
}
const badBrands=/\b(starbucks|mcdonald'?s|kfc|burger king|pizza hut|domino'?s|taco bell|subway)\b/i;
const categoryTags={
 museum:['culture','museum'],gallery:['culture','art'],viewpoint:['views','sightseeing'],
 landmark:['culture','sightseeing'],religious_site:['culture','sightseeing'],
 park:['nature','walk'],garden:['nature','walk'],
 restaurant:['food'],cafe:['food','coffee'],bar:['nightlife'],pub:['nightlife'],
 club:['nightlife','music'],experience:['culture','experience'],sport:['sport'],hotel:['stay'],hostel:['stay']
};
const minutes={museum:70,gallery:40,viewpoint:15,landmark:20,religious_site:20,park:35,garden:30,restaurant:60,cafe:35,bar:60,pub:60,club:90,experience:50,sport:60,hotel:10,hostel:10};
const fold=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const distance=(a,b)=>{
 const rad=Math.PI/180,dy=(a.lat-b.lat)*rad,dx=(a.lng-b.lng)*rad;
 const t=Math.sin(dy/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dx/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(t)));
};
function elementPoint(e){
 const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon);
 return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
function quality(t){
 return 1+Number(!!t.wikidata)*5+Number(!!t.wikipedia)*5+
  Number(!!(t.website||t['contact:website']))*3+
  Number(!!t.opening_hours)*2+Number(!!t['addr:street'])*2+
  Number(!!t['name:en'])+Number(!!t.image);
}
const found=new Map();
for(const e of payload.elements){
 const t=e.tags||{},cat=classify(t),pt=elementPoint(e),name=String(t.name||'').trim();
 if(!cat||!possible.has(cat)||!pt||name.length<3||name.length>120||badBrands.test(name))continue;
 if(t.access==='private'||t.disused==='yes'||t.abandoned==='yes'||t.demolished==='yes'||t.construction==='yes')continue;
 if(distance(pt,city.center)>city.radiusKm)continue;
 if(!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id))continue;
 const key=e.type+'/'+e.id,area=String(t['addr:suburb']||t['addr:district']||t['is_in:suburb']||t['addr:quarter']||'').trim();
 const info={
  id:'osm-'+e.type+'-'+e.id,
  name,lat:pt.lat,lng:pt.lng,categoryId:cat,area,
  description:'',minutes:minutes[cat]||30,
  cost:0,tourist:'balanced',foodStyle:foodFor(cat),
  partner:false,top:false,tags:categoryTags[cat]||[],ratings:[],
  metadata:{
   source:{provider:'openstreetmap',type:e.type,id:e.id,url:'https://www.openstreetmap.org/'+key},
   osmTags:{
    wikidata:t.wikidata||null,wikipedia:t.wikipedia||null,opening_hours:t.opening_hours||null,
    cuisine:t.cuisine||null,website:t.website||t['contact:website']||null
   },
   costUnknown:true,sourceSnapshot:osmTimestamp
  }
 };
 if(t.website||t['contact:website'])info.website=String(t.website||t['contact:website']);
 found.set(key,{place:info,score:quality(t)});
}
const pool=[...found.values()].sort((a,b)=>b.score-a.score||a.place.name.localeCompare(b.place.name,'pt')||a.place.id.localeCompare(b.place.id));
const picked=[],ids=new Set();
function include(x){
 const p=x.place;
 if(ids.has(p.id))return false;
 if(picked.some(v=>{
  const d=distance(p,v);
  return d<0.03 || (d<0.25&&fold(p.name)===fold(v.name));
 }))return false;
 picked.push(p);ids.add(p.id);return true;
}
for(const [cat,max] of CATEGORY_QUOTAS){
 let added=0;
 for(const x of pool)if(x.place.categoryId===cat&&added<max&&include(x))added++;
}
const TARGET=160;
for(const x of pool){if(picked.length>=TARGET)break;include(x);}
if(picked.length<100||picked.length>200)throw new Error('Import size out of pilot bounds: '+picked.length);
const counts=Object.fromEntries(CATEGORY_QUOTAS.map(([cat])=>[cat,picked.filter(p=>p.categoryId===cat).length]));
if(Object.values(counts).filter(n=>n>=3).length<6)throw new Error('Too few populated categories');
picked.sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.name.localeCompare(b.name,'pt')||a.id.localeCompare(b.id));
const rawDigest=createHash('sha256').update(JSON.stringify(payload.elements)).digest('hex');
const dataPath='data/cities/lisbon/places.json';
await writeFile(dataPath,JSON.stringify(picked,null,2)+'\n');
const report={
 cityId,licence:'ODbL-1.0',attribution:'© OpenStreetMap contributors',
 licenceUrl:'https://www.openstreetmap.org/copyright',
 importSource:sourceUrl,osmDatasetTimestamp:osmTimestamp,
 rawRecords:rawCount,rawSha256:rawDigest,
 bbox:{south:BBOX[0],west:BBOX[1],north:BBOX[2],east:BBOX[3]},
 selection:'150–180 geographically filtered named POIs, category quotas, score and dedup; not a quality ranking',
 selected:picked.length,categoryCounts:counts,
 noRatings:true,noPhotos:true,noEditorialRoutes:true,
 generatedAt:new Date().toISOString()
};
await writeFile('data/cities/lisbon/import-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Lisbon OSM snapshot:',JSON.stringify({raw:rawCount,selected:picked.length,categoryCounts:counts,endpoint:sourceUrl,osmTimestamp},null,2));
