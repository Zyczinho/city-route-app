// FIRST-30S-IPHONE-UX-051: suggest an upcoming time for a one-tap plan.
// All calculations are target-city local; no geolocation, API or persistent state.
const pad=n=>String(n).padStart(2,'0');
export function suggestVisitStart({now=new Date(),timeZone='Europe/Warsaw'}={}){
 const values=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
  hourCycle:'h23'
 }).formatToParts(now).map(p=>[p.type,p.value]));
 let date=values.year+'-'+values.month+'-'+values.day;
 const clock=Number(values.hour)*60+Number(values.minute);
 const target=Math.max(9*60,Math.ceil((clock+15)/30)*30);
 if(target>20*60){
  const tomorrow=new Date(date+'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  date=tomorrow.toISOString().slice(0,10);
  return {date,time:'10:00'};
 }
 return {date,time:pad(Math.floor(target/60))+':'+pad(target%60)};
}
