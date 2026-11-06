import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {applyCuration,categoryCounts,minutesFor,foodFor} from './city-curation.mjs';

const cityId=process.argv[2];
if(!cityId)throw new Error('Usage: node scripts/generate-osm-city-dataset.mjs <city-id>');
const base=`data/cities/${cityId}`;
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [config,anchors,taxonomy,cities,curation]=await Promise.all([
  read(`${base}/source-config.json`),read(`${base}/anchors.json`).catch(()=>[]),read('data/taxonomy.json'),read('data/cities.json'),read(`${base}/curation.json`).catch(()=>({}))
]);
// Optional quality settings (all off by default, so the Kraków snapshot regenerates unchanged):
//   overpassQuery       custom Overpass body; {{bbox}} is replaced with the city bbox
//   excludeCatalogues   existing place files (name/lat/lng) the new records must not duplicate
//   excludePoints       extra existing places, e.g. staged seed records
//   skipChains          {brandTags:true,names:[...]} drops chain outlets
//   requireAnyTag       {categories:[...],tags:[...]} a record in these categories needs one of these OSM tags
//   requireWikidataFor  categories kept only when OSM links them to Wikidata
//   skipTags            {osmKey:regex} drops places that are not visits (offices, embassies, faculties, stations)
//   areaAdminLevel      OSM admin_level whose boundaries name the area (Warsaw districts = 9)
//   strictDedupe        same name within 120 m (identical name within 1 km), or any name within 25 m, against existing
//                       and chosen records; curation.json removals are skipped before selection so quotas backfill
const city=cities.find(c=>c.id===cityId);
if(!city)throw new Error(`Unknown city: ${cityId}`);
const validCategories=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
for(const a of anchors)if(!validCategories.has(a.categoryId))throw new Error(`Invalid anchor category ${a.id}: ${a.categoryId}`);

const [south,west,north,east]=config.bbox;
const bbox=`${south},${west},${north},${east}`;
const overpass=config.overpassQuery?config.overpassQuery.replaceAll('{{bbox}}',bbox):`[out:json][timeout:90];(
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
async function queryOverpass(body){
  let error=null;
  for(const endpoint of overpassEndpoints){
    try{
      const data=await fetchJson(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:body})},2);
      if(data?.elements)return data;
    }catch(e){error=e;await sleep(1000);}
  }
  throw error||new Error('All Overpass endpoints failed');
}
const overpassData=await queryOverpass(overpass);

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

// Area names from administrative boundaries. Ray casting over all outer-way segments
// does not need the ways assembled into rings: crossings are counted per segment.
let areaBoundaries=[];
if(config.areaAdminLevel){
  const data=await queryOverpass(`[out:json][timeout:90];rel["boundary"="administrative"]["admin_level"="${config.areaAdminLevel}"](${bbox});out geom;`);
  areaBoundaries=(data.elements||[]).filter(r=>r.tags?.name).map(r=>({
    name:r.tags.name,
    segments:(r.members||[]).filter(m=>m.role==='outer'&&Array.isArray(m.geometry)).flatMap(m=>m.geometry.slice(1).map((g,i)=>[m.geometry[i],g]))
  })).filter(b=>b.segments.length);
}
const insideBoundary=(p,b)=>{let inside=false;for(const [a,c] of b.segments){if((a.lat>p.lat)!==(c.lat>p.lat)&&p.lng<(c.lon-a.lon)*(p.lat-a.lat)/(c.lat-a.lat)+a.lon)inside=!inside;}return inside;};
const areaFor=(p,t)=>{
  const hit=areaBoundaries.find(b=>insideBoundary(p,b));
  if(hit)return hit.name;
  const tagged=t['addr:suburb']||t['addr:district']||t['addr:city']||'';
  return fold(tagged)===fold(city.name)?'':tagged;
};

const chainNames=(config.skipChains?.names||[]).map(fold);
const isChain=t=>!!config.skipChains&&((config.skipChains.brandTags&&(t.brand||t['brand:wikidata']))||chainNames.some(n=>(` ${fold(t.name)} `).includes(` ${n} `)));
const skipTagRules=Object.entries(config.skipTags||{}).map(([k,v])=>[k,new RegExp(v)]);
const passesQuality=(t,categoryId)=>{
  if(skipTagRules.some(([k,re])=>t[k]!=null&&re.test(String(t[k]))))return false;
  if(config.requireWikidataFor?.includes(categoryId)&&!t.wikidata)return false;
  const need=config.requireAnyTag;
  if(need?.categories?.includes(categoryId)&&!need.tags.some(k=>t[k]))return false;
  return true;
};
const skipped={chain:0,quality:0,existing:0,nearby:0};

const raw=[];
for(const e of overpassData.elements||[]){
  const t=e.tags||{},name=t['name:pl']||t.name;if(!name)continue;
  const p=point(e);if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng))continue;
  const categoryId=categoryFor(t);if(!categoryId||!validCategories.has(categoryId))continue;
  if(isChain(t)){skipped.chain++;continue;}
  if(!passesQuality(t,categoryId)){skipped.quality++;continue;}
  raw.push({
    id:null,name,lat:p.lat,lng:p.lng,categoryId,
    area:areaFor(p,t),
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

const existing=[...(config.excludePoints||[])];
for(const path of config.excludeCatalogues||[])existing.push(...await read(path));
for(const x of existing)if(!Number.isFinite(Number(x.lat))||!Number.isFinite(Number(x.lng)))throw new Error(`Excluded place without coordinates: ${x.id||x.name}`);
// Short OSM names ("Charlotte") match long listing names ("Charlotte. Chleb i Wino") when every word of the shorter is in the longer.
const words=v=>fold(v).split(' ').filter(w=>w.length>1);
const sameName=(a,b)=>{const x=words(a),y=words(b);if(!x.length||!y.length)return false;const [s,l]=x.length<=y.length?[x,new Set(y)]:[y,new Set(x)];return s.every(w=>l.has(w));};
// Parks and palaces are large, so their OSM centre can sit far from the catalogue pin: an identical name within 1 km is the same place.
const duplicateOf=(p,list)=>list.find(x=>{const d=hav(x,p);return d<0.025||(d<0.12&&sameName(x.name,p.name))||(d<1&&fold(x.name)===fold(p.name));});
const removedRefs=new Set((curation.removed||[]).map(r=>r.source).filter(Boolean));
const osmRef=p=>p.metadata?.source?.type?`${p.metadata.source.type}/${p.metadata.source.id}`:null;

const chosen=[];const counts={};const anchorNames=new Set(anchorPlaces.map(a=>fold(a.name)));
for(const a of anchorPlaces){chosen.push(a);counts[a.categoryId]=(counts[a.categoryId]||0)+1;}
for(const p of candidates.sort((a,b)=>b._score-a._score)){
  if(chosen.length>=config.targetCount)break;
  if(anchorNames.has(fold(p.name)))continue;
  const cap=config.quotas[p.categoryId]??0;if(!cap)continue;
  if((counts[p.categoryId]||0)>=cap)continue;
  if(chosen.some(x=>hav(x,p)<0.03&&fold(x.name)===fold(p.name)))continue;
  if(config.strictDedupe){
    if(removedRefs.has(osmRef(p)))continue;
    if(duplicateOf(p,existing)){skipped.existing++;continue;}
    if(duplicateOf(p,chosen)){skipped.nearby++;continue;}
  }
  chosen.push(p);counts[p.categoryId]=(counts[p.categoryId]||0)+1;
}

const used=new Set(existing.map(x=>x.id).filter(Boolean));
for(const p of chosen){
  if(!p.id){let id=slugify(p.name),n=2;while(used.has(id))id=`${slugify(p.name)}-${n++}`;p.id=id;}
  if(used.has(p.id))throw new Error(`Duplicate generated id: ${p.id}`);used.add(p.id);
  delete p._score;
}
const curated=applyCuration(chosen,anchors,curation,{validCategories});
if(curated.length<Math.min(150,config.targetCount))throw new Error(`Dataset too small: ${curated.length}`);

await mkdir(base,{recursive:true});
await writeFile(`${base}/places.json`,JSON.stringify(curated,null,2)+'\n');
const report={cityId,count:curated.length,generatedAt:new Date().toISOString(),counts:categoryCounts(curated),source:'OpenStreetMap/Overpass + curated anchors'};
if(config.strictDedupe||config.skipChains||config.requireAnyTag||config.requireWikidataFor)report.skipped=skipped;
if(config.areaAdminLevel)report.areaBoundaries=areaBoundaries.length;
await writeFile(`${base}/dataset-report.json`,JSON.stringify(report,null,2)+'\n');
console.log(`Generated ${curated.length} places for ${city.name}.`,config.strictDedupe?skipped:'');
console.log(categoryCounts(curated));
