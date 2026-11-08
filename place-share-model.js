// Share a private place by explicit opt-in, without submitting it to the public catalogue.
// Only the place's name, city, category and coordinates travel in the URL hash.
// Private notes, local photos, ratings, account data and original local identifiers are excluded.
const CITY=/^[a-z0-9][a-z0-9_-]{0,79}$/i;
const CATEGORIES=new Set(['zabytki','muzea','zielen','widoki','okolice','jedzenie','nocne','aktywnosci']);
const BASE64=/^[A-Za-z0-9_-]{8,700}$/;
const ORIGIN=/^https?:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i;

function validCoords(lat,lng){
 return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&
  Math.abs(lat)<=90&&Math.abs(lng)<=180;
}
function normalizedName(value){
 if(typeof value!=='string')return null;
 const s=value.trim();
 return s&&s.length<=100&&!/[\u0000-\u001F\u007F]/.test(s)?s:null;
}
export function encodePlaceSnapshot(place,cityId){
 const name=normalizedName(place?.name),city=String(cityId??''),lat=Number(place?.lat),lng=Number(place?.lng);
 if(!name||!CITY.test(city)||place?.lat==null||place?.lng==null||!validCoords(lat,lng))return null;
 const cat=CATEGORIES.has(place?.cats?.[0])?place.cats[0]:'okolice';
 const data=JSON.stringify({v:1,c:city,n:name,a:Number(lat.toFixed(6)),o:Number(lng.toFixed(6)),g:cat});
 const bytes=new TextEncoder().encode(data);
 if(bytes.length>500)return null;
 const base64=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
 const token=base64.replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 return token.length<=700?token:null;
}
export function decodePlaceSnapshot(token){
 if(typeof token!=='string'||!BASE64.test(token))return null;
 try{
  const padded=token.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-token.length%4)%4);
  const bytes=Uint8Array.from(atob(padded),ch=>ch.charCodeAt(0));
  if(bytes.length>500)return null;
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||value.v!==1||!CITY.test(value.c)||!normalizedName(value.n)||
     !validCoords(value.a,value.o)||!CATEGORIES.has(value.g))return null;
  return {cityId:value.c,name:value.n,lat:value.a,lng:value.o,category:value.g};
 }catch{return null;}
}
export function placeSnapshotUrl(token,origin){
 const payload=decodePlaceSnapshot(token);
 if(!payload||typeof origin!=='string'||!ORIGIN.test(origin))return null;
 return origin.replace(/\/+$/,'')+'/?shareCity='+encodeURIComponent(payload.cityId)+'#places/s-'+token;
}
