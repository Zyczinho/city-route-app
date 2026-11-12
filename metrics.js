// Anonymous product metrics: how many people reach each step (open → add place / paste list → route → Google Maps).
// Only allow-listed event names, a city id and a hashed device id are stored. Never names, places or locations.
export const METRIC_TYPES=['app_open','place_add','list_paste','build_generate','route_start','whole_route_maps','google_saved_import'];
const CITY_RE=/^[a-z]{2,20}$/;
const DEVICE_RE=/^[A-Za-z0-9-]{8,64}$/;

export function parseMetric(body){
 if(!body||typeof body!=='object')return null;
 const type=String(body.t||'');if(!METRIC_TYPES.includes(type))return null;
 const city=CITY_RE.test(String(body.c||''))?String(body.c):'';
 const device=DEVICE_RE.test(String(body.d||''))?String(body.d):'';
 const n=Number.isInteger(body.n)&&body.n>=0&&body.n<=1000?body.n:null;
 return {type,city,device,n};
}

export async function hashDevice(id){
 if(!id)return '';
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('city-route-metrics:'+id));
 return [...new Uint8Array(bytes)].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Writes only on the production host, so previews and local dev do not pollute the numbers.
export async function recordMetric(request,env,ctx,{productionHost='city-route-app.jakublojek.workers.dev'}={}){
 const done=()=>new Response(null,{status:204,headers:{'cache-control':'no-store'}});
 if(request.method!=='POST')return new Response(null,{status:405});
 const text=await request.text().catch(()=>'');if(text.length>400)return done();
 let body;try{body=JSON.parse(text);}catch{return done();}
 const m=parseMetric(body);
 if(!m||!env.METRICS||new URL(request.url).hostname!==productionHost)return done();
 const now=new Date(),device=await hashDevice(m.device);
 const write=env.METRICS.prepare('INSERT INTO metric_events(day,at,type,city,device,n) VALUES(?,?,?,?,?,?)')
  .bind(now.toISOString().slice(0,10),now.toISOString(),m.type,m.city,device,m.n).run().catch(()=>null);
 if(ctx?.waitUntil)ctx.waitUntil(write);else await write;
 return done();
}
