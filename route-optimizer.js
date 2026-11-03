// ROUTE-OPT-016 — pure route order optimizer.
// Exact shortest open path (<= 12 stops), deterministic multi-start 2-opt above 12.
// This minimizes an estimated straight-line distance, NOT real walking/transit travel
// times; road routing can later supply a provider-backed time matrix.
import {distance} from './core.js';

const SPEED_KMH={walking:4.5,bike:12,transit:8,mix:6};
const ROAD_FACTOR=1.3;
const EPS=1e-8;
const valid=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Number(p.lat)>=-90&&Number(p.lat)<=90&&Number(p.lng)>=-180&&Number(p.lng)<=180;
const km=(a,b)=>distance(a,b)*ROAD_FACTOR;
const speed=t=>SPEED_KMH[t]||SPEED_KMH.walking;
const legCost=(a,b)=>a?km(a,b):0;

export function estimatedTravelMinutes(places,{origin=null,transport='walking'}={}){
  if(!Array.isArray(places)||!places.every(valid)||(origin&&!valid(origin)))return null;
  let total=origin&&places.length?legCost(origin,places[0]):0;
  for(let i=1;i<places.length;i++)total+=legCost(places[i-1],places[i]);
  return total/speed(transport)*60;
}

function exactOrder(places,{origin,keepFirst}){
  const n=places.length,size=1<<n,full=size-1;
  const costs=places.map(a=>places.map(b=>legCost(a,b)));
  const initial=places.map(p=>legCost(origin,p));
  const dp=new Float64Array(size*n);dp.fill(Infinity);
  const prev=new Int8Array(size*n);prev.fill(-1);
  for(let i=0;i<n;i++){if(keepFirst&&i!==0)continue;dp[(1<<i)*n+i]=initial[i];}
  for(let mask=1;mask<size;mask++)for(let last=0;last<n;last++){
    if(!(mask&(1<<last)))continue;
    const value=dp[mask*n+last];if(!Number.isFinite(value))continue;
    for(let next=0;next<n;next++){
      const bit=1<<next;if(mask&bit)continue;
      const newMask=mask|bit,k=newMask*n+next,v=value+costs[last][next];
      if(v<dp[k]-EPS){dp[k]=v;prev[k]=last;}
    }
  }
  let last=-1,best=Infinity;
  for(let i=0;i<n;i++){const v=dp[full*n+i];if(v<best-EPS){best=v;last=i;}}
  if(last<0)return places;
  const order=[],maskStack=[];let mask=full;
  while(last>=0){order.push(last);maskStack.push(mask);const previous=prev[mask*n+last];mask^=1<<last;last=previous;}
  return order.reverse().map(i=>places[i]);
}

function greedyOrder(places,start,origin){
  const pending=places.map((_,i)=>i).filter(i=>i!==start),ids=[start];
  while(pending.length){
    const last=places[ids.at(-1)];
    pending.sort((a,b)=>legCost(last,places[a])-legCost(last,places[b])||a-b);
    ids.push(pending.shift());
  }
  return ids.map(i=>places[i]);
}
function improve(places,opts){
  let order=places,best=estimatedTravelMinutes(order,opts),changed=true,passes=0;
  while(changed&&passes++<12){changed=false;
    for(let i=opts.keepFirst?1:0;i<order.length-1;i++)for(let j=i+1;j<order.length;j++){
      const candidate=[...order.slice(0,i),...order.slice(i,j+1).reverse(),...order.slice(j+1)];
      const val=estimatedTravelMinutes(candidate,opts);
      if(val<best-EPS){order=candidate;best=val;changed=true;}
    }
  }
  return order;
}
function heuristicOrder(places,opts){
  let best=places,score=estimatedTravelMinutes(best,opts);
  for(let i=0;i<places.length;i++){
    if(opts.keepFirst&&i!==0)continue;
    const candidate=improve(greedyOrder(places,i,opts.origin),opts);
    const val=estimatedTravelMinutes(candidate,opts);
    if(val<score-EPS){best=candidate;score=val;}
  }
  return best;
}

export function optimizeRoutePlaces(places,{origin=null,transport='walking',keepFirst=false}={}){
  const input=Array.isArray(places)?places:[];
  const opts={origin,transport,keepFirst};
  const before=estimatedTravelMinutes(input,opts);
  if(input.length<2||before==null)return {places:[...input],status:before==null?'invalid-coordinates':'no-change',changed:false,estimatedBeforeMinutes:before,estimatedAfterMinutes:before,estimatedSavingsMinutes:0,method:'distance-estimate'};
  const proposal=input.length<=12?exactOrder(input,opts):heuristicOrder(input,opts);
  const after=estimatedTravelMinutes(proposal,opts);
  const changed=after<before-EPS;
  return {places:changed?proposal:[...input],status:changed?'optimized':'no-change',changed,estimatedBeforeMinutes:before,estimatedAfterMinutes:changed?after:before,estimatedSavingsMinutes:changed?before-after:0,method:'distance-estimate',optimality:input.length<=12?'exact':'heuristic'};
}
