import {parseLocation} from './core.js';
export function allowedMapsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&((['www.google.com','google.com','maps.google.com','www.google.pl','google.pl'].includes(u.hostname)&&u.pathname.startsWith('/maps'))||u.hostname==='maps.app.goo.gl'||(u.hostname==='goo.gl'&&u.pathname.startsWith('/maps')))?u:null;}catch{return null;}}
export async function resolveMaps(value,fetcher=fetch){
 let u=allowedMapsUrl(value);if(!u)return {status:'invalid-link'};
 for(let n=0;n<6;n++){
  const location=parseLocation(u.href);if(location)return {status:'ok',location};
  const r=await fetcher(u.href,{redirect:'manual',signal:AbortSignal.timeout(6000)});
  const next=r.headers.get('location');if(![301,302,303,307,308].includes(r.status)||!next)return {status:'no-coordinates'};
  u=allowedMapsUrl(new URL(next,u).href);if(!u)return {status:'unsupported-redirect'};
 }
 return {status:'too-many-redirects'};
}
