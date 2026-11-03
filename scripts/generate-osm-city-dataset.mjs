import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {applyCuration,categoryCounts,minutesFor,foodFor} from './city-curation.mjs';

const cityId=process.argv[2];
if(!cityId)throw new Error('Usage: node scripts/generate-osm-city-dataset.mjs <city-id>');
const base=`data/cities/${cityId}`;
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [config,anchors,taxonomy,cities,curation]=await Promise.all([
  read(`${base}/source-config.json`),read(`${base}/anchors.json`),read('data/taxonomy.json'),read('data/cities.json'),read(`${base}/curation.json`).catch(()=>({}))
]);
const city=cities.find(c=>c.id===cityId);
if(!city)throw new Error(`Unknown city: ${cityId}`);
const validCategories=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
for(const a of anchors)if(!validCategories.has(a.categoryId))throw new Error(`Invalid anchor category ${a.id}: ${a.categoryId}`);

const [south,west,north,east]=config.bbox;
const bbox=`${south},${west},${north},${east}`;
const overpass=`[out:json][timeout:90];(
  nwr["tourism"~"museum|gallery|attraction|viewpoint|hotel|hostel|guest_house|apartment"](${bbox});
  nwr["historic"](${bbox});
  nwr["amenity"~"restaurant|cafe|bar|pub|nightclub|fast_food|food_court|place_of_worship|arts_centre|music_venue"](${bbox});
  nwr["leisure"~"park|garden"](${bbox});
  nwr["shop"="bakery"](${bbox});
);out center tags;`;

const headers={'User-Agent':'CityRouteDataPipeline/0.1 (https://github.com/Zyczinho/city-route-app)'};
async function fetchJson(url,options={},attempts=3){
  let last;
  for(let i=0;i<attempts;i++){
    try{
      const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});
      if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
      return await r.json();
    }catch(e){last=e;if(i<attempts-1)await sleep(1500*(i+1));}
  }
  throw last;
}
const overpassEndpoints=[
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];
let overpassData=null,overpassError=null;
for(const endpoint of overpassEndpoints){
  try{
    overpassData=await fetchJson(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:overpass})},2);
    if(overpassData?.elements)break;
  }catch(error){overpassError=error;await sleep(1000);}
}
if(!overpassData?.elements)throw overpassError||new Error('All Overpass endpoints failed');

const polishMap={'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ż':'z','ź':'z'};
const fold=v=>String(v||'').toLowerCase().replace(/[ąćęłńóśżź]/g,c=>polishMap[c]).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const slugify=v=>fold(v).replace(/\s+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'place';
const hav=(a,b)=>{const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
const point=e=>e.lat!=null&&e.lon!=null?{lat:Number(e.lat),lng:Number(e.lon)}:e.center?{lat:Number(e.center.lat),lng:Number(e.center.lon)}:null;

function categoryFor(t={}){
  if(t.tourism==='museum')return 'museum';
  if(t.tourism==='gallery')return 'gallery';
  if(t.tourism==='viewpoint')return 'viewpoint';
  if(t.tourism==='hotel')return 'hotel';
  if(t.tourism==='hostel')return 'hostel';
  if(t.tourism==='guest_house')return 'guesthouse';
  if(t.tourism==='apartment')return 'apartment';
  if(t.amenity==='restaurant')return 'restaurant';
  if(t.amenity==='cafe')return 'cafe';
  if(t.amenity==='fast_food')return 'street_food';
  if(t.amenity==='food_court')return 'food_hall';
  if(t.shop==='bakery')return 'bakery';
  if(t.amenity==='bar')return /cocktail/i.test(`${t.name||''} ${t.description||''}`)?'cocktail_bar':'bar';
  if(t.amenity==='pub')return 'pub';
  if(t.amenity==='nightclub')return 'club';
  if(t.amenity==='music_venue')return 'live_music';
  if(t.amenity==='arts_centre')return 'gallery';
  if(t.amenity==='place_of_worship')return 'religious_site';
  if(t.leisure==='park')return 'park';
  if(t.leisure==='garden')return 'garden';
  if(t.historic==='church'||t.historic==='wayside_shrine')return 'religious_site';
  if(t.historic)return 'landmark';
  if(t.tourism==='attraction')return 'landmark';
  return null;
}
const tagsFor=(t,c)=>{
  const out=[];
  if(['restaurant','cafe','street_food','food_hall','bakery'].includes(c))out.push('food');
  if(['bar','pub','cocktail_bar','club','live_music'].includes(c))out.push('nightlife');
  if(['park','garden'].includes(c))out.push('nature');
  if(['museum','gallery'].includes(c))out.push('culture');
  if(['landmark','religious_site','viewpoint'].includes(c))out.push('sightseeing');
  if(['hotel','hostel','guesthouse','apartment'].includes(c))out.push('stay');
  if(t.cuisine)for(const x of String(t.cuisine).split(';').slice(0,3))out.push(slugify(x));
  return [...new Set(out.filter(Boolean))];
};
function scoreFor(t,p,c){
  let s=0;
  if(t.wikidata)s+=32;if(t.wikipedia)s+=24;if(t.website||t['contact:website'])s+=10;if(t.opening_hours)s+=5;if(t['addr:street'])s+=5;if(t.phone||t['contact:phone'])s+=3;if(t.brand)s+=4;
  if(['museum','gallery','viewpoint','landmark'].includes(c))s+=18;
  if(t.heritage||t['heritage:operator'])s+=14;if(t.historic)s+=12;if(t.tourism==='attraction')s+=9;
  const d=hav(city.center,p);s+=Math.max(0,14-Math.min(14,d));
  return s;
}

const raw=[];
for(const e of overpassData.elements||[]){
  const t=e.tags||{},name=t['name:pl']||t.name;if(!name)continue;
  const p=point(e);if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng))continue;
  const categoryId=categoryFor(t);if(!categoryId||!validCategories.has(categoryId))continue;
  raw.push({
    id:null,name,lat:p.lat,lng:p.lng,categoryId,
    area:t['addr:suburb']||t['addr:district']||t['addr:city']||'',
    description:'',minutes:minutesFor(categoryId),cost:0,tourist:'balanced',foodStyle:foodFor(categoryId),partner:false,top:false,
    tags:tagsFor(t,categoryId),ratings:[],
    website:t.website||t['contact:website']||null,
    metadata:{source:{provider:'openstreetmap',type:e.type,id:e.id,url:`https://www.openstreetmap.org/${e.type}/${e.id}`},osmTags:{wikidata:t.wikidata||null,wikipedia:t.wikipedia||null,opening_hours:t.opening_hours||null,cuisine:t.cuisine||null}},
    _score:scoreFor(t,p,categoryId)
  });
}

const byName=new Map();
for(const p of raw.sort((a,b)=>b._score-a._score)){
  const key=`${fold(p.name)}|${p.categoryId}`;
  const prev=byName.get(key);
  if(!prev||p._score>prev._score)byName.set(key,p);
}
const candidates=[...byName.values()];
const distancePenalty=p=>Math.min(0.45,hav(city.center,p)/80);

async function geocodeAnchor(anchor){
  if(Number.isFinite(Number(anchor.lat))&&Number.isFinite(Number(anchor.lng)))return {lat:Number(anchor.lat),lng:Number(anchor.lng),source:{provider:'curated-coordinates'}};
  const wanted=new Set(fold(anchor.name).split(' ').filter(x=>x.length>2));
  const ranked=candidates.map(p=>{
    const have=new Set(fold(p.name).split(' ').filter(x=>x.length>2));
    const overlap=[...wanted].filter(x=>have.has(x)).length;
    const similarity=overlap/Math.max(1,Math.min(wanted.size,have.size));
    const categoryBonus=p.categoryId===anchor.categoryId?0.35:0;
    return {p,rank:similarity+categoryBonus-distancePenalty(p)};
  }).filter(x=>x.rank>=0.7).sort((a,b)=>b.rank-a.rank);
  if(ranked[0])return {lat:ranked[0].p.lat,lng:ranked[0].p.lng,source:ranked[0].p.metadata.source};
  const addressOnly=String(anchor.query||'').replace(anchor.name,'').replace(/^\s*[,;-]?\s*|\s*[,;-]?\s*$/g,'').trim();
  const queries=[anchor.query,addressOnly&&`${addressOnly}, ${city.name}`,`${anchor.name}, ${city.name}, ${city.country}`];
  for(const query of [...new Set(queries.filter(Boolean))]){
    const params=new URLSearchParams({q:query,format:'jsonv2',limit:'3',countrycodes:city.countryCode.toLowerCase()});
    const result=await fetchJson(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    await sleep(1100);
    const inCity=(result||[]).map(r=>({r,d:hav(city.center,{lat:Number(r.lat),lng:Number(r.lon)})})).filter(x=>x.d<=city.radiusKm).sort((a,b)=>a.d-b.d)[0];
    if(inCity){const r=inCity.r;return {lat:Number(r.lat),lng:Number(r.lon),source:{provider:'nominatim-openstreetmap',osmType:r.osm_type||null,id:r.osm_id||null,url:r.osm_type&&r.osm_id?`https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`:null}};}
  }
  throw new Error(`Could not geocode anchor: ${anchor.id} (${anchor.query})`);
}

const anchorPlaces=[];
for(const a of anchors){
  const g=await geocodeAnchor(a);
  anchorPlaces.push({
    id:a.id,name:a.name,lat:g.lat,lng:g.lng,categoryId:a.categoryId,area:a.area||'',description:a.description||'',minutes:a.minutes||minutesFor(a.categoryId),cost:0,tourist:a.top?'must':'balanced',foodStyle:foodFor(a.categoryId),partner:false,top:!!a.top,tags:a.tags||[],ratings:[],metadata:{source:g.source,curated:true},_score:1000
  });
}

const chosen=[];const counts={};const anchorNames=new Set(anchorPlaces.map(a=>fold(a.name)));
for(const a of anchorPlaces){chosen.push(a);counts[a.categoryId]=(counts[a.categoryId]||0)+1;}
for(const p of candidates.sort((a,b)=>b._score-a._score)){
  if(chosen.length>=config.targetCount)break;
  if(anchorNames.has(fold(p.name)))continue;
  const cap=config.quotas[p.categoryId]??0;if(!cap)continue;
  if((counts[p.categoryId]||0)>=cap)continue;
  if(chosen.some(x=>hav(x,p)<0.03&&fold(x.name)===fold(p.name)))continue;
  chosen.push(p);counts[p.categoryId]=(counts[p.categoryId]||0)+1;
}

const used=new Set();
for(const p of chosen){
  if(!p.id){let id=slugify(p.name),n=2;while(used.has(id))id=`${slugify(p.name)}-${n++}`;p.id=id;}
  if(used.has(p.id))throw new Error(`Duplicate generated id: ${p.id}`);used.add(p.id);
  delete p._score;
}
const curated=applyCuration(chosen,anchors,curation,{validCategories});
if(curated.length<Math.min(150,config.targetCount))throw new Error(`Dataset too small: ${curated.length}`);

await mkdir(base,{recursive:true});
await writeFile(`${base}/places.json`,JSON.stringify(curated,null,2)+'\n');
await writeFile(`${base}/dataset-report.json`,JSON.stringify({cityId,count:curated.length,generatedAt:new Date().toISOString(),counts:categoryCounts(curated),source:'OpenStreetMap/Overpass + curated anchors'},null,2)+'\n');
console.log(`Generated ${curated.length} places for ${city.name}.`);
console.log(categoryCounts(curated));
