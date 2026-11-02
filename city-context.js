import {distance} from './core.js';

export const DEFAULT_CITY_ID='warsaw';

export function normalizeCity(city){
 if(!city||!city.id||!city.name||!city.center)return null;
 return {
  ...city,
  slug:city.slug||city.id,
  locale:city.locale||'pl-PL',
  currency:city.currency||'PLN',
  timezone:city.timezone||'Europe/Warsaw',
  radiusKm:Number(city.radiusKm)||40,
  defaultZoom:Number(city.defaultZoom)||12,
  center:{lat:Number(city.center.lat),lng:Number(city.center.lng)}
 };
}

export function cityById(cities,id=DEFAULT_CITY_ID){
 return cities.map(normalizeCity).find(c=>c?.id===id)||cities.map(normalizeCity).find(c=>c?.id===DEFAULT_CITY_ID)||null;
}

export function cityPoint(city){return city?.center?{lat:Number(city.center.lat),lng:Number(city.center.lng)}:null;}

export function belongsToCity(item,cityId=DEFAULT_CITY_ID){return (item?.cityId||DEFAULT_CITY_ID)===cityId;}

export function withCityId(items=[],cityId=DEFAULT_CITY_ID){return items.map(item=>({...item,cityId:item.cityId||cityId}));}

export function forCity(items=[],cityId=DEFAULT_CITY_ID){return items.filter(item=>belongsToCity(item,cityId));}

export function searchQuery(place,city){return `${place?.name||''} ${city?.name||''}`.trim();}

export function isInsideCity(point,city,maxKm=city?.radiusKm){
 const center=cityPoint(city);if(!point||!center)return false;
 return distance(point,center)<=Number(maxKm||40);
}

export function routeTitle(city){return `${city?.name||'Miasto'} po Twojemu`;}

export function legacyCategory(type,legacyAliases={}){
 const legacy=Array.isArray(type?.cats)?type.cats[0]:type?.category;
 return type?.categoryId||legacyAliases[legacy]||legacy||null;
}
