// PHOTO-COVERAGE-039 — conservative, zero-paid-key Commons photo discovery.
// Only geotagged files, exact/strong names, permitted image licenses, and attribution.
// This does not scrape Google Maps / Facebook / Instagram or claim full photo coverage.
const STOP=new Set(['w','we','na','przy','pod','od','do','oraz','i','the','of','in','at','ul','ulica','krakow','krakowie','krakowski','warszawa','warszawie','warsaw','polska','poland','cracow','cracovia','foto','fotografia','photo','image','file','jpg','jpeg','png','webp','wikimedia','commons','dsc','img']);
const generic=new Set(['muzeum','budynek','miasto','zabytki','obiekt','hotel','restauracja','park','plac','ulica']);
const aliases={
 'cloth-hall':['cloth hall'],
 'wawel-castle':['wawel castle','royal castle wawel'],
 'schindler-factory':['schindler factory'],
 'st-marys-basilica':['st mary basilica','st marys basilica'],
 'florian-gate':['florian gate'],
 'old-synagogue':['old synagogue krakow']
};
export function commonsTokens(value){
 return String(value||'').toLowerCase().replace(/ł/g,'l').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>=3&&!/^\d+$/.test(x)&&!STOP.has(x));
}
const titleWords=t=>new Set(commonsTokens(t).filter(x=>!generic.has(x)));
function tokenMatch(needle,haystack){
 return haystack.some(x=>x===needle||(needle.length>=6&&x.length>=6&&(needle.startsWith(x)||x.startsWith(needle))&&Math.min(x.length,needle.length)/Math.max(x.length,needle.length)>=.75));
}
export function commonsNameConfidence(place,title){
 const words=commonsTokens(place?.name).filter(x=>!generic.has(x));
 const hay=[...titleWords(title.replace(/^File:/i,''))];
 const valid=words.filter(x=>tokenMatch(x,hay));
 const primary=words.length===1?(words[0].length>=6&&valid.length===1?0.92:0):
  words.length>=2&&valid.length>=2&&valid.length/words.length>=.66?valid.length/words.length:0;
 const named=(aliases[String(place?.id)]||[]).some(alias=>commonsTokens(alias).every(x=>tokenMatch(x,hay)))?0.86:0;
 return Math.max(primary,named);
}
const stripHtml=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#(?:39|x27);/gi,"'").replace(/\s+/g,' ').trim();
const urlAllowed=(value,host)=>{
 try{const u=new URL(String(value));return u.protocol==='https:'&&u.hostname===host?u.href:null;}catch{return null;}
};
export function commonsPhotoUrl(place){
 const lat=Number(place?.lat),lng=Number(place?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 const u=new URL('https://commons.wikimedia.org/w/api.php');
 const params={action:'query',generator:'geosearch',ggsprimary:'all',ggsnamespace:'6',ggsradius:'90',ggscoord:lat+'|'+lng,ggslimit:'16',prop:'coordinates|imageinfo',iiprop:'url|size|mime|extmetadata',iiurlwidth:'960',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist',iiextmetadatalanguage:'en',format:'json',formatversion:'2',origin:'*'};
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 return u.href;
}
const distanceM=(a,b)=>{
 const dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180,lat=a.lat*Math.PI/180,lon=b.lat*Math.PI/180;
 return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dLat/2)**2+Math.cos(lat)*Math.cos(lon)*Math.sin(dLng/2)**2)));
};
export function chooseCommonsPhoto(place,pages=[]){
 if(!commonsPhotoUrl(place)||!place?.name)return null;
 const choices=[];
 for(const page of pages){
  if(page?.ns!==6||!/^File:/i.test(page.title||''))continue;
  if(/\b(?:logo|mapa|map|plan|schemat|icon|herb|coat of arms)\b/i.test(page.title))continue;
  const conf=commonsNameConfidence(place,page.title);
  if(conf<.85)continue;
  const coords=page.coordinates?.[0];
  if(coords&&Number.isFinite(coords.lat)&&Number.isFinite(coords.lon)&&distanceM({lat:Number(place.lat),lng:Number(place.lng)},{lat:Number(coords.lat),lng:Number(coords.lon)})>115)continue;
  const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
  const mime=String(info?.mime||'');
  if(mime&&!/^image\/(?:jpeg|png|webp)$/i.test(mime))continue;
  const src=urlAllowed(info?.thumburl||info?.url,'upload.wikimedia.org');
  const width=Number(info?.width),height=Number(info?.height);
  if(!src||!(width>=640&&height>=400))continue;
  const license=stripHtml(meta.LicenseShortName?.value);
  if(!/^(?:CC BY(?:-SA)?\s*\d(?:\.\d)?|CC0(?:\s*1\.0)?|Public domain|PD-(?:old|self|US))$/i.test(license))continue;
  const artist=stripHtml(meta.Artist?.value).slice(0,120);
  if(/^CC BY/i.test(license)&&!artist)continue;
  const source=urlAllowed(info.descriptionurl,'commons.wikimedia.org')||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_'));
  const licenseUrl=meta.LicenseUrl?.value?urlAllowed(meta.LicenseUrl.value,'creativecommons.org'):null;
  const ratio=width/height;
  choices.push({src,author:artist||'Wikimedia Commons',license,licenseUrl,source,via:'Wikimedia Commons',placeId:String(place.id||''),score:conf*10+Math.log2(width*height)/10-Math.abs(Math.log(ratio/1.55))});
 }
 choices.sort((a,b)=>b.score-a.score);
 if(!choices.length)return null;
 const {score,...winner}=choices[0];return winner;
}
export async function findCommonsPhoto(place,{fetcher=fetch,signal}={}){
 const url=commonsPhotoUrl(place);if(!url)return null;
 const result=await fetcher(url,{signal,headers:{accept:'application/json'}});
 if(!result.ok)return null;
 const data=await result.json();
 return chooseCommonsPhoto(place,Array.isArray(data?.query?.pages)?data.query.pages:Object.values(data?.query?.pages||{}));
}
