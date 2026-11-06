// QA-131: fail closed when Cloudflare serves any app.js other than the exact checked-out build.
// Use unique query parameters on every attempt so an edge cache cannot mask a delayed rollout.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const sha256Hex=bytes=>createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

export async function verifyProductionApp({
 expectedBytes,productionOrigin,commitSha='unknown',maxAttempts=35,intervalMs=8000,
 requestTimeoutMs=12000,fetchImpl=globalThis.fetch,sleepImpl=sleep,log=console.log
}={}){
 if(!expectedBytes?.length)throw new Error('dist/app.js is empty or missing');
 if(typeof fetchImpl!=='function')throw new Error('fetch not available');
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>100)throw new Error('invalid maxAttempts');
 let endpoint;
 try{endpoint=new URL('/app.js',productionOrigin);}catch{throw new Error('invalid productionOrigin');}
 if(endpoint.protocol!=='https:'||!endpoint.hostname||endpoint.username||endpoint.password)throw new Error('productionOrigin must be HTTPS');
 const wanted=sha256Hex(expectedBytes);
 let lastActual='unavailable',lastProblem='not fetched';
 log('Git checkout: '+String(commitSha)+' | dist/app.js SHA-256: '+wanted);
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const url=new URL(endpoint.href);
  url.searchParams.set('commit',String(commitSha));
  url.searchParams.set('probe',String(attempt));
  try{
   const response=await fetchImpl(url.href,{
    redirect:'follow',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},
    signal:AbortSignal.timeout(requestTimeoutMs)
   });
   if(!response.ok)throw new Error('HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   lastActual=sha256Hex(bytes);
   if(lastActual===wanted){
    log('PASS: production /app.js exactly matches dist/app.js ('+wanted+'), attempt '+attempt+'/'+maxAttempts);
    return {wanted,actual:lastActual,attempt,matched:true};
   }
   lastProblem=response.headers.get('content-type')?.includes('text/html')?'HTML fallback instead of app.js':'SHA-256 mismatch';
  }catch(error){
   lastActual='unavailable';lastProblem=error?.message||String(error);
  }
  log('Attempt '+attempt+'/'+maxAttempts+': production /app.js not yet current ('+lastProblem+', observed SHA-256: '+lastActual+')');
  if(attempt<maxAttempts)await sleepImpl(intervalMs);
 }
 throw new Error('Production /app.js does not match Git commit '+String(commitSha)+
  ' after '+maxAttempts+' attempts. Expected SHA-256: '+wanted+
  '; last observed: '+lastActual+' ('+lastProblem+'). Check the Cloudflare deployment, CDN cache and deployed dist/ directory.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const expectedBytes=await readFile('dist/app.js');
  await verifyProductionApp({
   expectedBytes,productionOrigin:process.env.CITY_ROUTE_PROD,commitSha:process.env.GITHUB_SHA
  });
 }catch(error){
  console.error('::error::'+(error?.message||String(error)));
  process.exitCode=1;
 }
}
