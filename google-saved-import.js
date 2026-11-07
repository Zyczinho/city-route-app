// Google Takeout "Saved" CSV + point GeoJSON. Pure, client-side, no Google credentials or scraping.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ł/g,'l').trim().replace(/\s+/g,' ');
const number=n=>n===''||n===null||n===undefined?NaN:Number(n);
const valid=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
// Only a place coordinate embedded in a Maps URL is trusted; never mistake /@viewport for a venue.
export function coordinatesFromGoogleUrl(raw){
 try{
  const u=new URL(raw);
  const official=u.hostname==='maps.google.com'||/^(?:www\.)?google\.(?:[a-z]{2,3}|(?:co|com)\.[a-z]{2})$/.test(u.hostname);
  if(u.protocol!=='https:'||!official)return null;
  const q=u.searchParams.get('q')||u.searchParams.get('query')||'';
  const m=q.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if(m&&valid(Number(m[1]),Number(m[2])))return {lat:Number(m[1]),lng:Number(m[2])};
  const ll=u.pathname.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if(ll&&valid(Number(ll[1]),Number(ll[2])))return {lat:Number(ll[1]),lng:Number(ll[2])};
 }catch{}
 return null;
}
export function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(ch===','||ch==='\t')){row.push(cell);cell='';}
  else if(!quoted&&(ch==='\n'||ch==='\r')){row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';if(ch==='\r'&&text[i+1]==='\n')i++;}
  else cell+=ch;
 }
 if(quoted)throw Error('Nieprawidłowy CSV: niedomknięty cudzysłów.');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
export function parseGoogleSaved(text,filename='export.csv'){
 if(typeof text!=='string'||text.length>2_000_000)throw Error('Maksymalny rozmiar pliku to 2 MB.');
 let data=[];
 if(/\.kml$/i.test(filename)){
  // Google My Maps KML: extract placemark points only; never invent coordinates for lines or polygons.
  const get=(body,tag)=>{const re=new RegExp('<(?:[A-Za-z_]+:)?'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_]+:)?'+tag+'>','i');return body.match(re)?.[1]||'';};
  const plain=raw=>String(raw).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
   .replace(/<[^>]+>/g,'').replace(/&(?:amp|lt|gt|quot|apos|#(?:x[0-9a-f]+|[0-9]+));/gi,entity=>{
    const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    const lower=entity.toLowerCase();if(named[lower])return named[lower];
    const cp=lower.startsWith('&#x')?parseInt(lower.slice(3,-1),16):parseInt(lower.slice(2,-1),10);
    return Number.isInteger(cp)&&cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';
   }).trim();
  data=[...text.matchAll(/<(?:[A-Za-z_]+:)?Placemark\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_]+:)?Placemark>/gi)]
   .map(m=>{const body=m[1],point=get(body,'Point'),coords=get(point,'coordinates').trim().split(/[\s,]+/);
    return {name:plain(get(body,'name')).slice(0,160),note:plain(get(body,'description')).slice(0,500),
     url:'',lat:point?number(coords[1]):NaN,lng:point?number(coords[0]):NaN};
   }).filter(e=>valid(e.lat,e.lng));
 }else if(/\.(?:geojson|json)$/i.test(filename)){
  const parsed=JSON.parse(text);
  const entries=parsed?.type==='FeatureCollection'?parsed.features:Array.isArray(parsed)?parsed:[];
  data=entries.filter(x=>x&&typeof x==='object').map(x=>{
   const c=x.geometry?.type==='Point'?x.geometry.coordinates:null,loc=c&&c.length>=2?{lat:number(c[1]),lng:number(c[0])}:null;
   const props=x.properties||x;
   return {name:String(props.title||props.name||'').slice(0,160),note:String(props.note||props.description||'').slice(0,500),
    url:String(props.item_content_url||props.url||'').slice(0,900),lat:loc?.lat??number(props.latitude??props.lat),lng:loc?.lng??number(props.longitude??props.lng)};
  });
 }else if(/\.csv$/i.test(filename)){
  const rows=parseCsv(text.replace(/^\uFEFF/,''));
  const h=rows.findIndex(row=>row.map(norm).includes('title')&&(row.map(norm).includes('item_content_url')||row.map(norm).includes('url')||row.map(norm).includes('link')));
  if(h<0)throw Error('Nie rozpoznano pliku Saved CSV. Potrzebne kolumny title i item_content_url / url.');
  const headers=rows[h].map(norm),col=(r,...names)=>{for(const name of names){const i=headers.indexOf(name);if(i>=0)return r[i]||'';}return '';};
  data=rows.slice(h+1).map(r=>({
   name:col(r,'title','name'),note:col(r,'note','description'),
   url:col(r,'item_content_url','url','link'),
   lat:number(col(r,'latitude','lat')),lng:number(col(r,'longitude','lng','lon'))
  }));
 }else throw Error('Obsługujemy Saved CSV, GeoJSON/JSON oraz KML z Google My Maps.');
 if(data.length>2000)throw Error('Za dużo miejsc. Podziel eksport na pliki do 2000 miejsc.');
 return data.map(v=>{const inferred=!valid(v.lat,v.lng)?coordinatesFromGoogleUrl(v.url):null;
  return {name:String(v.name||'').trim().slice(0,160),note:String(v.note||'').slice(0,500),url:/^https:\/\//.test(v.url)?v.url.slice(0,900):'',
   lat:valid(v.lat,v.lng)?v.lat:inferred?.lat??null,lng:valid(v.lat,v.lng)?v.lng:inferred?.lng??null};
 }).filter(v=>v.name);
}
const km=(a,b)=>{
 const d2r=Math.PI/180,dlat=(a.lat-b.lat)*d2r,dlng=(a.lng-b.lng)*d2r;
 const s=Math.sin(dlat/2)**2+Math.cos(a.lat*d2r)*Math.cos(b.lat*d2r)*Math.sin(dlng/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(s)));
};
// Matching conservatively: a title without coordinates resolves only to one unambiguous catalogue item.
export function planGoogleSavedImport(entries,{cities=[],catalogue=[],ownPlaces=[]}={}){
 const supported=cities.filter(c=>['launch','next'].includes(c.status)),known=[...catalogue,...ownPlaces];
 const matched=[],created=[],unresolved=[],seen=new Set();
 for(const entry of entries){
  if(!entry.name)continue;
  const loc=valid(entry.lat,entry.lng)?{lat:entry.lat,lng:entry.lng}:null;
  let candidates=known.filter(p=>norm(p.name)===norm(entry.name)&&supported.some(c=>c.id===p.cityId));
  if(loc)candidates=candidates.filter(p=>valid(p.lat,p.lng)&&km(loc,p)<0.25).sort((a,b)=>km(loc,a)-km(loc,b));
  if(candidates.length===1||loc&&candidates.length){
   const p=candidates[0],key=p.cityId+':'+p.id;
   if(!seen.has(key)){matched.push({cityId:p.cityId,placeId:String(p.id),name:entry.name});seen.add(key);}
   continue;
  }
  const city=loc?supported.find(c=>valid(c.center?.lat,c.center?.lng)&&km(loc,c.center)<=c.radiusKm):null;
  if(city){
   const key=city.id+':'+norm(entry.name)+':'+loc.lat.toFixed(4)+':'+loc.lng.toFixed(4);
   if(!seen.has(key)){created.push({...entry,cityId:city.id});seen.add(key);}
  }else unresolved.push(entry);
 }
 return {matched,created,unresolved};
}
