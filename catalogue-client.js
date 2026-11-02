const LEGACY_CATEGORY={
 landmark:'zabytki',museum:'muzea',gallery:'muzea',architecture:'zabytki',religious_site:'zabytki',
 viewpoint:'widoki',neighborhood:'okolice',hidden_gem:'okolice',park:'zielen',garden:'zielen',waterfront:'widoki',beach:'widoki',walk:'zielen',
 restaurant:'jedzenie',cafe:'jedzenie',breakfast:'jedzenie',street_food:'jedzenie',food_hall:'jedzenie',bakery:'jedzenie',dessert:'jedzenie',
 bar:'okolice',pub:'okolice',cocktail_bar:'okolice',wine_bar:'okolice',club:'okolice',live_music:'okolice',
 sport:'okolice',spa:'okolice',workshop:'okolice',experience:'okolice',hotel:'noclegi',hostel:'noclegi',apartment:'noclegi',guesthouse:'noclegi'
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
  image:row.image_url||null,
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

export async function loadCatalogueWithFallback({client,city,fallback}){
 try{return await loadSupabaseCatalogue(client,city);}
 catch(error){
  const value=typeof fallback==='function'?await fallback(error):fallback;
  if(!value)throw error;
  return {source:'json',places:value.places||[],routes:value.routes||[],error};
 }
}
