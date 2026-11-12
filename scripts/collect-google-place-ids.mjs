// GOOGLE-PLACE-IDS-176: store confirmed Google place ids permanently in data/google-place-ids/<city>.json.
//
// Reads the ids the production Worker has already confirmed (same name + position, see place-thumb.js) through
// GET /api/place-id, which only reads the Worker cache and never calls Google. Running this script costs nothing.
// Google allows keeping place_id indefinitely; photos and ratings are still fetched live and never stored.
//
// Entries with "source": "manual" are curator fixes for venues the automatic check rejects; find the id with
// Google's Place ID Finder and add { "name": "<exact catalogue name>", "googlePlaceId": "...", "source": "manual" }.
// The script never changes or removes a manual entry.
//
// The Worker cache is per Cloudflare location and fills as people browse, so later runs find more ids.
//
// Usage: node scripts/collect-google-place-ids.mjs [--city warsaw] [--base https://…] [--dry-run]
import {readFile,writeFile} from 'node:fs/promises';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../supabase-config.js';

const args=process.argv.slice(2),arg=n=>args.includes(n)?args[args.indexOf(n)+1]:null;
const only=arg('--city'),dryRun=args.includes('--dry-run');
const BASE=(arg('--base')||'https://city-route-app.jakublojek.workers.dev').replace(/\/$/,'');
const ID=/^[A-Za-z0-9_-]{10,300}$/;
const fold=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,' ').trim();

async function cataloguePlaces(city){
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalogue_places`,{method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({city_slug:city.slug||city.id})});
 const rows=r.ok?await r.json():null;
 if(!Array.isArray(rows)||!rows.length)throw new Error(`catalogue_places(${city.id}) returned no places`);
 return rows.map(x=>({id:x.id,name:x.name,lat:Number(x.lat),lng:Number(x.lng),googlePlaceId:x.metadata?.googlePlaceId||null}));
}

async function cachedId(place){
 const r=await fetch(`${BASE}/api/place-id?`+new URLSearchParams({name:place.name,lat:String(place.lat),lng:String(place.lng)}),{signal:AbortSignal.timeout(15000)});
 if(r.status===404)throw new Error(`${BASE} has no /api/place-id yet (deploy the Worker first)`);
 if(!r.ok)return null;
 const body=await r.json().catch(()=>null);
 return ID.test(String(body?.id||''))?body.id:null;
}

export function mergePlaceIds(existing,catalogue,found){
 const byId=new Map(catalogue.map(p=>[p.id,p])),out={},dropped=[];
 for(const [id,entry] of Object.entries(existing?.places||{})){
  const place=byId.get(id);
  if(entry?.source==='manual'){out[id]=entry;continue;}
  if(place&&fold(place.name)===fold(entry?.name)&&ID.test(String(entry?.googlePlaceId||'')))out[id]=entry;else dropped.push(id);
 }
 for(const [id,googlePlaceId] of Object.entries(found)){
  if(out[id]?.source==='manual'||!byId.has(id)||!ID.test(googlePlaceId))continue;
  out[id]={name:byId.get(id).name,googlePlaceId,source:'confirmed'};
 }
 return {places:Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b))),dropped};
}

if(import.meta.url===new URL('file://'+(process.argv[1]||'').replace(/\\/g,'/').replace(/^([A-Za-z]:)/,'/$1')).href){
 const cities=JSON.parse(await readFile('data/cities.json','utf8')).filter(c=>['launch','next'].includes(c.status)&&(!only||c.id===only));
 for(const city of cities){
  const file=`data/google-place-ids/${city.id}.json`;
  const existing=JSON.parse(await readFile(file,'utf8').catch(()=>'{"places":{}}'));
  const catalogue=await cataloguePlaces(city);
  const todo=catalogue.filter(p=>!p.googlePlaceId&&!existing.places?.[p.id]&&p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  const found={};let next=0;
  async function worker(){while(next<todo.length){const p=todo[next++];const id=await cachedId(p);if(id)found[p.id]=id;}}
  await Promise.all(Array.from({length:4},worker));
  const {places,dropped}=mergePlaceIds(existing,catalogue,found);
  const manual=Object.values(places).filter(e=>e.source==='manual').length;
  console.log(JSON.stringify({city:city.id,catalogue:catalogue.length,stored:Object.keys(places).length,newlyFound:Object.keys(found).length,manual,dropped,
   withoutId:catalogue.filter(p=>!p.googlePlaceId&&!places[p.id]).length}));
  if(!dryRun)await writeFile(file,JSON.stringify({version:1,city:city.id,places},null,1)+'\n');
 }
}
