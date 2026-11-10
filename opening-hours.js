// BETA-HOURS-AUTH-046 — free, editorially checked opening-hours pilot.
// Not live Google availability. Dates, exceptional closures, admission cutoffs and
// provider links must be reverified before future seasons.
// Planner reliability (audit 2026-11-10): catalogue places also carry OpenStreetMap `opening_hours`
// (metadata.osmTags, spread to p.osmTags by the catalogue client). They are parsed here offline;
// a value we cannot read is reported as unknown, never as closed.
import {distance} from './core.js';
import {canViewRouteFacade} from './route-preferences.js';

export const VERIFIED_AT='2026-11-04';
export const PILOT_HOURS=Object.freeze({
 warsaw:{
  'chopin-museum':{
   title:'Muzeum Fryderyka Chopina',closedYear:2026,
   source:'https://muzeum.nifc.pl/pl/muzeum/wizyta-informacje-miejsce/1_muzeum-fryderyka-chopina-w-warszawie/',
   note:'Muzeum nieczynne przez cały 2026 rok z powodu remontu'
  },
  'national-museum':{
   title:'Muzeum Narodowe w Warszawie',
   weekly:[['10:00','18:00'],null,['10:00','18:00'],['10:00','18:00'],['10:00','18:00'],['10:00','20:00'],['10:00','18:00']],
   minVisit:60,source:'https://www.mnw.art.pl/wizyta/'
  },
  copernicus:{
   title:'Centrum Nauki Kopernik — Wystawy',
   weekly:[['09:00','19:00'],['09:00','18:00'],['09:00','18:00'],['09:00','18:00'],['09:00','18:00'],['09:00','20:00'],['09:00','19:00']],
   minVisit:60,entryBeforeClose:60,
   overrides:{
    '2026-11-01':null,'2026-11-09':null,'2026-11-11':['09:00','19:00'],'2026-11-12':['09:00','19:00'],
    '2026-12-07':null,'2026-12-21':null,'2026-12-24':null,'2026-12-25':null,'2026-12-26':null
   },
   source:'https://www.kopernik.org.pl/wizyta/godziny-otwarcia'
  }
 },
 krakow:{
  'czartoryski-museum':{
   title:'Muzeum Książąt Czartoryskich',
   weekly:[['10:00','18:00'],null,['10:00','18:00'],['10:00','18:00'],['10:00','18:00'],['10:00','18:00'],['10:00','18:00']],
   entryBeforeClose:60,minVisit:60,needsTicket:true,
   source:'https://mnk.pl/oddzialy/czartoryscy/'
  },
  'aviation-museum':{
   title:'Muzeum Lotnictwa Polskiego',
   weekly:[['09:00','16:00'],null,['09:00','16:00'],['09:00','16:00'],['09:00','16:00'],['09:00','16:00'],['09:00','16:00']],
   seasonalHours:true,minVisit:90,entryBeforeClose:45,
   overrides:{'2026-11-01':null,'2026-11-11':null},
   source:'https://muzeumlotnictwa.pl/zwiedzanie/'
  }
 }
});
// Typical hours by category, used only when a venue has no hours at all. They keep a bar out of a
// 10:00 plan, but stay flagged as unverified ("typowe godziny") in the timeline.
// Minutes from local midnight; an end above 1440 continues after midnight.
export const TYPICAL_HOURS=Object.freeze({
 restaurant:[[720,930],[1110,1380]],
 cafe:[[480,1140]],bakery:[[420,1140]],breakfast:[[480,900]],dessert:[[600,1320]],
 street_food:[[660,1320]],food_hall:[[600,1380]],
 bar:[[1020,1560]],pub:[[960,1560]],cocktail_bar:[[1080,1620]],wine_bar:[[1020,1440]],live_music:[[1200,1620]],
 club:[[1380,1800]],nightclub:[[1380,1800]],dance_club:[[1380,1800]]
});
const hhmm=s=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)))return NaN;const [h,m]=s.split(':').map(Number);return h*60+m;};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
/** "HH:MM" for a minute offset, wrapping after midnight (1500 → "01:00"). */
export const clockLabel=n=>clock(((Math.round(n)%1440)+1440)%1440);
export function localDate(timezone='Europe/Warsaw',instant=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
export function validDate(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))return false;
 const d=new Date(s+'T12:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;
}
const shiftDate=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
export function isIndoor(p){return p?.cats?.includes('muzea')||p?.categoryId==='museum';}

// ---- OpenStreetMap opening_hours: a conservative, offline subset -------------------------------
// Supported: weekday lists and wrapping ranges, month and month-day selectors, several spans per day,
// spans past midnight, open ends ("17:00+"), 24/7, off/closed and additional rules (", Su 21:00-02:00").
// Public/school holiday and Easter rules are ignored (no holiday calendar). Anything else → null.
const OSM_DAYS=['Mo','Tu','We','Th','Fr','Sa','Su'];
const OSM_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const OPEN_END_MINUTES=360;
const OSM_TOKENS=[
 [/^24\/7/,()=>({t:'always'})],
 [/^(\d{1,2}):(\d{2})/,m=>({t:'time',v:Number(m[1])*60+Number(m[2])})],
 [/^\d{1,2}/,m=>({t:'num',v:Number(m[0])})],
 [/^(Mo|Tu|We|Th|Fr|Sa|Su)(?![a-z])/,m=>({t:'day',v:OSM_DAYS.indexOf(m[1])})],
 [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?![a-z])/,m=>({t:'month',v:OSM_MONTHS.indexOf(m[1])+1})],
 [/^(PH|SH)(?![a-z])/,()=>({t:'holiday'})],
 [/^(off|closed)(?![a-z])/i,()=>({t:'off'})],
 [/^easter(?![a-z])/i,()=>({t:'easter'})],
 [/^[-,;:+]/,m=>({t:m[0]})]
];
function tokenizeOsm(text){
 const tokens=[];let rest=text;
 while(rest.length){
  if(/^\s/.test(rest)){rest=rest.slice(1);continue;}
  const hit=OSM_TOKENS.map(([re,make])=>[re.exec(rest),make]).find(([m])=>m);
  if(!hit)return null;
  tokens.push(hit[1](hit[0]));rest=rest.slice(hit[0][0].length);
 }
 return tokens;
}
const dateKey=(month,day)=>month*100+day;
function parseDates(tokens,pos){
 const ranges=[];let month=null;
 for(;;){
  const tk=tokens[pos];
  if(tk?.t==='month'){
   month=tk.v;pos++;
   let from=dateKey(month,1),to=dateKey(month,31),hasDay=false;
   if(tokens[pos]?.t==='num'){from=to=dateKey(month,tokens[pos].v);pos++;hasDay=true;}
   if(tokens[pos]?.t==='-'){
    const next=tokens[pos+1];
    if(next?.t==='month'){
     month=next.v;pos+=2;
     to=dateKey(month,31);
     if(tokens[pos]?.t==='num'){to=dateKey(month,tokens[pos].v);pos++;}
    }else if(next?.t==='num'&&hasDay){to=dateKey(month,next.v);pos+=2;}
    else return null;
   }
   ranges.push([from,to]);
  }else if(tk?.t==='num'&&month!==null){
   let from=dateKey(month,tk.v),to=from;pos++;
   if(tokens[pos]?.t==='-'&&tokens[pos+1]?.t==='num'){to=dateKey(month,tokens[pos+1].v);pos+=2;}
   ranges.push([from,to]);
  }else return null;
  if(tokens[pos]?.t===','&&['month','num'].includes(tokens[pos+1]?.t)){pos++;continue;}
  return {ranges,pos};
 }
}
function parseDays(tokens,pos){
 const days=new Set();let holiday=false;
 for(;;){
  const tk=tokens[pos];
  if(tk?.t==='holiday'){holiday=true;pos++;}
  else if(tk?.t==='day'){
   pos++;
   if(tokens[pos]?.t==='-'&&tokens[pos+1]?.t==='day'){
    for(let d=tk.v;;d=(d+1)%7){days.add(d);if(d===tokens[pos+1].v)break;}
    pos+=2;
   }else days.add(tk.v);
  }else return null;
  if(tokens[pos]?.t===','&&['day','holiday'].includes(tokens[pos+1]?.t)){pos++;continue;}
  return {days:[...days],holidayOnly:!days.size&&holiday,pos};
 }
}
function parseSpans(tokens,pos){
 const spans=[];
 const timeAt=i=>tokens[i]?.t==='time'?tokens[i].v:tokens[i]?.t==='num'&&tokens[i].v<=24?tokens[i].v*60:NaN;
 for(;;){
  const start=timeAt(pos);
  if(!Number.isFinite(start)||start>1440)return null;
  pos++;
  let end;
  if(tokens[pos]?.t==='-'){
   end=timeAt(pos+1);
   if(!Number.isFinite(end)||end>1440)return null;
   pos+=2;
   if(end<=start)end+=1440;
   if(tokens[pos]?.t==='+')pos++;
  }else if(tokens[pos]?.t==='+'){end=start+OPEN_END_MINUTES;pos++;}
  else return null;
  spans.push([start,end]);
  if(tokens[pos]?.t===','&&['time','num'].includes(tokens[pos+1]?.t)){pos++;continue;}
  return {spans,pos};
 }
}
/** Parsed rules for an OSM opening_hours value, or null when any part is outside the supported subset. */
export function parseOsmOpeningHours(raw){
 const text=String(raw??'').replace(/[–—]/g,'-').trim();
 if(!text||text.length>400)return null;
 const tokens=tokenizeOsm(text);
 if(!tokens?.length)return null;
 const rules=[];
 const groups=[[]];
 for(const tk of tokens){if(tk.t===';')groups.push([]);else groups.at(-1).push(tk);}
 for(const group of groups){
  if(!group.length)continue;
  let pos=0,additional=false;
  while(pos<group.length){
   const rule={additional,dates:null,days:null,spans:null,off:false,skip:false};
   if(group[pos]?.t==='month'){
    const parsed=parseDates(group,pos);if(!parsed)return null;
    rule.dates=parsed.ranges;pos=parsed.pos;
    if(group[pos]?.t===':')pos++;
   }
   if(group[pos]?.t==='easter'){rule.skip=true;pos++;}
   if(['day','holiday'].includes(group[pos]?.t)){
    const parsed=parseDays(group,pos);if(!parsed)return null;
    rule.days=parsed.days;pos=parsed.pos;
    if(parsed.holidayOnly)rule.skip=true;
    if(group[pos]?.t===':')pos++;
   }
   const tk=group[pos];
   if(tk?.t==='off'){rule.off=true;pos++;}
   else if(tk?.t==='always'){rule.spans=[[0,1440]];pos++;}
   else if(['time','num'].includes(tk?.t)){
    const parsed=parseSpans(group,pos);if(!parsed)return null;
    rule.spans=parsed.spans;pos=parsed.pos;
   }else if(!rule.skip)return null; // "Sa-Su" or a bare date without hours is ambiguous
   rules.push(rule);
   if(pos<group.length){
    if(group[pos].t===','&&pos+1<group.length){pos++;additional=true;continue;}
    return null;
   }
  }
 }
 return rules.length?rules:null;
}
function rulesForDay(rules,date){
 const d=new Date(date+'T12:00:00Z'),weekday=(d.getUTCDay()+6)%7,key=dateKey(d.getUTCMonth()+1,d.getUTCDate());
 let spans=null;
 for(const rule of rules){
  if(rule.skip)continue;
  if(rule.dates&&!rule.dates.some(([a,b])=>a<=b?key>=a&&key<=b:key>=a||key<=b))continue;
  if(rule.days&&!rule.days.includes(weekday))continue;
  if(rule.off){spans=[];continue;}
  spans=rule.additional&&spans?[...spans,...rule.spans]:[...rule.spans];
 }
 return spans||[];
}
const mergeIntervals=list=>{
 const out=[];
 for(const [s,e] of [...list].sort((a,b)=>a[0]-b[0]||a[1]-b[1])){
  const last=out.at(-1);
  if(last&&s<=last[1])last[1]=Math.max(last[1],e);else out.push([s,e]);
 }
 return out;
};
/** Open windows relevant to a visit on `date`: spill-over from the previous evening, the day itself and the following night. Minutes from local midnight of `date`, 0–2880. */
export function openWindows(rules,date){
 if(!validDate(date))return [];
 const out=[];
 for(const [,e] of rulesForDay(rules,shiftDate(date,-1)))if(e>1440)out.push([0,e-1440]);
 for(const span of rulesForDay(rules,date))out.push(span);
 for(const [s,e] of rulesForDay(rules,shiftDate(date,1)))out.push([s+1440,e+1440]);
 return mergeIntervals(out.map(([s,e])=>[Math.max(0,s),Math.min(2880,e)]).filter(([s,e])=>e>s));
}
export const osmOpeningHoursOf=p=>{
 const raw=p?.osmTags?.opening_hours??p?.metadata?.osmTags?.opening_hours??null;
 return typeof raw==='string'&&raw.trim()?raw.trim():null;
};
const dayLabel=intervals=>intervals.filter(([s])=>s<1440).map(([s,e])=>clockLabel(s)+'–'+clockLabel(e)).join(', ');
function typicalHoursFor(p){
 const category=String(p?.categoryId||'');
 if(TYPICAL_HOURS[category])return TYPICAL_HOURS[category];
 if(category)return null;
 // Editorial records without a categoryId: fall back on the food style or legacy nightlife group.
 if(p?.foodStyle==='sit')return TYPICAL_HOURS.restaurant;
 if(p?.foodStyle==='quick')return TYPICAL_HOURS.cafe;
 if(Array.isArray(p?.cats)&&p.cats.includes('nocne'))return TYPICAL_HOURS.bar;
 return null;
}
export function openingFor(p,{cityId='warsaw',date,mode='inside'}={}){
 const indoor=isIndoor(p);
 if(mode==='outside'&&(indoor||canViewRouteFacade(p)))return {status:'exterior',label:'Oglądanie z zewnątrz; dostęp do terenu może być ograniczony'};
 const spec=PILOT_HOURS[cityId]?.[p?.id];
 if(spec){
  if(!validDate(date)||!date.startsWith('2026-'))return {status:'unknown',label:'Godziny wymagają sprawdzenia'};
  if(spec.closedYear===2026)return {status:'closed',label:spec.note,source:spec.source,checked:VERIFIED_AT};
  const dow=new Date(date+'T12:00:00Z').getUTCDay();
  let hours=Object.hasOwn(spec.overrides||{},date)?spec.overrides[date]:spec.weekly?.[dow];
  if(spec.seasonalHours){
   const month=Number(date.slice(5,7));
   const end=month>=11||month<=2?'16:00':month>=6&&month<=9?'18:00':'17:00';
   hours=Object.hasOwn(spec.overrides||{},date)?spec.overrides[date]:spec.weekly?.[dow]?[spec.weekly[dow][0],end]:null;
  }
  if(!hours)return {status:'closed',label:'Nieczynne w wybranym dniu',source:spec.source,checked:VERIFIED_AT};
  const open=hhmm(hours[0]),close=hhmm(hours[1]);
  return {
   status:'known',open,close,
   latestEntry:close-(spec.entryBeforeClose||0),entryBeforeClose:spec.entryBeforeClose||0,
   intervals:[[open,close]],
   minVisit:spec.minVisit||60,needsTicket:!!spec.needsTicket,
   label:hours.join('–'),source:spec.source,checked:VERIFIED_AT
  };
 }
 const raw=osmOpeningHoursOf(p);
 const rules=raw&&validDate(date)?parseOsmOpeningHours(raw):null;
 if(rules){
  const intervals=openWindows(rules,date);
  if(!intervals.length)return {status:'closed',label:'Zamknięte w wybranym dniu',source:'openstreetmap',raw};
  return {status:'known',intervals,minVisit:0,label:dayLabel(intervals)||'nieczynne w wybranym dniu',source:'openstreetmap',raw};
 }
 // No hours, or a value we cannot read (e.g. "Su 16:00-:00"): typical hours for the category, still unverified.
 const typical=typicalHoursFor(p);
 if(typical&&validDate(date)){
  const intervals=openWindows([{spans:typical}],date);
  return {status:'typical',intervals,minVisit:0,label:'typowo '+dayLabel(intervals),...(raw?{raw}:{})};
 }
 if(raw)return {status:'unknown',label:'Godziny wymagają sprawdzenia',raw};
 if(!indoor)return {status:'not-applicable'};
 return {status:'unknown',label:'Godziny wymagają sprawdzenia'};
}
/** Earliest visit start inside an open window, or null. `hours` without windows imposes no limit. */
export function visitSlot(hours,arrival,dwell,{maxWait=Infinity}={}){
 if(!Array.isArray(hours?.intervals))return {visitStart:arrival,wait:0};
 const entryCut=Number(hours.entryBeforeClose)||0;
 for(const [open,close] of hours.intervals){
  const visitStart=Math.max(arrival,open);
  if(visitStart-arrival>maxWait)break;
  if(visitStart>close-entryCut||visitStart+dwell>close)continue;
  return {visitStart,wait:visitStart-arrival,closes:close};
 }
 return null;
}
// Computes an estimated arrival and completion timeline for one day, including
// travel from the optional geolocation starting point and waiting until opening.
// Missing hours are NOT reported as open; known closures are hard constraints.
export function scheduleRoute(stops,{cityId='warsaw',date,startTime='10:00',transport='walking',mode='inside',origin=null,maxMinutes=Infinity}={}){
 const start=hhmm(startTime);
 if(!validDate(date)||!Number.isFinite(start))return {feasible:false,reason:'invalid-date-time',rows:[],minutes:0,unknownCount:0};
 const speed=transport==='bike'?12:transport==='transit'?8:transport==='mix'?6:4.5;
 let t=start,prior=origin,unknownCount=0,feasible=true,reason=null;
 const rows=[];
 for(const p of stops){
  if(prior&&Number.isFinite(Number(prior.lat))&&Number.isFinite(Number(prior.lng))
    &&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))){
   t+=Math.ceil(distance(prior,p)*1.3/speed*60);
  }
  const arrival=t;
  let hours=openingFor(p,{cityId,date,mode});
  let wait=0,duration=Math.max(1,Number(p.minutes)||20);
  if(hours.minVisit)duration=Math.max(duration,hours.minVisit);
  let slot=hours.status==='closed'?null:visitSlot(hours,t,duration);
  if(!slot&&mode==='mix'&&canViewRouteFacade(p)){
   hours=openingFor(p,{cityId,date,mode:'outside'});
   duration=Math.min(Math.max(1,Number(p.minutes)||20),Math.max(5,Number(p.outsideMinutes)||20));
   slot={visitStart:t,wait:0};
  }
  if(slot){wait=slot.wait;t=slot.visitStart;}
  else{feasible=false;reason=reason||'closed';}
  if(hours.status==='unknown'||hours.status==='typical')unknownCount++;
  const visitStart=t; t+=duration;
  rows.push({id:p.id,name:p.name,arrival:clockLabel(arrival),visitStart:clockLabel(visitStart),departure:clockLabel(t),
   wait,opening:hours,status:hours.status,duration});
  prior=p;
 }
 if(t-start>maxMinutes){feasible=false;reason=reason||'too-long';}
 return {feasible,reason,rows,minutes:t-start,unknownCount,startTime,date};
}
export function feasibleFor(stops,opts){return scheduleRoute(stops,opts).feasible;}
