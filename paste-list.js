// "Wklej listę": turn a list pasted from a chat (ChatGPT, notes, messages) into places.
// Lines may hold a Google Maps link, a place name, or both ("1. **Teatro Cubano** – bar… [Mapa](https://maps.app.goo.gl/…)").
// The limit counts places that were found, not pasted lines; lookups have their own budget so that
// a paste full of prose cannot burn through the paid place search.
export const MAX_PASTED_PLACES=15;
export const MAX_PASTED_LOOKUPS=30;
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

const SEPARATOR_RE=/\s+[–—-]\s+|:\s+|\s+\|\s+/;
const NUMBERED_RE=/^\s*(?:#{1,6}\s*)?\d{1,2}[.)]\s+/;
function cleanName(line){
 let s=line.replace(MD_LINK_RE,(_,text)=>LINK_WORDS.test(text.trim())?' ':text).replace(URL_RE,' ');
 s=s.replace(/^\s*(?:#{1,6}\s*)?(?:\d{1,2}[.)]|[-*•–—·])\s*/,'').replace(/\*\*|__|`/g,'');
 // Emoji or other decoration in front of the name ("📍 Wallace Collection").
 s=s.replace(/^[^\p{L}\p{N}"„“'(]+/u,'');
 // "Name – description", "Name: description", "Name (Dzielnica) - opis"
 s=s.split(SEPARATOR_RE)[0];
 s=s.replace(/\s*\([^)]*\)\s*$/,'').replace(/[\s,.;:!–—-]+$/,'').replace(/^[\s"„“'”]+|[\s"„“'”]+$/g,'').trim();
 return s;
}

// Day and date headers of a multi-day plan: "Wtorek, 24 listopada – Marylebone i Mayfair", "Dzień 1", "Day 2: Soho".
const DAY_HEADER_RE=/^(?:(?:poniedzialek|wtorek|sroda|czwartek|piatek|sobota|niedziela|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|(?:dzien|day)\s+(?:\d{1,2}|[ivx]{1,4}|pierwszy|drugi|trzeci|czwarty|piaty|szosty|siodmy|one|two|three|four|five|six|seven)\b|\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrzesnia|pazdziernika|listopada|grudnia|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b)/;
// "Rano – kawa", "Dojazd: metro", "Bilety: 15 £": the part before the separator is a label, not a place.
const LABEL_WORDS=new Set(['rano','poranek','przedpoludnie','poludnie','popoludnie','wieczor','wieczorem','noc','sniadanie','lunch','obiad','kolacja','kawa','przerwa','morning','afternoon','evening','night','breakfast','dinner','uwaga','wskazowka','wskazowki','tip','tips','porada','czas','dojazd','transport','bilet','bilety','cena','ceny','koszt','wstep','adres','godziny','godziny otwarcia','termin','rezerwacja','dlaczego','dlaczego warto','co zobaczyc','opis','podsumowanie','plan','trasa','miejsce','miejsca','wystawa','wystawy','nazwa','gdzie','kiedy','summary','note','why','where','when']);
// Words of a sentence or of a section title; a bare line with one of them is prose ("Zarezerwuj sobie około 4–5 godzin").
const PROSE_WORDS=new Set(['sobie','okolo','sie','jest','sa','bedzie','beda','warto','mozna','trzeba','moje','moj','moja','twoj','twoje','twoja','czyli','oraz','ktory','ktora','ktore','bardzo','tylko','jesli','zeby','aby','tez','takze','rzecz','rzeczy','wazne','wazna','najlepiej','najlepsze','najwieksze','najwiekszych','rekomendacje','rekomendacji','propozycja','propozycje','podsumowanie','wskazowki','godzin','godziny','godzine','minut','minuty','dni','dnia','tydzien','dlaczego','zarezerwuj','zobacz','idz','przejdz','zacznij','zakoncz','kup','wez','sprawdz','pamietaj','polecam','proponuje','uwaga','you','your','our','should','will','hours','minutes','tips','summary','recommendations','recommendation','why','how','what','this','that','these','book','visit','start','finish','remember']);
// "2. Spacer po Mayfair", "3. Lunch w Soho": a step of the plan, not a place.
const ACTIVITY_WORDS=new Set(['spacer','przerwa','lunch','obiad','kolacja','sniadanie','zakupy','powrot','przejazd','dojazd','odpoczynek','walk','stroll','break','shopping','dinner','breakfast','transfer']);
const plain=s=>fold(s).replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim();

// One pasted line → a candidate, or null when the line is a header, a sentence or a table row.
function candidate(line,{tableFirstColumn=false}={}){
 const url=(line.match(URL_RE)||[]).map(u=>u.replace(/[.,;]+$/,'')).find(isMapsUrl)||'';
 let text=line;
 // Table rows (copied cells are tab-separated, markdown rows start with "|"). In a chat answer the table
 // repeats places from the text, often with something else in the first column; a pasted sheet is a list.
 if(/\t/.test(line)||/^\s*\|/.test(line)){
  if(!url&&!tableFirstColumn)return null;
  text=line.split(/\t|\|/).map(c=>c.trim()).filter(c=>c&&!/^:?-{2,}:?$/.test(c))[0]||'';
 }
 let name=cleanName(text);
 if(name.length<2||name.length>80)name=url?nameFromMapsUrl(url):'';
 if(url)return {name,url,strong:true,lower:false};
 if(!name)return null;
 const body=text.replace(/\*\*|__|`/g,'').trim();
 const numbered=NUMBERED_RE.test(text),marked=numbered||/^\s*[-*•·]\s+/.test(text),described=SEPARATOR_RE.test(body.replace(NUMBERED_RE,''));
 // Descriptions and headers ("Najlepsze sauny:", long sentences) are not places.
 if(/[:?!]$/.test(body)||name.length>60||name.split(' ').length>8)return null;
 // A sentence ends with a period or a semicolon; "Name – description." keeps the name before the dash.
 // An unmarked "Spokojny początek: jedna kolekcja, potem spacer." is a sentence with a colon as well.
 if(/[.;]$/.test(body)&&(!described||!marked&&/^[^–—]*:\s/.test(body)))return null;
 const folded=plain(name);
 if(DAY_HEADER_RE.test(fold(name))||DAY_HEADER_RE.test(fold(body.replace(/^[^\p{L}\p{N}]+/u,'')))||LABEL_WORDS.has(folded)||ACTIVITY_WORDS.has(folded.split(' ')[0]))return null;
 const strong=numbered||described&&(marked||name.split(' ').length<=5);
 if(!numbered){
  const w=folded.split(' ');
  if(w.length>6||w.some(x=>PROSE_WORDS.has(x)))return null;
  // A place name of three or more words carries another capital or a number ("Sir John Soane's Museum");
  // a title or a sentence does not ("Ważna rzecz dotycząca terminu").
  const rest=name.split(' ').slice(1);
  if(rest.length>=2&&!rest.some(x=>/^[\p{Lu}\p{N}]/u.test(x)))return null;
 }
 return {name,url:'',strong,lower:/^\p{Ll}/u.test(name)};
}

// Pasted text → candidates in text order: {name,url,strong}. `strong` marks lines that look like list items
// ("1. Wallace Collection", "Mount Street – butiki", a Maps link); they are looked up first.
// `limit` only bounds the candidate list; the limit of places is applied to places that were found.
export function parsePastedList(text,{limit=Infinity}={}){
 const lines=String(text||'').slice(0,20000).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const tableRows=lines.filter(l=>/\t/.test(l)||/^\|/.test(l)).length;
 let found=lines.map(l=>candidate(l,{tableFirstColumn:tableRows>lines.length/2})).filter(Boolean);
 // Lines starting with a lowercase letter are fragments of a description ("malarstwo dawnych mistrzów"),
 // unless the whole list was typed that way.
 if(found.some(c=>!c.lower))found=found.filter(c=>!c.lower);
 const out=[];
 for(const c of found){
  const key=plain(c.name);
  // "Leighton House" and "Leighton House Museum" are one place: keep the first position and the fuller name.
  const same=out.find(o=>c.url&&o.url?o.url===c.url:(!c.url||!o.url)&&key&&o.key&&(o.key===key||Math.min(o.key.length,key.length)>=4&&(` ${o.key} `.includes(` ${key} `)||` ${key} `.includes(` ${o.key} `))));
  if(same){
   if(key.length>same.key.length){same.name=c.name;same.key=key;}
   same.url=same.url||c.url;same.strong=same.strong||c.strong;
   continue;
  }
  out.push({name:c.name,url:c.url,strong:c.strong,key});
 }
 const items=out.map(({name,url,strong})=>({name,url,strong}));
 return {items:items.slice(0,limit),skipped:Math.max(0,items.length-limit)};
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

// Looks candidates up until `maxFound` places are found or `maxLookups` candidates were tried, strong
// candidates first. Returns every item in its original order: {item,place,tried}; `tried:false` means the
// item was left out by one of the two limits.
export async function resolvePastedList(items,{concurrency=3,onProgress=()=>{},maxFound=Infinity,maxLookups=Infinity,...opts}={}){
 const results=new Array(items.length).fill(null),tried=new Array(items.length).fill(false);
 const order=[...items.keys()].sort((a,b)=>(items[b].strong?1:0)-(items[a].strong?1:0)||a-b).slice(0,Math.max(0,maxLookups));
 let next=0,done=0,found=0;
 const worker=async()=>{while(next<order.length&&found<maxFound){
  const i=order[next++];tried[i]=true;
  try{results[i]=await resolvePastedItem(items[i],opts);}catch{results[i]=null;}
  if(results[i])found++;
  done++;onProgress(done,order.length);
 }};
 await Promise.all(Array.from({length:Math.min(concurrency,order.length)},worker));
 // Parallel lookups can finish a place or two over the limit; those count as left out.
 let kept=0;
 return items.map((item,i)=>{
  if(results[i]&&kept>=maxFound)return {item,place:null,tried:false};
  if(results[i])kept++;
  return {item,place:results[i],tried:tried[i]};
 });
}
