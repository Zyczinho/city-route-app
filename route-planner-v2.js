import {distinctRoute} from './route-diversity.js';
// Planner V2 engine: bounded beam search over catalogue POIs, pure and deterministic.
// No provider calls or cost-bearing API usage.
// Route timing is an estimate until a real, separately supplied leg matrix validates it.
import {distance} from './core.js';
import {isRouteFoodPlace,isExcludedRoutePlace,normalizeRouteInterests,routeInterestMatch,canViewRouteExterior,canViewRouteFacade,routeAllowedByFocus,routeBudgetLimit,routeKnownCost,routeBudgetEligible,routeBreakSuitable} from './route-preferences.js';
import {openingFor,validDate,visitSlot,clockLabel} from './opening-hours.js';

const SPEED={walking:4.5,bike:12,mix:6};
const STAY=new Set(['hotel','hostel','guesthouse','apartment']);
const MUSEUM=new Set(['museum','gallery']);
const MINUTES_BY_CAT={museum:75,gallery:50,park:30,landmark:20,viewpoint:20,restaurant:60,cafe:35,street_food:30,club:90};
// Longest idle wait before a venue opens. A longer gap means "start later", not "stand outside the door".
const MAX_WAIT_MINUTES=45;
// Food stops allowed when the user picked the food theme (the requested break is extra).
const MAX_THEME_FOOD=4;
// Evening plans may continue after midnight (clubs open at 23:00 or 00:00); never past 06:00.
const LATEST_END_MINUTE=30*60;
const LATEST_START_MINUTE=23*60+30;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const hasCoords=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))
  &&Number(p.lat)>=-90&&Number(p.lat)<=90&&Number(p.lng)>=-180&&Number(p.lng)<=180;
const idOf=p=>String(p.id??'');
const minutesOf=p=>clamp(Number(p.minutes)||MINUTES_BY_CAT[p.categoryId]||20,5,240);
const clockToMinutes=s=>{
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)))return NaN;
  const [h,m]=s.split(':').map(Number);return h*60+m;
};
const foodPlace=isRouteFoodPlace;
const foodThemeOf=interests=>interests.some(id=>['food','jedzenie'].includes(id));
const museumPlace=p=>MUSEUM.has(p.categoryId)||Array.isArray(p.cats)&&p.cats.includes('muzea');
const nightlife=p=>['bar','pub','cocktail_bar','wine_bar','club','live_music'].includes(p.categoryId);
const groupOf=p=>{
  const c=p.categoryId||'', t=Array.isArray(p.cats)?p.cats:[];
  if(museumPlace(p))return 'museum';
  if(['restaurant','cafe','street_food','bakery','food_hall','breakfast','dessert'].includes(c)||foodPlace(p))return 'food';
  if(routeInterestMatch(p,'nature'))return 'nature';
  if(nightlife(p))return 'nightlife';
  if(['landmark','architecture','religious_site','viewpoint'].includes(c)||t.includes('zabytki'))return 'sight';
  return c||t[0]||'other';
};
function fitOf(p,interests,tourist){
  const tags=Array.isArray(p.tags)?p.tags:[];
  let fit=interests.includes('mix')?2:0;
  for(const interest of interests){
    if(interest==='mix')continue;
    if(routeInterestMatch(p,interest))fit+=7;
    if(tags.includes(interest))fit+=3;
  }
  if(tourist==='must'&&p.tourist==='must')fit+=2.5;
  if(tourist==='local'&&p.tourist==='local')fit+=2.5;
  if(p.top&&tourist!=='local')fit+=1;
  // Deliberately no ratings/review-count minimum, and no auto-ranking by review volume.
  // A thematic trip should not turn into eight nearby but unrelated quick stops.
  return (interests.includes('mix')?4:fit>0?6:-3)+fit;
}
function budgetLimit(prefs){return routeBudgetLimit(prefs);}
// Returns null when the place is eligible, otherwise the reason it was left out (for honest messages).
function rejectionOf(p,prefs,interests){
  if(!p||!p.id||!hasCoords(p))return 'invalid';
  if(STAY.has(p.categoryId)||p.kind==='hotel')return 'stay';
  if(prefs.cityId&&p.cityId&&p.cityId!==prefs.cityId)return 'other-city';
  if(isExcludedRoutePlace(p,prefs.avoid))return 'excluded';
  // The requested break is its own slot, so a café may join a route made "only" of bars.
  const breakVenue=foodPlace(p)&&!!prefs.food&&prefs.food!=='none'&&routeBreakSuitable(p,prefs.food);
  if(!breakVenue&&!routeAllowedByFocus(p,prefs))return 'not-selected';
  if(!routeBudgetEligible(p,prefs)||Number.isNaN(budgetLimit(prefs)))return 'budget';
  if(Array.isArray(prefs.allowedAreas)&&prefs.allowedAreas.length&&!prefs.allowedAreas.includes(p.area))return 'area';
  if(Number(prefs.maxRadiusKm)>0&&hasCoords(prefs.start)&&distance(p,prefs.start)>Number(prefs.maxRadiusKm))return 'too-far';
  if(prefs.visitMode==='outside'&&!canViewRouteExterior(p))return 'inside-only';
  if(prefs.offers!=='yes'&&p.partner)return 'partner';
  // Food is a theme stop when "Jedzenie" is chosen, otherwise only the requested break venue.
  if(foodPlace(p)&&!foodThemeOf(interests)&&!(prefs.food&&prefs.food!=='none'&&routeBreakSuitable(p,prefs.food)))return 'food-not-requested';
  if(nightlife(p)&&!interests.some(id=>routeInterestMatch(p,id)))return 'nightlife-not-requested';
  return null;
}
function candidatePool(raw,prefs,opts){
  const interests=normalizeRouteInterests(prefs.interests);
  const origin=hasCoords(prefs.start)?prefs.start:(hasCoords(opts.origin)?opts.origin:null);
  const all=new Map(),rejected={};
  for(const p of Array.isArray(raw)?raw:[]){
    const reason=rejectionOf(p,prefs,interests);
    if(reason){rejected[reason]=(rejected[reason]||0)+1;continue;}
    if(!all.has(idOf(p)))all.set(idOf(p),p);
  }
  const ranked=[...all.values()].map(p=>{
    const affinity=fitOf(p,interests,prefs.tourist||'balanced');
    const distancePenalty=origin?distance(origin,p)*0.9:0;
    return {p,affinity,rank:affinity-distancePenalty};
  }).sort((a,b)=>b.rank-a.rank||idOf(a.p).localeCompare(idOf(b.p)));
  const limit=clamp(Math.trunc(Number(opts.candidateLimit)||80),20,120);
  // Avoid a top-N cut that consists solely of a single category, area or data source.
  const selected=[],cellCounts=new Map(),groupCounts=new Map();
  const maybeAdd=(item,relaxed=false)=>{
    const p=item.p,group=groupOf(p);
    const cell=`${Math.floor(Number(p.lat)*75)}:${Math.floor(Number(p.lng)*48)}:${group}`;
    if(!relaxed&&((cellCounts.get(cell)||0)>=5||(groupCounts.get(group)||0)>=24))return false;
    selected.push(item);
    cellCounts.set(cell,(cellCounts.get(cell)||0)+1);
    groupCounts.set(group,(groupCounts.get(group)||0)+1);
    return true;
  };
  // A requested break needs suitable venues in the shortlist even when sights dominate the ranking.
  if(prefs.food&&prefs.food!=='none'){
    const breakItems=ranked.filter(item=>routeBreakSuitable(item.p,prefs.food)).sort((a,b)=>{
      const da=origin?distance(origin,a.p):0;
      const db=origin?distance(origin,b.p):0;
      return da-db||b.rank-a.rank||idOf(a.p).localeCompare(idOf(b.p));
    }).slice(0,12);
    for(const item of breakItems)maybeAdd(item,true);
  }
  const pinned=new Set(selected.map(x=>idOf(x.p)));
  for(const item of ranked){if(selected.length>=limit)break;if(!pinned.has(idOf(item.p))&&maybeAdd(item))pinned.add(idOf(item.p));}
  if(selected.length<limit){
    const taken=new Set(selected.map(x=>idOf(x.p)));
    for(const item of ranked){if(selected.length>=limit)break;if(!taken.has(idOf(item.p))){maybeAdd(item,true);taken.add(idOf(item.p));}}
  }
  return {interests,origin,candidates:selected,eligible:ranked.map(x=>x.p),eligibleCount:ranked.length,rejected};
}
function matrixEntry(matrix,from,to){
  if(!matrix||!from||!to)return null;
  const key=`${idOf(from)}>${idOf(to)}`;
  const entry=matrix instanceof Map?matrix.get(key):matrix[key];
  if(Number.isFinite(entry)&&entry>=0)return {minutes:entry,source:'provided-matrix'};
  if(entry&&Number.isFinite(entry.minutes)&&entry.minutes>=0)return {minutes:entry.minutes,source:entry.source||'provided-matrix'};
  return null;
}
function legEstimate(from,to,mode,matrix){
  if(!from)return {minutes:0,source:'start-unspecified'};
  const entry=matrixEntry(matrix,from,to);
  if(entry)return entry;
  if(!(mode in SPEED))return null; // Never invent a public-transit timetable.
  return {minutes:Math.ceil(distance(from,to)*1.3/SPEED[mode]*60),source:'straight-line-estimate'};
}
// The requested break must interrupt sightseeing at a sensible time, never open or close the route.
function breakWindowOk(ctx,visitStart){
  if(ctx.food==='sit'){
    const isLunch=ctx.start<15*60;
    const earliest=isLunch?11*60+30:18*60,latest=isLunch?15*60:22*60;
    return visitStart>=earliest&&visitStart<=latest;
  }
  return visitStart>=ctx.start+45&&visitStart<=ctx.start+ctx.maxMinutes-25;
}
const sameStopSet=stops=>stops.map(p=>idOf(p)).sort().join('|');
function stepState(state,item,ctx){
  const p=item.p;
  if(state.ids.has(idOf(p)))return null;
  const isFood=foodPlace(p);
  const mayBreak=isFood&&ctx.mealRequired&&!state.breakCount&&state.stops.length>0&&routeBreakSuitable(p,ctx.food);
  const mayTheme=isFood&&ctx.foodTheme&&state.themeFood<MAX_THEME_FOOD;
  if(isFood&&!mayBreak&&!mayTheme)return null;
  const origin=state.stops.length?state.stops.at(-1):ctx.origin;
  const leg=legEstimate(origin,p,ctx.transport,ctx.matrix);
  if(!leg)return null;
  const travel=Math.ceil(leg.minutes);
  let dwell=Math.max(1,minutesOf(p));
  let hours=openingFor(p,{cityId:ctx.cityId,date:ctx.date,mode:ctx.visitMode});
  if(hours.minVisit)dwell=Math.max(dwell,hours.minVisit);
  const rest=state.stops.length&&state.activeSinceBreak+travel+dwell>ctx.restInterval?ctx.restMinutes:0;
  const start=ctx.start+state.minutes+travel+rest;
  let slot=hours.status==='closed'?null:visitSlot(hours,start,dwell,{maxWait:MAX_WAIT_MINUTES});
  // Mixed viewing uses the outside only when a facade visit makes sense (a church yes, a closed bar no).
  if(!slot&&ctx.visitMode==='mix'&&canViewRouteFacade(p)){
    hours={status:'exterior',label:'Z zewnątrz'};
    dwell=Math.min(dwell,Math.max(5,Number(p.outsideMinutes)||20));
    slot={visitStart:start,wait:0};
  }
  if(!slot)return null;
  const waiting=slot.wait,visitStart=slot.visitStart,done=visitStart+dwell;
  let role='stop';
  if(isFood){
    if(mayBreak&&breakWindowOk(ctx,visitStart))role='break';
    else if(mayTheme)role='theme-food';
    else return null;
  }
  if(done-ctx.start>ctx.maxMinutes||done>ctx.latestEnd)return null;
  const nextCost=state.cost+(routeKnownCost(p)??0);
  if(nextCost>ctx.maxCost)return null;
  const repeated=state.groups[groupOf(p)]||0;
  const noveltyPenalty=repeated*3;
  const improvement=item.affinity+3-noveltyPenalty-travel*0.08-waiting*0.035;
  const unverified=hours.status==='unknown'||hours.status==='typical'||(
    hours.status==='not-applicable'&&(isFood||nightlife(p))
  );
  return {
    stops:[...state.stops,p],ids:new Set([...state.ids,idOf(p)]),
    rows:[...state.rows,{id:idOf(p),name:p.name,role,travelMinutes:travel,visitMinutes:dwell,restMinutes:rest,waitMinutes:waiting,arrivalMinute:start,visitStartMinute:visitStart,departureMinute:done,hoursStatus:hours.status,hoursLabel:hours.label||'',closesMinute:Number.isFinite(slot.closes)?slot.closes:null,travelSource:leg.source}],
    minutes:done-ctx.start,travel:state.travel+travel,visit:state.visit+dwell,rest:state.rest+rest,wait:state.wait+waiting,
    activeSinceBreak:(rest?0:state.activeSinceBreak)+travel+dwell,
    cost:nextCost,score:state.score+improvement,
    foodCount:state.foodCount+(isFood?1:0),
    breakCount:state.breakCount+(role==='break'?1:0),
    breakIndex:role==='break'?state.stops.length:state.breakIndex,
    themeFood:state.themeFood+(role==='theme-food'?1:0),
    unknownCount:state.unknownCount+(unverified?1:0),
    estimatedLegs:state.estimatedLegs+(leg.source==='straight-line-estimate'?1:0),
    groups:{...state.groups,[groupOf(p)]:repeated+1}
  };
}
const hasRequestedBreak=s=>s.breakCount===1&&s.stops.length>=3&&s.breakIndex<s.stops.length-1;
function bestSolutions(solutions,limit,mandatoryBreak,history=[]){
  const excluded=new Set(history.filter(s=>Array.isArray(s)&&s.length).map(s=>s.map(p=>typeof p==='string'?p:idOf(p)).sort().join('|')));
  // The break is a soft slot: if no venue fits, keep the route and say so instead of returning nothing.
  let pool=mandatoryBreak?solutions.filter(hasRequestedBreak):solutions,breakDropped=false;
  if(mandatoryBreak&&!pool.length){pool=solutions.filter(s=>!s.breakCount);breakDropped=pool.length>0;}
  const sorted=pool.sort((a,b)=>b.score-a.score||b.stops.length-a.stops.length||a.minutes-b.minutes||sameStopSet(a.stops).localeCompare(sameStopSet(b.stops)));
  const chosen=[],seen=new Set(),previous=history.filter(Array.isArray);
  for(const s of sorted){
    const signature=sameStopSet(s.stops);
    if(seen.has(signature)||excluded.has(signature))continue;
    if(!distinctRoute(s.stops,[...chosen.map(x=>x.stops),...previous]))continue;
    chosen.push(s);seen.add(signature);
    if(chosen.length>=limit)break;
  }
  // Fresh requests still return an actual plan if the catalogue cannot support several.
  if(!chosen.length&&!previous.length&&sorted.length)chosen.push(sorted[0]);
  return {chosen,breakDropped};
}
// For each chosen interest: how many eligible places are open at some point of the visit window,
// and, when none is, the earliest start time at which a few of them are.
function interestCoverage(eligible,interests,ctx){
  const end=ctx.start+ctx.maxMinutes;
  return interests.filter(id=>id!=='mix').map(id=>{
    const places=eligible.filter(p=>routeInterestMatch(p,id));
    let open=0;const timed=[];
    for(const p of places){
      const hours=openingFor(p,{cityId:ctx.cityId,date:ctx.date,mode:ctx.visitMode});
      if(hours.status==='closed'){timed.push([]);continue;}
      if(!Array.isArray(hours.intervals)){open++;continue;}
      timed.push(hours.intervals);
      if(hours.intervals.some(([o,c])=>Math.max(o,ctx.start)+30<=Math.min(c,end)))open++;
    }
    const suggested=open||!places.length?null:suggestStart(timed,ctx);
    return {id,total:places.length,open,suggestedStart:Number.isFinite(suggested)?clockLabel(suggested):null};
  });
}
function suggestStart(timed,ctx){
  const withHours=timed.filter(x=>x.length).length;
  if(!withHours)return null;
  const need=Math.min(3,withHours),span=Math.min(ctx.maxMinutes,120);
  const enough=t=>timed.filter(iv=>iv.some(([o,c])=>o<=t&&t+span<=c)).length>=need;
  const latest=Math.min(LATEST_START_MINUTE,ctx.latestEnd-span);
  for(let t=Math.ceil((ctx.start+1)/30)*30;t<=latest;t+=30)if(enough(t))return t;
  for(let t=6*60;t<ctx.start;t+=30)if(enough(t))return t;
  return null;
}
/**
 * Bounded, deterministic orienteering search.
 * @param {Array} places published POIs from the selected city's catalogue
 * @param {Object} prefs same basic shape as the legacy generator; date/startTime required
 * @param {Object} opts candidateLimit, beamWidth, maxExpansions, matrix (directed leg durations by "a>b"), history (previous stop-id arrays)
 * @returns {{routes:Array,diagnostics:Object,reason?:string,hints:Object}}
 */
export function planRoutesV2(places,prefs={},opts={}){
  const maxMinutes=Number(prefs.time),date=prefs.visitDate,start=clockToMinutes(prefs.startTime);
  if(!validDate(date)||!Number.isFinite(start)||!(maxMinutes>0&&maxMinutes<=1440))
    return {routes:[],diagnostics:{evaluated:0},reason:'invalid-date-or-budget',hints:{interests:[]}};
  const candidateData=candidatePool(places,prefs,opts);
  const mode=prefs.transport||'walking';
  const ctx={
    origin:candidateData.origin,matrix:opts.matrix||null,transport:mode,
    cityId:prefs.cityId||'warsaw',date,start,maxMinutes,latestEnd:LATEST_END_MINUTE,
    maxCost:budgetLimit(prefs),visitMode:prefs.visitMode||'inside',food:prefs.food||'none',
    mealRequired:!!prefs.food&&prefs.food!=='none',
    foodTheme:foodThemeOf(candidateData.interests),
    restInterval:Math.max(60,Number(opts.restInterval)||105),
    restMinutes:Math.max(0,Number.isFinite(Number(opts.restMinutes))?Number(opts.restMinutes):10)
  };
  const beamWidth=clamp(Math.trunc(Number(opts.beamWidth)||40),4,90);
  const maxExpansions=clamp(Math.trunc(Number(opts.maxExpansions)||25000),100,100000);
  const maxStops=clamp(Math.trunc(Number(opts.maxStops)||8),1,10);
  const empty={stops:[],ids:new Set(),rows:[],minutes:0,travel:0,visit:0,rest:0,wait:0,activeSinceBreak:0,cost:0,score:0,foodCount:0,breakCount:0,breakIndex:-1,themeFood:0,unknownCount:0,estimatedLegs:0,groups:{}};
  let frontier=[empty],evaluated=0,feasibleStates=0;
  const solutions=[];
  for(let level=0;level<maxStops&&frontier.length&&evaluated<maxExpansions;level++){
    const expanded=[];
    for(const state of frontier){
      for(const item of candidateData.candidates){
        if(evaluated++>=maxExpansions)break;
        const next=stepState(state,item,ctx);
        if(!next)continue;
        feasibleStates++;
        solutions.push(next);
        expanded.push(next);
      }
      if(evaluated>=maxExpansions)break;
    }
    expanded.sort((a,b)=>b.score-a.score||a.minutes-b.minutes||sameStopSet(a.stops).localeCompare(sameStopSet(b.stops)));
    const seen=new Set();frontier=[];
    const addState=candidate=>{
      const key=`${sameStopSet(candidate.stops)}|${candidate.stops.at(-1).id}`;
      if(seen.has(key)||frontier.length>=beamWidth)return;
      seen.add(key);frontier.push(candidate);
    };
    // Preserve partial routes that already contain the break; otherwise higher-scoring museums can
    // monopolize the beam and make a requested café mathematically unreachable.
    if(ctx.mealRequired){
      const reserve=Math.ceil(beamWidth*.3);
      let picked=0;
      for(const candidate of expanded){if(candidate.breakCount!==1)continue;addState(candidate);if(++picked>=reserve)break;}
    }
    for(const candidate of expanded){if(frontier.length>=beamWidth)break;addState(candidate);}
  }
  const {chosen:picked,breakDropped}=bestSolutions(solutions,clamp(Math.trunc(Number(opts.count)||3),1,5),ctx.mealRequired,opts.history||[]);
  const coverage=interestCoverage(candidateData.eligible,candidateData.interests,ctx);
  const closedInterests=coverage.filter(c=>c.total>0&&c.open===0);
  const relaxations=breakDropped?['break-dropped']:[];
  let reason=null;
  if(!picked.length){
    if(mode==='transit'&&!ctx.matrix)reason='transit-matrix-required';
    else if(!candidateData.eligibleCount)reason='no-candidates';
    else if(coverage.length&&coverage.every(c=>c.total>0&&c.open===0))reason='interests-closed';
    else reason='no-feasible-route';
  }
  return {
    routes:picked.map((s,index)=>({
      id:`v2-${index+1}`,stops:s.stops,stopIds:s.stops.map(p=>idOf(p)),rows:s.rows,
      totalMinutes:s.minutes,breakdown:{travel:s.travel,visits:s.visit,wait:s.wait,rests:s.rest},
      cost:s.cost,unpricedStops:s.stops.filter(p=>routeKnownCost(p)===null).length,score:Number(s.score.toFixed(3)),unknownHours:s.unknownCount,estimatedLegs:s.estimatedLegs,
      breakStopId:s.breakCount?idOf(s.stops[s.breakIndex]):null,
      relaxations:[...relaxations],closedInterests:closedInterests.map(c=>({...c})),
      timingQuality:s.estimatedLegs>0?'approximate':(s.rows.some(r=>r.travelSource!=='start-unspecified')?'supplied-matrix':'no-travel')
    })),
    diagnostics:{
      catalogSize:Array.isArray(places)?places.length:0,eligibleCount:candidateData.eligibleCount,
      candidateCount:candidateData.candidates.length,evaluated,feasibleStates,
      selectedRoutes:picked.length,mode,hasOrigin:!!ctx.origin,
      matrixProvided:!!ctx.matrix,maximumExpansions:maxExpansions,
      rejected:candidateData.rejected
    },
    hints:{interests:coverage,closedInterests,relaxations},
    reason
  };
}
