// AGENT-TEAM v1: the built service worker's cache name carries a hash of every shipped file.
// Any changed asset therefore installs a fresh PWA cache even if a PR forgot to bump `city-route-vNN`,
// and parallel PRs no longer conflict over the next version number. The base number in the source
// service-worker.js is bumped only for an intentional cache reset (QA / Release).
import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join,relative,sep} from 'node:path';

export const CACHE_PATTERN=/const CACHE='(city-route-v\d+)'/;

export function cacheNameFor(source,hash){
 const m=CACHE_PATTERN.exec(String(source));
 if(!m)throw new Error('service-worker.js: const CACHE=\'city-route-vNN\' not found');
 if(!/^[0-9a-f]{8,}$/.test(String(hash)))throw new Error('invalid content hash');
 return source.replace(CACHE_PATTERN,`const CACHE='${m[1]}-${String(hash).slice(0,10)}'`);
}

async function* walk(dir){
 for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const path=join(dir,entry.name);
  if(entry.isDirectory())yield* walk(path);else yield path;
 }
}

// Hash of path + content of every file in `dir`, except the service worker itself.
export async function contentHash(dir,{skip=['service-worker.js']}={}){
 const h=createHash('sha256');
 for await(const path of walk(dir)){
  const rel=relative(dir,path).split(sep).join('/');
  if(skip.includes(rel))continue;
  h.update(rel+'\0');h.update(await readFile(path));h.update('\0');
 }
 return h.digest('hex');
}
