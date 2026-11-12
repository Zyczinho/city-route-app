// Read-only preview capability probe: never calls Google/Tripadvisor or exposes secret values.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=String(process.env.CITYROUTE_PREVIEW_URL||'').replace(/\/+$/,'');
if(!base.startsWith('https://')||!base.endsWith('.workers.dev'))throw Error('Invalid preview URL');
const checksum=x=>createHash('sha256').update(x).digest('hex');
const want=checksum(await readFile('dist/app.js'));
let confirmed=false;
for(let n=0;n<20;n++){
 try{
  const response=await fetch(base+'/app.js?ci='+Date.now()+'-'+n,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(9000)});
  if(!response.ok){console.log('PREVIEW waiting, app HTTP '+response.status);continue;}
  const body=await response.arrayBuffer();
  if(checksum(Buffer.from(body))!==want){console.log('PREVIEW stale app.js attempt '+(n+1));continue;}
  confirmed=true;break;
 }catch(e){console.log('PREVIEW probe network: '+String(e.message).slice(0,90));}
 await new Promise(r=>setTimeout(r,4000));
}
if(!confirmed){console.log('PREVIEW NOT VERIFIED: exact app.js hash not observed; no provider-status claim.');process.exit(0);}
console.log('PREVIEW VERIFIED: exact app.js SHA-256 '+want.slice(0,12));
try{
 const r=await fetch(base+'/api/provider-status?ci='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const obj=await r.json();
 if(obj.status!=='ok'||!obj.providers)throw Error('invalid status JSON');
 const {google,tripadvisor}=obj.providers;
 console.log('PROVIDER_CAPABILITIES (keys are NEVER returned): '+JSON.stringify({google,tripadvisor}));
 if(google?.photos!=='ready')console.log('PHOTO BLOCKER: Google photo calls unavailable ('+google?.photos+'); venue images may use Commons or category placeholders.');
 if(google?.ratings!=='ready'&&tripadvisor?.content!=='ready'&&tripadvisor?.terra!=='ready')console.log('RATINGS BLOCKER: no active licensed provider credentials or per-instance capacity.');
}catch(e){console.log('PROVIDER STATUS NOT VERIFIED: '+String(e.message).slice(0,110));}
