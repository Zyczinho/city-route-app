const DEFAULT_RADIUS_M=500;
const DEFAULT_MAX_RESULTS=50;

const finite=(value,name)=>{
 const number=Number(value);
 if(!Number.isFinite(number))throw new Error(`nearby-${name}-invalid`);
 return number;
};

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function nearbyPlaceFromRow(row,cityId){
 return {
  id:String(row.id),
  cityId,
  name:row.name||'',
  lat:Number(row.lat),
  lng:Number(row.lng),
  categoryId:row.category_id||null,
  area:row.area||'',
  description:row.description||'',
  top:!!row.is_top,
  image:row.image_url||null,
  tags:Array.isArray(row.tags)?row.tags:[],
  distanceMeters:Math.round(Number(row.dist_meters)||0)
 };
}

export async function loadNearbyPlaces(client,{city,lat,lng,radiusM=DEFAULT_RADIUS_M,maxResults=DEFAULT_MAX_RESULTS,categoryIds=[]}={}){
 if(!client?.rpc)throw new Error('nearby-client-missing');
 const citySlug=city?.slug||city?.id;
 const cityId=city?.id||citySlug;
 if(!citySlug)throw new Error('nearby-city-missing');
 const latitude=finite(lat,'lat'),longitude=finite(lng,'lng');
 if(latitude < -90 || latitude > 90)throw new Error('nearby-lat-out-of-range');
 if(longitude < -180 || longitude > 180)throw new Error('nearby-lng-out-of-range');
 const categories=[...new Set((categoryIds||[]).map(v=>String(v).trim()).filter(Boolean))];
 const args={
  p_city_slug:citySlug,
  p_lat:latitude,
  p_long:longitude,
  p_radius_m:clamp(Math.round(finite(radiusM,'radius')),50,20000),
  p_max_results:clamp(Math.round(finite(maxResults,'max-results')),1,200),
  p_category_ids:categories.length?categories:null
 };
 const {data,error}=await client.rpc('catalogue_nearby_places',args);
 if(error)throw error;
 return (data||[]).map(row=>nearbyPlaceFromRow(row,cityId));
}
