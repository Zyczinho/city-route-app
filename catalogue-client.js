import {SUPABASE_URL} from './supabase-config.js';
import {distance,fold} from './core.js';
const LEGACY_CATEGORY={
 landmark:'zabytki',museum:'muzea',gallery:'muzea',architecture:'zabytki',religious_site:'zabytki',
 viewpoint:'widoki',neighborhood:'okolice',hidden_gem:'okolice',park:'zielen',garden:'zielen',waterfront:'widoki',beach:'widoki',walk:'zielen',
 restaurant:'jedzenie',cafe:'jedzenie',breakfast:'jedzenie',street_food:'jedzenie',food_hall:'jedzenie',bakery:'jedzenie',dessert:'jedzenie',
 bar:'nocne',pub:'nocne',cocktail_bar:'nocne',wine_bar:'nocne',club:'nocne',live_music:'nocne',
 sport:'aktywnosci',spa:'aktywnosci',workshop:'aktywnosci',experience:'aktywnosci',hotel:'noclegi',hostel:'noclegi',apartment:'noclegi',guesthouse:'noclegi'
};
const STAY=new Set(['hotel','hostel','apartment','guesthouse']);

export function placeFromCatalogue(row,cityId){
 const meta=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
 const imageMeta=row?.image_meta&&typeof row.image_meta==='object'?row.image_meta:{};
 const categoryId=row.category_id;
 return {
  ...meta,
  id:row.id,
  cityId,
  name:row.name,
  lat:Number(row.lat),
  lng:Number(row.lng),
  categoryId,
  cats:[LEGACY_CATEGORY[categoryId]||'okolice'],
  area:row.area||'',
  description:row.description||'',
  minutes:Number(row.minutes)||20,
  cost:(Number(row.cost_minor)||0)/100,
  currency:row.currency||'PLN',
  tourist:row.tourist_level||'balanced',
  foodStyle:row.food_style||'none',
  partner:!!row.partner,
  top:!!row.is_top,
  kind:meta.kind||(STAY.has(categoryId)?'hotel':'place'),
  image:row.image_url||(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(meta.communityImagePath||'')?SUPABASE_URL+'/storage/v1/object/public/city-route-place-photos/'+meta.communityImagePath:null),
  imageCaption:imageMeta.caption||'',
  imageCredit:imageMeta.credit||null,
  tags:Array.isArray(row.tags)?row.tags:[],
  ratings:Array.isArray(row.ratings)?row.ratings:[]
 };
}

export function routeFromCatalogue(row,cityId){
 const meta=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
 return {
  ...(meta.legacy&&typeof meta.legacy==='object'?meta.legacy:{}),
  id:row.id,
  cityId,
  name:row.name,
  description:row.description||'',
  transport:row.transport||'walking',
  cats:Array.isArray(row.tags)?row.tags:[],
  stops:Array.isArray(row.stops)?row.stops:[]
 };
}

export function createRestRpcClient({url,key,fetchImpl=globalThis.fetch}={}){
 if(!url||!key||typeof fetchImpl!=='function')throw new Error('catalogue-rest-config-missing');
 return {
  async rpc(name,args={}){
   try{
    const response=await fetchImpl(`${url}/rest/v1/rpc/${name}`,{
     method:'POST',
     headers:{apikey:key,'Content-Type':'application/json'},
     body:JSON.stringify(args)
    });
    const text=await response.text();
    if(!response.ok)return {data:null,error:new Error(`${name} HTTP ${response.status}: ${text.slice(0,300)}`)};
    return {data:text?JSON.parse(text):[],error:null};
   }catch(error){return {data:null,error};}
  }
 };
}

export async function loadSupabaseCatalogue(client,city){
 if(!client?.rpc)throw new Error('catalogue-client-missing');
 const citySlug=city?.slug||city?.id;
 if(!citySlug)throw new Error('catalogue-city-missing');
 const [{data:placeRows,error:placeError},{data:routeRows,error:routeError}]=await Promise.all([
  client.rpc('catalogue_places',{city_slug:citySlug}),
  client.rpc('catalogue_routes',{city_slug:citySlug})
 ]);
 if(placeError)throw placeError;
 if(routeError)throw routeError;
 const cityId=city.id||citySlug;
 return {
  source:'supabase',
  places:(placeRows||[]).map(row=>placeFromCatalogue(row,cityId)),
  routes:(routeRows||[]).map(row=>routeFromCatalogue(row,cityId))
 };
}

// Reuse already licensed editorial images for the exact same place in live Supabase.
// Never borrow a photo by category, similarity alone or a nearby venue.
export function mergeCuratedPhotos(livePlaces=[],curated=[]){
 const photos=curated.filter(p=>p?.image&&['Wikimedia Commons','Pexels'].includes(p.imageCredit?.via)&&
  Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)));
 const grouped=new Map();
 for(const p of photos){
  const name=fold(p.name||'');if(!name)continue;
  const previous=grouped.get(name)||[];previous.push(p);grouped.set(name,previous);
 }
 return livePlaces.map(p=>{
  if(p.image||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng)))return p;
  const matches=(grouped.get(fold(p.name||''))||[]).filter(c=>distance(p,c)<=.18);
  if(matches.length!==1)return p;
  const source=matches[0];
  return {...p,image:source.image,imageCaption:source.imageCaption||'',imageCredit:source.imageCredit};
 });
}

// PHOTO-LIBRARY-176: permanent Wikimedia Commons covers resolved offline by scripts/build-photo-library.mjs.
// An entry is used only for the same catalogue id with the same name at the same spot, and only with a full credit.
const WIKIMEDIA_PHOTO=/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//;
export function applyPhotoLibrary(places=[],library=null){
 const photos=library?.photos&&typeof library.photos==='object'?library.photos:null;
 if(!photos)return places;
 return places.map(p=>{
  const entry=p&&!p.image&&Object.hasOwn(photos,p.id)?photos[p.id]:null,credit=entry?.imageCredit;
  if(!entry||!WIKIMEDIA_PHOTO.test(entry.image||'')||!credit?.author||!credit?.license||!/^https:\/\/commons\.wikimedia\.org\//.test(credit.source||''))return p;
  if(fold(entry.name||'')!==fold(p.name||'')||![entry.lat,entry.lng,p.lat,p.lng].every(v=>Number.isFinite(Number(v)))||distance(p,entry)>.18)return p;
  return {...p,image:entry.image,imageThumb:WIKIMEDIA_PHOTO.test(entry.imageThumb||'')?entry.imageThumb:entry.image,imageCaption:'',
   imageCredit:{author:credit.author,license:credit.license,licenseUrl:credit.licenseUrl||null,source:credit.source,via:'Wikimedia Commons'},imageFromLibrary:true};
 });
}

export async function loadCatalogueWithFallback({client,city,fallback,photoLibrary=null}){
 try{
  const result=await loadSupabaseCatalogue(client,city);
  const curated=typeof fallback==='function'?null:fallback;
  return {...result,places:applyPhotoLibrary(mergeCuratedPhotos(result.places,curated?.places||[]),photoLibrary)};
 }
 catch(error){
  const value=typeof fallback==='function'?await fallback(error):fallback;
  if(!value)throw error;
  return {source:'json',places:applyPhotoLibrary(value.places||[],photoLibrary),routes:value.routes||[],error};
 }
}
