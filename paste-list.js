// "Wklej listę": turn a list pasted from a chat (ChatGPT, notes, messages) into places.
// Lines may hold a Google Maps link, a place name, or both ("1. **Teatro Cubano** – bar… [Mapa](https://maps.app.goo.gl/…)").
export const MAX_PASTED_PLACES=15;
const URL_RE=/https?:\/\/[^\s)\]>"']+/gi;
const MD_LINK_RE=/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const LINK_WORDS=/^(google\s*maps?|maps?|mapa|link|lokalizacja|location|here|tutaj|zobacz)$/i;
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/ł/g,'l').replace(/\s+/g,' ').trim();

export function isMapsUrl(value){
 try{
  const u=new URL(value);if(u.protocol!=='https:')return false;
  const h=u.hostname.toLowerCase();
  return h==='maps.app.goo.gl'||(h==='goo.gl'&&u.pathname.startsWith('/maps'))||h==='maps.google.com'||/^(?:www\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(h)&&u.pathname.startsWith('/maps');
 }catch{return false;}
}

// Name carried in a full Maps URL: /maps/place/Teatro+Cubano/@52.2,21.0…
export function nameFromMapsUrl(value){
 try{const m=new URL(value).pathname.match(/\/maps\/place\/([^/@]+)/);return m?decodeURIComponent(m[1].replace(/\+/g,' ')).trim().slice(0,80):'';}catch{return '';}
}

function cleanName(line){
 let s=line.replace(MD_LINK_RE,(_,text)=>LINK_WORDS.test(text.trim())?' ':text).replace(URL_RE,' ');
 s=s.replace(/^\s*(?:#{1,6}\s*)?(?:\d{1,2}[.)]|[-*•–—·])\s*/,'').replace(/\*\*|__|`/g,'');
 // "Name – description", "Name: description", "Name (Dzielnica) - opis"
 s=s.split(/\s+[–—-]\s+|:\s+|\s+\|\s+/)[0];
 s=s.replace(/\s*\([^)]*\)\s*$/,'').replace(/[\s,.;:!–—-]+$/,'').replace(/^[\s"„“'”]+|[\s"„“'”]+$/g,'').trim();
 return s;
}

export function parsePastedList(text,{limit=MAX_PASTED_PLACES}={}){
 const out=[],seen=new Set();let skipped=0;
 for(const raw of String(text||'').slice(0,20000).split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const url=(line.match(URL_RE)||[]).map(u=>u.replace(/[.,;]+$/,'')).find(isMapsUrl)||'';
  let name=cleanName(line);
  // Descriptions and headers ("Najlepsze sauny:", long sentences) are not places.
  if(!url&&(/:\s*$/.test(line)||name.length>60||name.split(' ').length>8)){continue;}
  if(name.length<2||name.length>80)name=url?nameFromMapsUrl(url):'';
  if(!name&&!url)continue;
  const key=url||fold(name);if(seen.has(key))continue;seen.add(key);
  if(out.length>=limit){skipped++;continue;}
  out.push({name,url});
 }
 return {items:out,skipped};
}

// "Plac Bohaterów Getta" ≠ "Dawny ratusz miasta Podgórza": a search hit counts only when one name contains
// the other, or every distinctive word of the pasted name appears in the hit.
const STOP_WORDS=new Set(['the','and','bar','cafe','kawiarnia','restauracja','restaurant','klub','club','pub','w','na','i','z','do','de','da','la','le']);
const words=s=>fold(s).replace(/[^\p{L}\p{N} ]+/gu,' ').split(' ').filter(w=>w.length>=3&&!STOP_WORDS.has(w));
export function sameNamedPlace(pasted,found){
 const a=fold(pasted).replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim(),b=fold(found).replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim();
 if(!a||!b)return false;
 if(a===b||b.includes(a)||a.includes(b)&&b.length>=4)return true;
 const need=words(pasted),have=new Set(words(found));
 return need.length>0&&need.every(w=>have.has(w));
}

async function getJson(fetcher,url){
 const r=await fetcher(url,{headers:{accept:'application/json'}});
 return r.ok?r.json().catch(()=>null):null;
}

// One pasted item → {name,lat,lng,url} or null. Links: the Worker resolves the Maps link (and its name).
// Names: the city-scoped place search, then place details for a Google hit (coordinates arrive only there).
export async function resolvePastedItem(item,{cityQuery='',session='',fetcher=fetch}={}){
 const sep=cityQuery?'&'+cityQuery:'';
 if(item.url){
  const p=await getJson(fetcher,'/api/place-preview?url='+encodeURIComponent(item.url)+sep).catch(()=>null);
  const loc=p?.location;
  if(p?.status==='ok'&&Number.isFinite(loc?.lat)&&Number.isFinite(loc?.lng))return {name:item.name||p.name||'',lat:loc.lat,lng:loc.lng,url:item.url,placeId:p.placeId||''};
  const l=await getJson(fetcher,'/api/location?url='+encodeURIComponent(item.url)).catch(()=>null);
  if(l?.status==='ok'&&Number.isFinite(l.location?.lat)&&(item.name||nameFromMapsUrl(item.url)))return {name:item.name||nameFromMapsUrl(item.url),lat:l.location.lat,lng:l.location.lng,url:item.url,placeId:''};
  if(!item.name)return null;
 }
 const s=await getJson(fetcher,'/api/place-suggest?q='+encodeURIComponent(item.name)+sep+'&session='+encodeURIComponent(session)).catch(()=>null);
 // Better to skip a place than to add a different one: the hit must carry the pasted name.
 const hit=(s?.suggestions||[]).find(x=>sameNamedPlace(item.name,x?.name));if(!hit)return null;
 if(Number.isFinite(hit.location?.lat)&&Number.isFinite(hit.location?.lng))return {name:hit.name||item.name,lat:hit.location.lat,lng:hit.location.lng,url:item.url||'',placeId:''};
 if(hit.provider==='google'&&hit.placeId){
  const d=await getJson(fetcher,'/api/place-details?id='+encodeURIComponent(hit.placeId)+sep+'&session='+encodeURIComponent(session)).catch(()=>null);
  if(d?.status==='ok'&&Number.isFinite(d.location?.lat))return {name:d.name||hit.name||item.name,lat:d.location.lat,lng:d.location.lng,url:item.url||'',placeId:d.placeId||hit.placeId};
 }
 return null;
}

export async function resolvePastedList(items,{concurrency=3,onProgress=()=>{},...opts}={}){
 const results=new Array(items.length).fill(null);let next=0,done=0;
 const worker=async()=>{while(next<items.length){const i=next++;try{results[i]=await resolvePastedItem(items[i],opts);}catch{results[i]=null;}done++;onProgress(done,items.length);}};
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},worker));
 return items.map((item,i)=>({item,place:results[i]}));
}
