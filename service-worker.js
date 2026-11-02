const CACHE='city-route-v2';
const FILES=['./','./index.html','./styles.css','./app.js','./core.js','./manifest.webmanifest','./data/places.json','./data/routes.json','./data/sidequests.json','./data/rankings.json','./assets/logo.png','./assets/icons/icon-180.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/images/warsaw.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('city-route-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 const paths=FILES.map(p=>new URL(p,self.registration.scope).pathname);if(!paths.includes(u.pathname)&&e.request.mode!=='navigate')return;
 e.respondWith(caches.open(CACHE).then(async c=>{
  const cached=await c.match(e.request);if(cached)return cached;
  try{const r=await fetch(e.request);return r;}catch(error){if(e.request.mode==='navigate')return c.match('./index.html');return Response.error();}
 }));
});
