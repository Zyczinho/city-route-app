// Deterministic, offline benchmark on the actual checked-in Warsaw catalogue.
// Run: node scripts/evaluate-planner-v2.mjs
// No paid API requests. Travel times remain explicitly approximate.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {planRoutesV2} from '../route-planner-v2.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
export const WARSAW_EDITORIAL=read('../data/places.json');
export const WARSAW_OSM=read('../data/cities/warsaw/places.json');
export const WARSAW_CATALOGUE=[...WARSAW_EDITORIAL,...WARSAW_OSM];
const origin=(lat,lng)=>({lat,lng,id:'test-origin'});
const base={cityId:'warsaw',transport:'walking',offers:'no',tourist:'balanced',budget:'premium',food:'none',visitMode:'inside',visitDate:'2026-11-07',startTime:'10:00'};
export const SCENARIOS=[
  {name:'01 — Starówka 2 godziny',time:120,start:origin(52.249,21.012),interests:['sightseeing']},
  {name:'02 — Zieleń w centrum 4 godziny',time:240,start:origin(52.221,21.012),interests:['nature']},
  {name:'03 — Muzea, sobota 4 godziny',time:240,start:origin(52.232,21.023),interests:['culture'],visitMode:'inside'},
  {name:'04 — Historia bez muzeów 3 godziny',time:180,start:origin(52.249,21.013),interests:['culture','sightseeing'],visitMode:'outside'},
  {name:'05 — Widoki nad Wisłą 4 godziny',time:240,start:origin(52.236,21.030),interests:['views','nature'],visitMode:'outside'},
  {name:'06 — Nieoczywista Praga 4 godziny',time:240,start:origin(52.256,21.042),interests:['hidden','sightseeing'],tourist:'local',maxRadiusKm:2.5,allowedAreas:['Praga','Praga-Północ','Praga-Południe']},
  {name:'07 — Must-see 6 godzin',time:360,start:origin(52.233,21.009),interests:['sightseeing'],tourist:'must'},
  {name:'08 — Lokalny spacer 8 godzin',time:480,start:origin(52.230,21.052),interests:['nature','hidden'],tourist:'local'},
  {name:'09 — Kultura i kawa 4 godziny',time:240,start:origin(52.232,21.019),interests:['culture'],food:'quick'},
  {name:'10 — Zwiedzanie z obiadem 6 godzin',time:360,start:origin(52.221,21.018),interests:['sightseeing','food'],food:'sit'}
];
const INTEREST_CATEGORY={
  sightseeing:['landmark','architecture','religious_site','neighborhood','viewpoint'],
  culture:['museum','gallery','religious_site','architecture'],
  nature:['park','garden','waterfront','beach','walk'],
  views:['viewpoint','waterfront','architecture'],
  hidden:['hidden_gem','neighborhood','workshop','experience'],
  food:['restaurant','cafe','street_food','food_hall','bakery','dessert'],
  nightlife:['bar','pub','cocktail_bar','wine_bar','club','live_music']
};
const group=p=>{
  if(['museum','gallery'].includes(p.categoryId)||p.cats?.includes('muzea'))return 'museum';
  if(['park','garden','waterfront','walk','beach'].includes(p.categoryId)||p.cats?.includes('zielen'))return 'nature';
  if(['restaurant','cafe','street_food','food_hall','bakery','dessert'].includes(p.categoryId)||p.foodStyle!=='none'&&p.foodStyle)return 'food';
  if(['bar','pub','club','cocktail_bar'].includes(p.categoryId))return 'nightlife';
  return p.categoryId||p.cats?.[0]||'sight';
};
function qualitySignals(route,prefs){
  if(!route)return {interestFitPercent:0,categoryGroups:0,travelSharePercent:0,timeUsedPercent:0,alerts:['no-route']};
  const interestMatch=p=>(prefs.interests||['mix']).some(interest=>
    interest==='mix'||p.tags?.includes(interest)||
    INTEREST_CATEGORY[interest]?.includes(p.categoryId)||
    interest==='sightseeing'&&p.cats?.includes('zabytki')||
    interest==='culture'&&p.cats?.includes('muzea')||
    interest==='nature'&&p.cats?.includes('zielen')
  )||(prefs.food!=='none'&&p.foodStyle&&p.foodStyle!=='none');
  const interestFitPercent=Math.round(route.stops.filter(interestMatch).length/route.stops.length*100);
  const categoryGroups=new Set(route.stops.map(group)).size;
  const travelSharePercent=Math.round(route.breakdown.travel/route.totalMinutes*100);
  const timeUsedPercent=Math.round(route.totalMinutes/prefs.time*100);
  const alerts=[];
  if(interestFitPercent<60)alerts.push('low-thematic-fit');
  if(travelSharePercent>40)alerts.push('travel-heavy');
  if(timeUsedPercent<50)alerts.push('underfilled');
  if(route.unknownHours)alerts.push('venue-hours-unverified');
  if(route.estimatedLegs)alerts.push('street-times-unverified');
  return {interestFitPercent,categoryGroups,travelSharePercent,timeUsedPercent,alerts};
}
export function runBenchmark(){
  const osmIds=new Set(WARSAW_OSM.map(p=>p.id));
  return SCENARIOS.map(({name,...config})=>{
    const prefs={...base,...config};
    const result=planRoutesV2(WARSAW_CATALOGUE,prefs,{candidateLimit:90,beamWidth:45,maxStops:8,maxExpansions:30000});
    const best=result.routes[0];
    const overlaps=[];
    for(let i=0;i<result.routes.length;i++)for(let j=i+1;j<result.routes.length;j++){
      const x=new Set(result.routes[i].stopIds),y=new Set(result.routes[j].stopIds);
      overlaps.push([...x].filter(id=>y.has(id)).length/Math.max(x.size,y.size));
    }
    const maxVariantOverlapPercent=overlaps.length?Math.round(Math.max(...overlaps)*100):null;
    return {
      scenario:name,
      requestedMinutes:prefs.time,
      candidates:result.diagnostics.candidateCount,
      considered:result.diagnostics.evaluated,
      options:result.routes.length,
      maxVariantOverlapPercent,
      stopIds:best?.stopIds||[],
      stopCount:best?.stopIds.length||0,
      newOsmStops:best?.stopIds.filter(id=>osmIds.has(id)).length||0,
      totalMinutes:best?.totalMinutes??null,
      travelMinutes:best?.breakdown.travel??null,
      visitMinutes:best?.breakdown.visits??null,
      restMinutes:best?.breakdown.rests??null,
      waitMinutes:best?.breakdown.wait??null,
      unknownHours:best?.unknownHours??null,
      estimatedLegs:best?.estimatedLegs??null,
      budgetRespected:!!best&&best.totalMinutes<=prefs.time,
      quality:qualitySignals(best,prefs),
      route:best,
      reason:result.reason
    };
  });
}
const executedAsScript=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(executedAsScript){
  const results=runBenchmark();
  const summary=results.map(({route,...row})=>row);
  process.stdout.write(JSON.stringify({dataSource:'checked-in Warsaw editorial 50 + OSM 258; not verified live API',realTravelTimes:false,scenarios:summary,pass:summary.every(s=>s.budgetRespected)},null,2)+'\n');
  if(summary.some(s=>!s.budgetRespected))process.exitCode=1;
}
