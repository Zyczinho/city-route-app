import {readFile} from 'node:fs/promises';

const cityId=process.argv[2]||'warsaw';
const base=cityId==='warsaw'?'data':`data/cities/${cityId}`;
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const [places,routes,taxonomy]=await Promise.all([
  readJson(`${base}/places.json`),
  readJson(`${base}/routes.json`),
  readJson('data/taxonomy.json')
]);

const configSource=await readFile('supabase-config.js','utf8');
const pick=name=>{
  const m=configSource.match(new RegExp(`export const ${name}='([^']+)'`));
  if(!m)throw new Error(`Missing ${name} in supabase-config.js`);
  return m[1];
};
const SUPABASE_URL=pick('SUPABASE_URL');
const SUPABASE_KEY=pick('SUPABASE_PUBLISHABLE_KEY');

async function rpc(name,payload){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const text=await response.text();
  if(!response.ok)throw new Error(`${name} HTTP ${response.status}: ${text.slice(0,1000)}`);
  return text?JSON.parse(text):[];
}

const [livePlaces,liveRoutes]=await Promise.all([
  rpc('catalogue_places',{city_slug:cityId}),
  rpc('catalogue_routes',{city_slug:cityId})
]);

const aliases=taxonomy.legacyAliases||{};
const fail=[];
const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail.push(`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);};
const approx=(a,b,label)=>{if(Math.abs(Number(a)-Number(b))>1e-6)fail.push(`${label}: ${a} !== ${b}`);};
const sortStrings=v=>[...(v||[])].map(String).sort();
const nullableNumber=v=>v==null?null:Number(v);

if(livePlaces.length!==places.length)fail.push(`place count: live ${livePlaces.length}, json ${places.length}`);
if(liveRoutes.length!==routes.length)fail.push(`route count: live ${liveRoutes.length}, json ${routes.length}`);

const livePlaceById=new Map(livePlaces.map(p=>[p.id,p]));
for(const expected of places){
  const actual=livePlaceById.get(expected.id);
  if(!actual){fail.push(`missing place ${expected.id}`);continue;}
  eq(actual.name,expected.name,`${expected.id}.name`);
  approx(actual.lat,expected.lat,`${expected.id}.lat`);
  approx(actual.lng,expected.lng,`${expected.id}.lng`);
  const legacy=expected.categoryId||expected.cats?.[0];
  eq(actual.category_id,aliases[legacy]||legacy,`${expected.id}.category`);
  eq(sortStrings(actual.tags),sortStrings(expected.tags),`${expected.id}.tags`);
  const expectedRatings=[...(expected.ratings||[])].sort((a,b)=>a.source.localeCompare(b.source));
  const actualRatings=[...(actual.ratings||[])].sort((a,b)=>a.source.localeCompare(b.source));
  eq(actualRatings.map(r=>r.source),expectedRatings.map(r=>r.source),`${expected.id}.rating sources`);
  for(let i=0;i<Math.min(actualRatings.length,expectedRatings.length);i++){
    const a=actualRatings[i],e=expectedRatings[i],prefix=`${expected.id}.${e.source}`;
    eq(nullableNumber(a.value),nullableNumber(e.value),`${prefix}.value`);
    eq(nullableNumber(a.max),nullableNumber(e.max),`${prefix}.max`);
    eq(a.reviewCount??null,e.reviewCount??null,`${prefix}.reviewCount`);
    eq(a.listing??'',e.listing??'',`${prefix}.listing`);
    eq(a.url??null,e.url??null,`${prefix}.url`);
    eq(a.checked??null,e.checked??null,`${prefix}.checked`);
  }
}

const liveRouteById=new Map(liveRoutes.map(r=>[r.id,r]));
for(const expected of routes){
  const actual=liveRouteById.get(expected.id);
  if(!actual){fail.push(`missing route ${expected.id}`);continue;}
  eq(actual.name,expected.name,`${expected.id}.name`);
  eq(actual.description||'',expected.description||'',`${expected.id}.description`);
  eq(actual.transport||'walking',expected.transport||'walking',`${expected.id}.transport`);
  eq(sortStrings(actual.tags),sortStrings(expected.cats),`${expected.id}.tags`);
  eq(actual.stops||[],expected.stops||[],`${expected.id}.stops`);
  for(const stop of actual.stops||[])if(!livePlaceById.has(stop))fail.push(`${expected.id}: live stop ${stop} missing from live places`);
}

for(const p of livePlaces)if(!places.some(x=>x.id===p.id))fail.push(`unexpected live place ${p.id}`);
for(const r of liveRoutes)if(!routes.some(x=>x.id===r.id))fail.push(`unexpected live route ${r.id}`);

if(fail.length){
  console.error(`LIVE PARITY FAILED (${fail.length} mismatches)`);
  for(const item of fail.slice(0,100))console.error(`- ${item}`);
  if(fail.length>100)console.error(`...and ${fail.length-100} more`);
  process.exit(1);
}

console.log(`LIVE PARITY OK: ${livePlaces.length} ${cityId} places, ${liveRoutes.length} editorial routes.`);
