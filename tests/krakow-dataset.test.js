import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distance,summary} from '../core.js';
import {applyCuration} from '../scripts/city-curation.mjs';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const base='data/cities/krakow';
const load=async()=>{
  const [places,routes,anchors,config,taxonomy,cities,curation,enrichment]=await Promise.all([
    read(`${base}/places.json`),read(`${base}/routes.json`),read(`${base}/anchors.json`),read(`${base}/source-config.json`),
    read('data/taxonomy.json'),read('data/cities.json'),read(`${base}/curation.json`),read(`${base}/enrichment-report.json`)
  ]);
  return {places,routes,anchors,config,taxonomy,cities,curation,enrichment,byId:new Map(places.map(p=>[p.id,p]))};
};
const groups={
  sightseeing:new Set(['landmark','museum','gallery','architecture','religious_site','viewpoint','neighborhood','hidden_gem']),
  nature:new Set(['park','garden','waterfront','beach','walk']),
  food:new Set(['restaurant','cafe','breakfast','street_food','food_hall','bakery','dessert']),
  nightlife:new Set(['bar','pub','cocktail_bar','wine_bar','club','live_music']),
  stay:new Set(['hotel','hostel','apartment','guesthouse'])
};
const PLANNER_TAGS=['sightseeing','culture','nature','views','food','hidden','nightlife'];
const GENERIC_AREAS=new Set(['kraków','krakow','krakow, poland','małopolskie','polska']);
const fold=v=>String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const sourceRef=s=>s?.type&&s?.id!=null?`${s.type}/${s.id}`:null;
const isPriority=(p,routes)=>p.top||routes.some(r=>r.stops.includes(p.id));

test('Krakow dataset is broad, balanced and route-complete',async()=>{
  const {places,routes,anchors,config,taxonomy,byId}=await load();
  assert.ok(places.length>=150,`expected at least 150 Krakow places, got ${places.length}`);
  assert.ok(places.length<=Math.max(280,config.targetCount+60),`unexpectedly large dataset: ${places.length}`);
  assert.ok(routes.length>=12,`expected at least 12 editorial routes, got ${routes.length}`);
  assert.equal(byId.size,places.length,'place IDs must be unique');
  const valid=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
  for(const p of places){
    assert.ok(valid.has(p.categoryId),`invalid category ${p.id}: ${p.categoryId}`);
    assert.ok(Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)),`invalid coordinates: ${p.id}`);
    assert.equal(p.cityId??'krakow','krakow');
  }
  for(const a of anchors)assert.ok(byId.has(a.id),`missing curated anchor ${a.id}`);
  for(const r of routes){
    assert.ok(r.stops.length>=3,`route ${r.id} is too short`);
    for(const stop of r.stops)assert.ok(byId.has(stop),`route ${r.id} references missing ${stop}`);
  }
  const count=g=>places.filter(p=>groups[g].has(p.categoryId)).length;
  assert.ok(count('sightseeing')>=35,`too few sightseeing POIs: ${count('sightseeing')}`);
  assert.ok(count('food')>=35,`too few food POIs: ${count('food')}`);
  assert.ok(count('nightlife')>=10,`too few nightlife POIs: ${count('nightlife')}`);
  assert.ok(count('stay')>=10,`too few stay POIs: ${count('stay')}`);
});

test('Krakow catalogue has no duplicate venues',async()=>{
  const {places}=await load();
  const refs=new Map();
  for(const p of places){
    const ref=sourceRef(p.metadata?.source);if(!ref)continue;
    assert.ok(!refs.has(ref),`${p.id} and ${refs.get(ref)} are the same OSM object ${ref}`);
    refs.set(ref,p.id);
  }
  for(let i=0;i<places.length;i++)for(let j=i+1;j<places.length;j++){
    const a=places[i],b=places[j];
    if(fold(a.name)===fold(b.name)&&distance(a,b)<0.15)assert.fail(`${a.id} and ${b.id} look like the same venue`);
  }
});

test('Krakow coordinates stay inside the configured city area',async()=>{
  const {places,config,cities}=await load();
  const city=cities.find(c=>c.id==='krakow');
  const [south,west,north,east]=config.bbox;
  for(const p of places){
    assert.ok(distance(city.center,p)<=city.radiusKm,`${p.id} is outside the Krakow radius`);
    assert.ok(p.lat>=south&&p.lat<=north&&p.lng>=west&&p.lng<=east,`${p.id} is outside the source bbox`);
  }
});

test('Curated anchors are complete, plausible and mirrored in the catalogue',async()=>{
  const {anchors,byId}=await load();
  assert.equal(new Set(anchors.map(a=>a.id)).size,anchors.length,'anchor IDs must be unique');
  for(const a of anchors){
    const p=byId.get(a.id);
    assert.ok(p?.metadata?.curated,`${a.id} must be a curated catalogue record`);
    for(const k of ['name','categoryId','area','description','tags'])assert.deepEqual(p[k],a[k],`${a.id}.${k} differs from anchors.json; run scripts/apply-city-curation.mjs krakow`);
    assert.equal(p.top,!!a.top,`${a.id}.top differs from anchors.json`);
    assert.ok(a.description.length>=40&&a.description.length<=220,`${a.id} needs a short, useful description`);
    assert.ok(a.area&&!GENERIC_AREAS.has(a.area.toLowerCase())&&!a.area.includes('/'),`${a.id} needs one traveller-facing area`);
    assert.ok(a.tags.length>=(groups.stay.has(a.categoryId)?1:2)&&a.tags.length<=6,`${a.id} should have a few strong tags`);
    if(a.lat!=null||a.osm)assert.ok(Number.isFinite(a.lat)&&Number.isFinite(a.lng),`${a.id} curated coordinates are incomplete`);
  }
});

test('High-priority Krakow places have descriptions and real areas',async()=>{
  const {places,routes}=await load();
  for(const p of places.filter(p=>isPriority(p,routes))){
    assert.ok(String(p.description||'').length>=40,`${p.id} is a top place or route stop without a description`);
    assert.ok(p.area&&!GENERIC_AREAS.has(p.area.toLowerCase()),`${p.id} is a top place or route stop without a useful area`);
  }
  for(const p of places)assert.ok(!GENERIC_AREAS.has(String(p.area||'').toLowerCase()),`${p.id} uses a city-wide area`);
});

test('Krakow tags are concise and support the planner',async()=>{
  const {places}=await load();
  const areaSlugs=new Set(places.map(p=>fold(p.area)).filter(Boolean));areaSlugs.delete('nowa-huta');
  for(const p of places){
    assert.ok(p.tags.length>=1&&p.tags.length<=6,`${p.id} has ${p.tags.length} tags`);
    assert.equal(new Set(p.tags).size,p.tags.length,`${p.id} has duplicate tags`);
    for(const t of p.tags){
      assert.match(t,/^[a-z0-9]+(-[a-z0-9]+)*$/,`${p.id} has a malformed tag ${t}`);
      assert.ok(!areaSlugs.has(t),`${p.id} uses area ${t} as a tag; use the area field`);
      assert.notEqual(t,p.categoryId,`${p.id} repeats its category as a tag`);
    }
    if(!groups.stay.has(p.categoryId))assert.ok(p.tags.some(t=>PLANNER_TAGS.includes(t)),`${p.id} has no tag the planner can match`);
  }
});

test('Krakow category diversity covers traveller intents',async()=>{
  const {places}=await load();
  const distinct=g=>new Set(places.filter(p=>groups[g].has(p.categoryId)).map(p=>p.categoryId)).size;
  assert.ok(distinct('sightseeing')>=6,'sightseeing categories are too uniform');
  assert.ok(distinct('food')>=5,'food categories are too uniform');
  assert.ok(distinct('nightlife')>=5,'nightlife categories are too uniform');
  assert.ok(distinct('nature')>=2,'nature categories are too uniform');
  assert.ok(distinct('stay')>=3,'stay categories are too uniform');
  const count=c=>places.filter(p=>p.categoryId===c).length;
  for(const [c,min] of [['architecture',5],['neighborhood',2],['cocktail_bar',2],['live_music',2],['viewpoint',3]])assert.ok(count(c)>=min,`expected at least ${min} ${c} places`);
});

test('Krakow editorial routes are coherent and walkable',async()=>{
  const {routes,byId}=await load();
  const length=s=>s.slice(1).reduce((n,p,i)=>n+distance(s[i],p),0);
  const perms=a=>a.length<=1?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(r=>[x,...r]));
  assert.equal(new Set(routes.map(r=>r.id)).size,routes.length,'route IDs must be unique');
  for(const r of routes){
    assert.ok(['walking','bike','transit','mix'].includes(r.transport),`${r.id} has unknown transport`);
    assert.equal(new Set(r.stops).size,r.stops.length,`${r.id} repeats a stop`);
    assert.ok(r.stops.length<=8,`${r.id} is unnecessarily long`);
    const stops=r.stops.map(id=>byId.get(id));
    const legs=stops.slice(1).map((p,i)=>distance(stops[i],p));
    if(r.transport==='walking'){
      assert.ok(Math.max(...legs)<=2,`${r.id} has a walking leg over 2 km`);
      assert.ok(length(stops)<=5,`${r.id} is too long to walk`);
    }else assert.ok(Math.max(...legs)<=6,`${r.id} has a leg over 6 km`);
    const best=Math.min(...perms(stops.slice(1)).map(rest=>length([stops[0],...rest])));
    assert.ok(length(stops)<=best*1.25+0.05,`${r.id} stop order zig-zags (${length(stops).toFixed(2)} km vs ${best.toFixed(2)} km)`);
  }
  const short=routes.find(r=>r.id==='krakow-2h');
  if(short)assert.ok(summary(short.stops.map(id=>byId.get(id)),short.transport).minutes<=135,'Krakow in 2 hours takes far longer than 2 hours');
});

test('Krakow editorial routes cover the main traveller themes',async()=>{
  const {routes,byId}=await load();
  const stopsOf=r=>r.stops.map(id=>byId.get(id));
  const has=(label,pred)=>assert.ok(routes.some(r=>pred(stopsOf(r))),`no editorial route covers ${label}`);
  const tagged=(t,n)=>s=>s.filter(p=>p.tags.includes(t)).length>=n;
  const inArea=(a,n)=>s=>s.filter(p=>p.area===a).length>=n;
  has('first-time classics',tagged('classic',5));
  has('Kazimierz',inArea('Kazimierz',4));
  has('Jewish heritage',tagged('jewish-heritage',4));
  has('Podgórze',inArea('Podgórze',3));
  has('museums',s=>s.every(p=>p.categoryId==='museum'));
  has('art',tagged('art',4));
  has('green Krakow',tagged('nature',3));
  has('viewpoints',tagged('views',3));
  has('nightlife',tagged('nightlife',3));
  has('budget food',s=>s.filter(p=>p.tags.includes('budget')&&p.tags.includes('food')).length>=3);
  has('student Krakow',tagged('student',2));
  has('Nowa Huta',tagged('nowa-huta',4));
  has('a rainy day',s=>s.every(p=>p.tags.includes('rainy-day')));
});

test('Krakow curation layer is documented and reproducible',async()=>{
  const {places,anchors,curation,taxonomy,byId}=await load();
  // A removed duplicate may share its OSM object with the curated anchor that replaces it.
  const refs=new Set(places.filter(p=>!p.metadata?.curated).map(p=>sourceRef(p.metadata?.source)));
  for(const r of curation.removed){
    assert.ok(r.id&&r.name&&r.source&&r.reason,`removal ${r.id} must record id, name, OSM source and reason`);
    assert.ok(['duplicate','irrelevant','closed','outside-travel-area'].includes(r.kind),`removal ${r.id} has unknown kind ${r.kind}`);
    assert.ok(!byId.has(r.id)&&!refs.has(r.source),`removed record ${r.id} is still in the catalogue`);
    if(r.kind==='duplicate')assert.ok(byId.has(r.duplicateOf),`duplicate ${r.id} must point at the record it duplicates`);
  }
  const anchorIds=new Set(anchors.map(a=>a.id));
  for(const id of Object.keys(curation.overrides)){
    assert.ok(byId.has(id),`override ${id} does not match a place`);
    assert.ok(!anchorIds.has(id),`override ${id} targets a curated anchor`);
  }
  const validCategories=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
  const again=applyCuration(places,anchors,curation,{validCategories,strict:true});
  assert.deepEqual(again,places,'places.json is out of date with anchors.json/curation.json; run scripts/apply-city-curation.mjs krakow');
});

test('Krakow keeps OpenStreetMap provenance',async()=>{
  const {places}=await load();
  const osmUrl=/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/;
  for(const p of places){
    const s=p.metadata?.source;
    assert.ok(s?.provider,`${p.id} lost its source metadata`);
    if(!p.metadata.curated){
      assert.equal(s.provider,'openstreetmap',`${p.id} must stay attributed to OpenStreetMap`);
      assert.match(s.url,osmUrl,`${p.id} has no OSM source URL`);
    }else{
      assert.ok(['openstreetmap','nominatim-openstreetmap','curated-coordinates'].includes(s.provider),`${p.id} has unknown provider ${s.provider}`);
      if(s.provider!=='curated-coordinates')assert.match(s.url,osmUrl,`${p.id} has no OSM source URL`);
    }
  }
});

test('Krakow enrichment report lists the priority gaps',async()=>{
  const {places,routes,enrichment,byId}=await load();
  assert.equal(enrichment.summary.places,places.length,'enrichment report is stale; run scripts/generate-enrichment-report.mjs krakow');
  const listed=new Map(enrichment.priorityPlaces.map(p=>[p.id,p]));
  for(const p of enrichment.priorityPlaces){
    assert.ok(byId.has(p.id),`report lists unknown place ${p.id}`);
    assert.ok(['high','medium'].includes(p.priority)&&p.missing.length,`report entry ${p.id} is not actionable`);
    if(p.missing.includes('description'))assert.ok(String(byId.get(p.id).description||'').length<40,`${p.id} already has a description`);
    if(p.missing.includes('image'))assert.ok(!byId.get(p.id).image,`${p.id} already has an image`);
  }
  for(const p of places.filter(p=>isPriority(p,routes)&&!p.image))assert.equal(listed.get(p.id)?.priority,'high',`${p.id} should be a high-priority enrichment gap`);
});

test('Krakow remains data-driven rather than hardcoded into app runtime',async()=>{
  const app=await readFile('app.js','utf8');
  assert.doesNotMatch(app,/if\s*\([^\n)]*krakow/i);
  assert.doesNotMatch(app,/switch\s*\([^)]*\)[\s\S]{0,300}case\s+['"]krakow['"]/i);
});
