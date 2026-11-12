// PHOTO-LIBRARY-176: permanent, rights-cleared photo library for catalogue places.
//
// For every catalogue place without its own cover this resolves, once and offline:
//   OSM `wikidata` tag of the same element  ->  Wikidata P18 (the entity's main image)
//   ->  Wikimedia Commons file metadata  ->  licence / size / attribution gate (licensedCommonsImage).
// The result is written to data/photo-library/<city>.json and shipped with the app, so list rows and cards
// show a photo without any per-view provider lookup. Only free APIs are used (Supabase catalogue read,
// OpenStreetMap, Wikidata, Commons); no Google/Tripadvisor call is made and no provider photo is stored.
//
// Identity: the Wikidata id comes from the OSM element the catalogue row was imported from, the entity must not
// be a person, and its own coordinates (when present) must be near the place. Nothing is matched by similarity.
//
// A geotagged-Commons name match was tried as a second source and rejected: 7 hits in 650 places, one of them a
// neighbouring address. Venues without a Wikidata photo stay on the live provider path.
//
// Usage: node scripts/build-photo-library.mjs [--city lisbon] [--dry-run]
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../supabase-config.js';
import {licensedCommonsImage,distanceM} from '../commons-photo-source.js';

const UA='CityRoutePhotoLibrary/1.0 (static catalogue build script)';
const args=process.argv.slice(2),only=args.includes('--city')?args[args.indexOf('--city')+1]:null,dryRun=args.includes('--dry-run');
const MAX_ENTITY_DISTANCE_M=1500;
const NOT_A_PHOTO=/\b(?:logo|mapa|map|plan|schemat|icon|herb|coat of arms|locator|flag)\b|\.svg$/i;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Wikimedia adds tracking parameters to API thumbnail URLs; the bare URL is the stable one.
const clean=url=>String(url||'').split('?')[0];
const chunk=(list,n)=>Array.from({length:Math.ceil(list.length/n)},(_,i)=>list.slice(i*n,i*n+n));

// `required` calls throw after the retries: a provider hiccup must stop the build, never shrink the library.
async function getJson(url,init={},required=false){
 let last='';
 for(let attempt=0;attempt<5;attempt++){
  try{
   const r=await fetch(url,{...init,headers:{'user-agent':UA,accept:'application/json',...(init.headers||{})},signal:AbortSignal.timeout(20000)});
   if(r.ok)return await r.json();
   last='HTTP '+r.status;
   if(r.status!==429&&r.status<500&&!required)return null;
  }catch(error){last=error?.name||'network';}
  await sleep(2500*(attempt+1));
 }
 if(required)throw new Error('photo-library: no answer from '+new URL(url).hostname+' ('+last+')');
 return null;
}

async function cataloguePlaces(city){
 const rows=await getJson(`${SUPABASE_URL}/rest/v1/rpc/catalogue_places`,{method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({city_slug:city.slug||city.id})});
 if(Array.isArray(rows)&&rows.length)return rows.map(r=>({id:r.id,name:r.name,lat:Number(r.lat),lng:Number(r.lng),hasImage:!!r.image_url,metadata:r.metadata||{}}));
 const file=city.id==='warsaw'?'data/cities/warsaw/places.json':`data/cities/${city.id}/places.json`;
 const local=JSON.parse(await readFile(file,'utf8'));
 return (Array.isArray(local)?local:local.places||[]).map(p=>({id:p.id,name:p.name,lat:Number(p.lat),lng:Number(p.lng),hasImage:!!p.image,metadata:p.metadata||{}}));
}

const qidOf=value=>String(value||'').split(';').map(x=>x.trim()).find(x=>/^Q[1-9]\d*$/.test(x))||null;

// Curated rows keep only the OSM element reference; read its tags to recover the wikidata id.
async function osmWikidata(source){
 if(source?.provider!=='openstreetmap'||!['node','way','relation'].includes(source.type)||!Number.isSafeInteger(Number(source.id)))return null;
 const data=await getJson(`https://api.openstreetmap.org/api/0.6/${source.type}/${source.id}.json`);
 await sleep(250);
 return qidOf(data?.elements?.[0]?.tags?.wikidata);
}

async function wikidataEntities(qids){
 const out={};
 for(const part of chunk(qids,50)){
  const data=await getJson('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',ids:part.join('|'),props:'claims',format:'json',origin:'*'}),{},true);
  if(!data?.entities)throw new Error('photo-library: Wikidata returned no entities');
  for(const [id,entity] of Object.entries(data?.entities||{})){
   const claims=entity?.claims||{};
   const value=p=>claims[p]?.find(c=>c.rank!=='deprecated'&&c.mainsnak?.datavalue)?.mainsnak.datavalue.value;
   const coords=value('P625');
   out[id]={
    image:typeof value('P18')==='string'?value('P18'):null,
    coords:coords&&Number.isFinite(coords.latitude)?{lat:coords.latitude,lng:coords.longitude}:null,
    human:(claims.P31||[]).some(c=>c.mainsnak?.datavalue?.value?.id==='Q5')
   };
  }
  await sleep(1200);
 }
 return out;
}

async function commonsFiles(files,width){
 const out={};
 for(const part of chunk(files,25)){
  const data=await getJson('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',titles:part.map(f=>'File:'+f).join('|'),prop:'imageinfo',
   iiprop:'url|size|mime|extmetadata',iiurlwidth:String(width),iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist',iiextmetadatalanguage:'en',format:'json',formatversion:'2',origin:'*'}),{},true);
  if(!Array.isArray(data?.query?.pages))throw new Error('photo-library: Commons returned no pages');
  const back=new Map((data?.query?.normalized||[]).map(n=>[n.to,n.from]));
  for(const page of data?.query?.pages||[]){
   const asked=(back.get(page.title)||page.title).replace(/^File:/,'');
   out[asked]=page;
  }
  await sleep(1200);
 }
 return out;
}

export async function buildCityLibrary(city){
 const places=(await cataloguePlaces(city)).filter(p=>!p.hasImage&&p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));
 const skipped={'no-wikidata':0,'no-image':0,'person':0,'too-far':0,'not-a-photo':0,'licence-or-size':0};
 const linked=[];
 for(const p of places){
  const qid=qidOf(p.metadata?.osmTags?.wikidata)||(p.metadata?.osmTags?null:await osmWikidata(p.metadata?.source));
  if(qid)linked.push({...p,qid});else skipped['no-wikidata']++;
 }
 const entities=await wikidataEntities([...new Set(linked.map(p=>p.qid))]);
 const wanted=[];
 for(const p of linked){
  const e=entities[p.qid];
  if(!e?.image){skipped['no-image']++;continue;}
  if(e.human){skipped.person++;continue;}
  if(e.coords&&distanceM(p,e.coords)>MAX_ENTITY_DISTANCE_M){skipped['too-far']++;continue;}
  if(NOT_A_PHOTO.test(e.image)){skipped['not-a-photo']++;continue;}
  wanted.push({...p,file:e.image});
 }
 const files=[...new Set(wanted.map(p=>p.file))];
 const [large,small]=[await commonsFiles(files,960),await commonsFiles(files,330)];
 const photos={};
 for(const p of wanted){
  const page=large[p.file],image=page&&licensedCommonsImage(page,p);
  const thumb=small[p.file]&&licensedCommonsImage(small[p.file],p);
  if(!image){skipped['licence-or-size']++;continue;}
  photos[p.id]={name:p.name,lat:p.lat,lng:p.lng,image:clean(image.src),imageThumb:clean(thumb?.src||image.src),
   imageCredit:{author:image.author,license:image.license,licenseUrl:image.licenseUrl||null,source:image.source,via:'Wikimedia Commons'},
   match:'wikidata-p18',wikidata:p.qid,file:'File:'+p.file};
 }
 return {library:{version:1,city:city.id,source:'wikimedia-commons',photos:Object.fromEntries(Object.entries(photos).sort(([a],[b])=>a.localeCompare(b)))},
  report:{city:city.id,withoutCover:places.length,linkedToWikidata:linked.length,libraryPhotos:Object.keys(photos).length,skipped}};
}

if(import.meta.url===new URL('file://'+(process.argv[1]||'').replace(/\\/g,'/').replace(/^([A-Za-z]:)/,'/$1')).href){
 const cities=JSON.parse(await readFile('data/cities.json','utf8')).filter(c=>['launch','next'].includes(c.status)&&(!only||c.id===only));
 await mkdir('data/photo-library',{recursive:true});
 for(const city of cities){
  const {library,report}=await buildCityLibrary(city);
  console.log(JSON.stringify(report));
  if(!dryRun)await writeFile(`data/photo-library/${city.id}.json`,JSON.stringify(library,null,1)+'\n');
 }
}
