// Minimal static server for e2e runs: serves dist/ on 127.0.0.1 only.
// Kept dependency-free so the e2e runner can start it on Linux CI and Windows alike.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize,resolve} from 'node:path';

const ROOT=resolve('dist');
const PORT=Number(process.env.E2E_PORT||4180);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

createServer(async(req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://x').pathname);
 const file=normalize(join(ROOT,path.endsWith('/')?path+'index.html':path));
 if(!file.startsWith(ROOT)){res.writeHead(403).end();return;}
 try{
  const body=await readFile(file);
  res.writeHead(200,{'content-type':TYPES[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);
 }catch{res.writeHead(404).end('not found');}
}).listen(PORT,'127.0.0.1',()=>console.log('e2e static server on http://127.0.0.1:'+PORT));
