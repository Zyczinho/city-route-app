// Turns Ticketmaster Discovery API responses into the small event records the app shows.
// Shared by worker.js (server) and the Node tests; the browser only sees the output.
export const TM_ENDPOINT='https://app.ticketmaster.com/discovery/v2/events.json';
const KIND={'Music':'koncerty','Arts & Theatre':'teatr','Sports':'sport','Film':'kino'};
const utc=d=>d.toISOString().replace(/\.\d{3}Z$/,'Z');

// Explicit supported markets: never silently return Warsaw events for another city.
export const EVENT_MARKETS=Object.freeze({
 warsaw:{city:'Warsaw',countryCode:'PL'},
 krakow:{city:'Krakow',countryCode:'PL'},
 lisbon:{city:'Lisboa',countryCode:'PT'}
});
export const eventMarket=id=>Object.hasOwn(EVENT_MARKETS,id)?EVENT_MARKETS[id]:null;

// Ticketmaster results are scoped to the active city and country.
export function ticketmasterQuery(key,days=7,now=new Date(),cityId='warsaw'){
 const market=eventMarket(cityId);
 if(!market)throw Error('unsupported-event-city');
 const end=new Date(now.getTime()+Math.min(Math.max(days,1),31)*864e5);
 return `${TM_ENDPOINT}?${new URLSearchParams({apikey:key,city:market.city,countryCode:market.countryCode,startDateTime:utc(now),endDateTime:utc(end),sort:'date,asc',size:'100',locale:'*'})}`;
}

// Optional Impact affiliate link: a template containing {url}, set as an environment value.
export const withAffiliate=(url,template)=>template&&template.includes('{url}')?template.replace('{url}',encodeURIComponent(url)):url;

export function normalizeTicketmaster(json,{affiliate}={}){
 const list=json?._embedded?.events||[];
 return list.filter(e=>e?.url&&e?.name&&e?.dates?.start?.localDate).map(e=>{
  const venue=e._embedded?.venues?.[0]||{},img=(e.images||[]).filter(i=>i.ratio==='16_9').sort((a,b)=>Math.abs(a.width-800)-Math.abs(b.width-800))[0]||e.images?.[0],price=e.priceRanges?.[0];
  return {id:'tm-'+e.id,source:'ticketmaster',name:e.name,kind:KIND[e.classifications?.[0]?.segment?.name]||'inne',
   genre:e.classifications?.[0]?.genre?.name&&e.classifications[0].genre.name!=='Undefined'?e.classifications[0].genre.name:'',
   date:e.dates.start.localDate,time:e.dates.start.localTime?.slice(0,5)||'',dateTime:e.dates.start.dateTime||null,
   venue:venue.name||'',address:venue.address?.line1||'',lat:Number(venue.location?.latitude)||null,lng:Number(venue.location?.longitude)||null,
   image:img?.url||null,price:price&&Number.isFinite(price.min)?{min:price.min,max:price.max??price.min,currency:price.currency||'PLN'}:null,
   status:e.dates?.status?.code||'onsale',url:withAffiliate(e.url,affiliate)};
 });
}

// Same show listed twice (e.g. two ticket types) collapses into one card.
export function dedupe(events){const seen=new Map();for(const e of events){const k=`${e.name.toLowerCase().replace(/\W+/g,'')}|${e.date}|${e.venue.toLowerCase()}`;if(!seen.has(k))seen.set(k,e);}return [...seen.values()];}
