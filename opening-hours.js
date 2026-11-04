// BETA-HOURS-AUTH-046 — free, editorially checked opening-hours pilot.
// Not live Google availability. Dates, exceptional closures, admission cutoffs and
// provider links must be reverified before future seasons.
import {distance} from './core.js';

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
const hhmm=s=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)))return NaN;const [h,m]=s.split(':').map(Number);return h*60+m;};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
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
export function isIndoor(p){return p?.cats?.includes('muzea')||p?.categoryId==='museum';}
export function openingFor(p,{cityId='warsaw',date,mode='inside'}={}){
 if(!isIndoor(p))return {status:'not-applicable'};
 if(mode==='outside')return {status:'exterior',label:'Oglądanie z zewnątrz; dostęp do terenu może być ograniczony'};
 const spec=PILOT_HOURS[cityId]?.[p.id];
 if(!spec||!validDate(date)||!date.startsWith('2026-'))return {status:'unknown',label:'Godziny wymagają sprawdzenia'};
 if(spec.closedYear===2026)return {status:'closed',label:spec.note,source:spec.source,checked:VERIFIED_AT};
 const dow=new Date(date+'T12:00:00Z').getUTCDay();
 let hours=Object.hasOwn(spec.overrides||{},date)?spec.overrides[date]:spec.weekly?.[dow];
 if(spec.seasonalHours){
  const month=Number(date.slice(5,7));
  const end=month>=11||month<=2?'16:00':month>=6&&month<=9?'18:00':'17:00';
  hours=Object.hasOwn(spec.overrides||{},date)?spec.overrides[date]:spec.weekly?.[dow]?[spec.weekly[dow][0],end]:null;
 }
 if(!hours)return {status:'closed',label:'Nieczynne w wybranym dniu',source:spec.source,checked:VERIFIED_AT};
 return {
  status:'known',open:hhmm(hours[0]),close:hhmm(hours[1]),
  latestEntry:hhmm(hours[1])-(spec.entryBeforeClose||0),
  minVisit:spec.minVisit||60,needsTicket:!!spec.needsTicket,
  label:hours.join('–'),source:spec.source,checked:VERIFIED_AT
 };
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
  const arrival=t,hours=openingFor(p,{cityId,date,mode});
  let wait=0,duration=Math.max(1,Number(p.minutes)||20);
  if(hours.status==='known'){
   wait=Math.max(0,hours.open-t);t+=wait;
   duration=Math.max(duration,hours.minVisit);
   if(t>hours.latestEntry||t+duration>hours.close){feasible=false;reason=reason||'closed';}
  }
  if(hours.status==='closed'){feasible=false;reason=reason||'closed';}
  if(hours.status==='unknown')unknownCount++;
  const visitStart=t; t+=duration;
  rows.push({id:p.id,name:p.name,arrival:clock(arrival),visitStart:clock(visitStart),departure:clock(t),
   wait,opening:hours,status:hours.status,duration});
  prior=p;
 }
 if(t-start>maxMinutes){feasible=false;reason=reason||'too-long';}
 return {feasible,reason,rows,minutes:t-start,unknownCount,startTime,date};
}
export function feasibleFor(stops,opts){return scheduleRoute(stops,opts).feasible;}
