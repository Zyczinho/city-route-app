// Pure logic behind the quick "Dodaj miejsce" composer: input classification, coordinates, city checks,
// duplicate detection and category hints. No DOM here, so every rule is covered by node tests.
import {parseLocation,distance,fold} from './core.js';

export const MIN_QUERY=3;
export const SUGGEST_DELAY_MS=300;
export const DUPLICATE_METERS=120;

const MAPS_LINK=/^https:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
export const isMapsLink=v=>MAPS_LINK.test(String(v||'').trim());

// Accepts "52.230123, 21.012345", "52,230123, 21,012345", "52,23; 21,01", "52.23 21.01" and geo: URIs.
export function parseCoordinates(text){
 const s=String(text||'').trim();if(!s||/^https?:/i.test(s))return null;
 const direct=parseLocation(s);if(direct)return direct;
 const m=s.match(/^(-?\d{1,2}),(\d+)\s*(?:[,;]\s*|\s+)(-?\d{1,3}),(\d+)$/);
 if(!m)return null;
 const lat=Number(`${m[1]}.${m[2]}`),lng=Number(`${m[3]}.${m[4]}`);
 return lat>=-90&&lat<=90&&lng>=-180&&lng<=180?{lat,lng}:null;
}

export function classifyInput(text){
 const value=String(text||'').replace(/\s+/g,' ').trim();
 if(!value)return {kind:'empty',value};
 if(isMapsLink(value))return {kind:'maps',value};
 if(/^https?:\/\//i.test(value))return {kind:'other-link',value};
 const location=parseCoordinates(value);if(location)return {kind:'coords',value,location};
 return {kind:value.length>=MIN_QUERY?'text':'short',value};
}

export const formatCoords=p=>`${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}`;

export const normalizeQuery=v=>String(v||'').replace(/\s+/g,' ').trim();

// A new search drops the earlier pick, so place B is never saved at place A's coordinates.
// Only a pin the user placed by hand survives: the query then only named the place.
export function keepsSelection(selection,query){
 if(!selection)return false;
 if(selection.source==='pin'&&selection.location)return true;
 return normalizeQuery(query)===selection.query;
}

export function cityCheck(point,city){
 if(!point||!city?.center)return {ok:false,km:null};
 const km=distance(point,city.center),limit=Number(city.radiusKm)||40;
 return {ok:km<=limit,km:Math.round(km*10)/10,limit};
}

export function activeCity(cities=[],{selectValue='',state=null}={}){
 const id=selectValue||state?.cityId||'warsaw';
 return cities.find(c=>c.id===id)||cities.find(c=>c.id==='warsaw')||null;
}

export function cityParams(city){
 if(!city?.center)return '';
 const p=new URLSearchParams({city:city.id||'',name:city.name||'',lat:String(city.center.lat),lng:String(city.center.lng),r:String(city.radiusKm||40)});
 return p.toString();
}

const words=s=>fold(s).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>1);

// Catalogue search runs before any external provider: free, offline and it prevents duplicates.
export function catalogueMatches(query,places=[],{limit=3}={}){
 const q=words(query);if(!q.length)return [];
 const scored=[];
 for(const p of places){
  if(!p?.name||p.kind==='hotel')continue;
  const name=fold(p.name),hay=fold([p.name,p.area,p.address].filter(Boolean).join(' '));
  if(!q.every(w=>hay.includes(w)))continue;
  const score=(name.startsWith(q[0])?2:0)+(q.every(w=>name.includes(w))?1:0);
  scored.push([score,p]);
 }
 return scored.sort((a,b)=>b[0]-a[0]||a[1].name.localeCompare(b[1].name,'pl')).slice(0,limit).map(x=>x[1]);
}

// A picked provider result is a duplicate when a known place sits within ~120 m and shares a name word,
// or sits within 25 m regardless of name (same building, different spelling).
export function findDuplicate(candidate,places=[],{meters=DUPLICATE_METERS}={}){
 const loc=candidate?.location;if(!loc)return null;
 const cw=new Set(words(candidate.name));let best=null;
 for(const p of places){
  if(!Number.isFinite(p?.lat)||!Number.isFinite(p?.lng))continue;
  const m=distance(loc,{lat:p.lat,lng:p.lng})*1000;if(m>meters)continue;
  const shared=words(p.name).some(w=>w.length>2&&cw.has(w));
  if((shared||m<=25)&&(!best||m<best.m))best={place:p,m:Math.round(m)};
 }
 return best;
}

// Provider types are matched as whole tokens ("italian_restaurant" -> restaurant), names by Polish stems.
const TYPE_TOKENS=[
 ['club','nightclub discotheque dance club disco'],
 ['bar','bar pub cocktail wine'],
 ['live_music','concert concert_hall music live'],
 ['sport','gym sport fitness yoga recreation'],
 ['workshop','workshop workshop_space studio'],
 ['jedzenie','restaurant cafe coffee bakery bar pub food meal ice cream pizza bistro fast dessert confectionery deli biergarten cafeteria'],
 ['muzea','museum gallery exhibition planetarium aquarium'],
 ['zielen','park garden forest nature wood zoo botanical meadow playground'],
 ['widoki','viewpoint observation deck river beach lake marina bridge riverbank waterfront'],
 ['zabytki','monument memorial church cathedral castle palace historic historical landmark attraction worship synagogue ruins fort hall']
].map(([cat,list])=>[cat,new Set(list.split(' '))]);
const NAME_STEMS=[
 ['club',/klub|night ?club|dyskotek|sketch nite/],
 ['bar',/pub|cocktail bar|wine bar/],
 ['sport',/silown|fitness|studio jogi|basen/],
 ['jedzenie',/kawiarn|restaurac|bistro|piekarn|cukierni|bar mleczny|pierogarn|ramen|nudl|pizzer|kuchni/],
 ['muzea',/muzeum|galeri/],
 ['zielen',/\bpark|ogrod|\blas\b|skwer/],
 ['widoki',/widok|bulwar|plaza|taras/],
 ['zabytki',/kosciol|zamek|palac|pomnik|katedr|synagog|brama|barbakan/]
];

export function categoryFromTypes(types=[],name=''){
 const tokens=new Set(types.flatMap(t=>fold(t).split(/[_\s-]+/)));
 for(const [cat,set] of TYPE_TOKENS)for(const t of tokens)if(set.has(t))return cat;
 const n=fold(name);
 for(const [cat,re] of NAME_STEMS)if(re.test(n))return cat;
 return 'okolice';
}

export const SOURCE_LABEL={'google':'Google Maps','photon-osm':'OpenStreetMap','catalogue':'City Route','mine':'Twoje miejsce','maps-link':'Link Google Maps','coords':'Współrzędne','pin':'Pinezka'};

// Ignores responses that arrive after a newer request started (stale type-ahead results).
export function latestOnly(){
 let seq=0;
 return {next(){return ++seq;},isCurrent(id){return id===seq;},cancel(){seq++;}};
}

export function sessionToken(rand=globalThis.crypto){
 try{return rand.randomUUID().replace(/-/g,'');}catch{return Math.random().toString(36).slice(2)+Date.now().toString(36);}
}
