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
export function generate(places,prefs){
 const limit=Number(prefs.time), interests=prefs.interests||['mix'];
 const candidates=places.filter(p=>p.kind!=='hotel'&&(prefs.food!=='none'||p.foodStyle==='none')&&(prefs.food!=='quick'||p.foodStyle!=='sit')&&(prefs.food!=='sit'||p.foodStyle!=='quick')&&(prefs.offers==='yes'||!p.partner)&&(prefs.budget!=='low'||p.cost<=25));
 const score=p=>(interests.includes('mix')?1:p.tags.filter(t=>interests.includes(t)).length*4)+(prefs.tourist==='balanced'?0:prefs.tourist==='must'?(p.tourist==='must'?3:0):(p.tourist==='local'?3:0));
 candidates.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
 const result=[];let cost=0;const cap=prefs.budget==='low'?25:prefs.budget==='medium'?100:Infinity;
 while(candidates.length){
  candidates.sort((a,b)=>(score(b)-(result.length?distance(result.at(-1),b)*2:0))-(score(a)-(result.length?distance(result.at(-1),a)*2:0)));
  const p=candidates.shift();if(cost+p.cost>cap)continue;
  if(summary([...result,p],prefs.transport).minutes<=limit){result.push(p);cost+=p.cost;}
  if(result.length>=10)break;
 }return result;
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
export const fold=s=>String(s??'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'');
export function matches(text,query){const words=fold(query).split(/\s+/).filter(Boolean),hay=fold(text);return words.every(w=>hay.includes(w));}

export function blendedRating(scores,{weighted=false}={}){
 const valid=scores.filter(s=>Number.isFinite(s.value)&&Number.isFinite(s.max)&&s.max>0&&s.value>=0&&s.value<=s.max&&(!weighted||(Number.isSafeInteger(s.reviewCount)&&s.reviewCount>0)));
 const total=valid.reduce((n,s)=>n+(weighted?s.reviewCount:1),0);
 return total?valid.reduce((n,s)=>n+s.value/s.max*5*(weighted?s.reviewCount:1),0)/total:null;
}
