import {distinctRoute} from './route-diversity.js';
import {isRouteFoodPlace,isExcludedRoutePlace,normalizeRouteInterests,routeInterestMatch,canViewRouteExterior,routeAllowedByFocus,routeBudgetLimit,routeKnownCost,routeBudgetEligible} from './route-preferences.js';
export const distance = (a,b) => {
 const rad=x=>x*Math.PI/180, dlat=rad(b.lat-a.lat), dlon=rad(b.lng-a.lng);
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2)));
};
export function optimize(items){
 if(!items.length)return []; const remaining=items.slice(1), result=[items[0]];
 while(remaining.length){let best=0;remaining.forEach((p,i)=>{if(distance(result.at(-1),p)<distance(result.at(-1),remaining[best]))best=i;});result.push(remaining.splice(best,1)[0]);}return result;
}
export function summary(items,transport='walking'){
 const km=items.slice(1).reduce((n,p,i)=>n+distance(items[i],p)*1.3,0);
 const speed=transport==='bike'?12:transport==='transit'?8:transport==='mix'?6:4.5;
 return {km,minutes:Math.ceil(items.reduce((n,p)=>n+p.minutes,0)+km/speed*60),cost:items.reduce((n,p)=>n+p.cost,0)};
}
// Rating pulled toward a city-wide prior until a place has enough reviews, so 5.0 from 3 reviews cannot beat 4.7 from 60 000.
export function smoothedRating(ratings=[],prior=4.3,weight=200){
 const parts=ratings.filter(s=>Number.isFinite(s.value)&&Number.isSafeInteger(s.reviewCount)&&s.reviewCount>0);
 const n=parts.reduce((t,s)=>t+s.reviewCount,0);return (prior*weight+parts.reduce((t,s)=>t+s.value/s.max*5*s.reviewCount,0))/(weight+n);
}
// Planner: greedy orienteering. Each pick weighs interest match, quality and must-see against the walk from the previous stop;
// an optional start point counts the first walk; a requested food stop is guaranteed when one fits.
export function generate(places,prefs){
 const limit=Number(prefs.time), interests=prefs.interests||['mix'], origin=prefs.start?{lat:prefs.start.lat,lng:prefs.start.lng,minutes:0,cost:0}:null;
 const isFood=isRouteFoodPlace;
 // A visit without indoor entries should not silently suggest museum exhibitions as a facade stop.
 // A later place-specific exterior-attraction flag can opt exceptional architecture back in.
 const indoorExhibition=p=>['museum','gallery'].includes(p.categoryId)||Array.isArray(p.cats)&&p.cats.includes('muzea');
 const selected=normalizeRouteInterests(interests),foodTheme=selected.some(id=>['food','jedzenie'].includes(id));
 const foodStyle=p=>p.foodStyle&&p.foodStyle!=='none'?p.foodStyle:(p.categoryId==='restaurant'?'sit':'quick');
 const candidates=places.filter(p=>p.kind!=='hotel'&&!isExcludedRoutePlace(p,prefs.avoid)&&
  routeAllowedByFocus(p,prefs)&&routeBudgetEligible(p,prefs)&&
  (prefs.visitMode!=='outside'||canViewRouteExterior(p))&&
  (prefs.food!=='none'||foodTheme||!isFood(p))&&
  (prefs.food!=='quick'||!isFood(p)||foodStyle(p)==='quick')&&
  (prefs.food!=='sit'||!isFood(p)||foodStyle(p)==='sit')&&
  (prefs.offers==='yes'||!p.partner));
 const variantBias=p=>{if(!Number.isInteger(prefs.variantIndex)||prefs.variantIndex<1)return 0;let hash=2166136261;for(const ch of String(p.id))hash=Math.imul(hash^ch.charCodeAt(0),16777619);hash=Math.imul(hash^(prefs.variantIndex*2654435761),2246822519)>>>0;return (hash%1000/1000-.5)*3;};
 // Newly imported catalogue POIs often have a category but no editorial tags/ratings yet.
 // Category affinity gives them a fair chance; a missing rating is neutral, never an exclusion.
 const interestScore=p=>selected.includes('mix')?1:selected.reduce((sum,id)=>sum+
  (routeInterestMatch(p,id)?7:-2)+(Array.isArray(p.tags)&&p.tags.includes(id)?2:0),0);
 const group=p=>{
  const category=p.categoryId||'';
  if(['museum','gallery','religious_site'].includes(category))return 'culture';
  if(['park','garden','waterfront','beach','walk'].includes(category))return 'nature';
  if(['bar','pub','cocktail_bar','wine_bar','club','live_music'].includes(category))return 'nightlife';
  if(['landmark','architecture','viewpoint'].includes(category))return 'sights';
  return category||p.cats?.[0]||'other';
 };
 const score=p=>interestScore(p)+(prefs.tourist==='balanced'?0:prefs.tourist==='must'?(p.tourist==='must'?3:0):(p.tourist==='local'?3:0))+(smoothedRating(p.ratings)-4.3)*4+(p.top&&prefs.tourist!=='local'?1:0)-Math.max(0,Number(prefs.diversityCounts?.[p.id])||0)*(Number(prefs.diversityWeight)||0)+variantBias(p);
 const legs=ps=>summary(origin?[origin,...ps]:ps,prefs.transport).minutes;
 const timeFeasible=ps=>typeof prefs.timeFeasible!=='function'||prefs.timeFeasible(ps);
 const pool=foodTheme&&prefs.food==='none'?candidates:candidates.filter(p=>!isFood(p)),food=prefs.food==='none'?[]:candidates.filter(isFood);
 const result=[];let cost=0;const cap=routeBudgetLimit(prefs);
 const from=()=>result.at(-1)||origin;
 while(pool.length&&result.length<9){
  const visitedGroups=new Map();for(const place of result){const key=group(place);visitedGroups.set(key,(visitedGroups.get(key)||0)+1);}
  const utility=p=>score(p)-(from()?distance(from(),p)*2:0)-(visitedGroups.get(group(p))||0)*1.75;
  pool.sort((a,b)=>utility(b)-utility(a)||a.id.localeCompare(b.id));
  const p=pool.shift();if(cost+(routeKnownCost(p)??0)>cap)continue;
  if(legs([...result,p])<=limit&&timeFeasible([...result,p])){result.push(p);cost+=routeKnownCost(p)??0;}
 }
 if(food.length){
  // Meal goes in the middle third of the route, at the spot that adds the least walking; the last sights give way until it fits.
  const mid={lat:result.reduce((t,p)=>t+p.lat,origin?origin.lat:0)/(result.length+(origin?1:0))||0,lng:result.reduce((t,p)=>t+p.lng,origin?origin.lng:0)/(result.length+(origin?1:0))||0};
  food.sort((a,b)=>(score(b)-distance(mid,b)*3)-(score(a)-distance(mid,a)*3)||a.id.localeCompare(b.id));
  const fits=t=>legs(t)<=limit&&timeFeasible(t)&&t.reduce((n,p)=>n+(routeKnownCost(p)??0),0)<=cap;
  for(const f of food.slice(0,5)){const base=[...result];while(true){let best=null;const lo=Math.floor(base.length/3),hi=Math.ceil(base.length*2/3);
   for(let k=lo;k<=hi;k++){const t=[...base];t.splice(k,0,f);if(fits(t)&&(!best||legs(t)<legs(best)))best=t;}
   if(best)return best;if(!base.length)break;base.pop();}}
 }
 return result;
}
// Try several distinct, constraint-respecting plans without paid AI. Defaults reproduce
// the original generator on the first option; subsequent runs penalize already suggested places.
// An exhausted/very small catalogue may legitimately return fewer than requested options.
export function generateAlternatives(places,prefs,{count=3,history=[]}={}){
 const result=[],used=new Map(),signatures=new Set();
 const signature=ps=>ps.map(p=>typeof p==='string'?p:p.id).slice().sort().join('|');
 for(const prior of history){
  if(!Array.isArray(prior)||!prior.length)continue;
  signatures.add(signature(prior));
  for(const item of prior){const id=typeof item==='string'?item:item?.id;if(id)used.set(id,(used.get(id)||0)+1);}
 }
 const limit=Math.max(1,Math.min(5,Math.trunc(Number(count)||3)));
 for(let attempt=0;attempt<48&&result.length<limit;attempt++){
  const freshFirst=!history.length&&!result.length&&attempt===0;
  const variantPrefs=freshFirst?prefs:{...prefs,variantIndex:attempt+1,diversityCounts:Object.fromEntries(used),diversityWeight:7+(attempt%6)*1.2};
  const candidate=generate(places,variantPrefs);
  if(!candidate.length)continue;
  const key=signature(candidate);
  if(signatures.has(key)||!distinctRoute(candidate,[...result,...history]))continue;
  // A slightly reordered or near-identical set is not a new suggestion.
  signatures.add(key);result.push(candidate);
  for(const p of candidate)used.set(p.id,(used.get(p.id)||0)+1);
 }
 return result;
}
export function advance(session,status){
 if(!session||session.finished||!['done','skip'].includes(status))return session;
 const next={...session,results:[...session.results,{id:session.stops[session.index],status}],index:session.index+1};
 next.finished=next.index>=next.stops.length;return next;
}
export function mapsUrl(p,transport='walking'){
 return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${transport==='bike'?'bicycling':transport==='transit'?'transit':'walking'}`;
}

// Combined score across platforms: every review counts once, wherever it was written.
export function combinedRating(ratings=[]){
 const parts=ratings.filter(s=>Number.isFinite(s.value)&&Number.isSafeInteger(s.reviewCount)&&s.reviewCount>0);
 return {value:blendedRating(parts,{weighted:true}),total:parts.reduce((n,s)=>n+s.reviewCount,0),parts};
}
// One Google Maps link for a whole route: start from wherever the phone is, then every stop in order.
export function routeMapsUrl(stops,transport='walking'){
 if(!stops.length)return '';const pt=p=>`${p.lat},${p.lng}`,last=stops.at(-1),via=stops.slice(0,-1).slice(0,9);
 return `https://www.google.com/maps/dir/?api=1&destination=${pt(last)}${via.length?'&waypoints='+via.map(pt).join('%7C'):''}&travelmode=${transport==='bike'?'bicycling':transport==='transit'?'transit':'walking'}`;
}
// Reads coordinates from a pasted Google Maps link (@lat,lng or ?q=lat,lng) or a plain "lat, lng".
export function parseLocation(text){
 let s=String(text||'').trim();try{s=decodeURIComponent(s);}catch{}
 const number='(-?\\d{1,3}(?:\\.\\d+)?)';
 // Place coordinates take precedence over the camera position in Google URLs.
 let m=s.match(new RegExp('!3d'+number+'!4d'+number));
 if(!m){try{const u=new URL(s);for(const key of ['query','q','ll','destination']){const v=u.searchParams.get(key);if(v){const r=parseLocation(v);if(r)return r;}}}catch{}}
 if(!m)m=s.match(new RegExp('@'+number+',\\s*'+number));
 if(!m){const plain=s.replace(/^(?:geo:)/i,'').trim();m=plain.match(new RegExp('^'+number+'\\s*[,;\\s]\\s*'+number+'$'));}
 // Polish decimal commas, separated by semicolon (52,23; 21,01).
 if(!m){const pl=s.match(/^(-?\d{1,3},\d+)\s*;\s*(-?\d{1,3},\d+)$/);if(pl)m=[pl[0],pl[1].replace(',','.'),pl[2].replace(',','.')];}
 if(!m)return null;const lat=Number(m[1]),lng=Number(m[2]);return lat>=-90&&lat<=90&&lng>=-180&&lng<=180?{lat,lng}:null;
}
export function moveStop(ids,from,to){const result=[...ids],a=result.indexOf(from),b=result.indexOf(to);if(a<0||b<0||a===b)return result;result.splice(b,0,result.splice(a,1)[0]);return result;}
export const fold=s=>String(s??'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'');
export function matches(text,query){const words=fold(query).split(/\s+/).filter(Boolean),hay=fold(text);return words.every(w=>hay.includes(w));}

export function blendedRating(scores,{weighted=false}={}){
 const valid=scores.filter(s=>Number.isFinite(s.value)&&Number.isFinite(s.max)&&s.max>0&&s.value>=0&&s.value<=s.max&&(!weighted||(Number.isSafeInteger(s.reviewCount)&&s.reviewCount>0)));
 const total=valid.reduce((n,s)=>n+(weighted?s.reviewCount:1),0);
 return total?valid.reduce((n,s)=>n+s.value/s.max*5*(weighted?s.reviewCount:1),0)/total:null;
}

