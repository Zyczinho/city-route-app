const CACHE='city-route-v8';
const FILES=['./', './index.html', './styles.css', './app.js', './core.js', './manifest.webmanifest', './data/places.json', './data/routes.json', './data/sidequests.json', './data/rankings.json', './assets/logo.png', './assets/icons/icon-180.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/brands/googlemaps.svg', './assets/icons/brands/tripadvisor.svg', './assets/icons/ui/arrow-down.svg', './assets/icons/ui/arrow-left.svg', './assets/icons/ui/arrow-up-right.svg', './assets/icons/ui/arrow-up.svg', './assets/icons/ui/bed-double.svg', './assets/icons/ui/bookmark.svg', './assets/icons/ui/camera.svg', './assets/icons/ui/check.svg', './assets/icons/ui/chevron-right.svg', './assets/icons/ui/clock.svg', './assets/icons/ui/compass.svg', './assets/icons/ui/flag.svg', './assets/icons/ui/house.svg', './assets/icons/ui/info.svg', './assets/icons/ui/landmark.svg', './assets/icons/ui/layers.svg', './assets/icons/ui/link.svg', './assets/icons/ui/map-pin.svg', './assets/icons/ui/map.svg', './assets/icons/ui/navigation.svg', './assets/icons/ui/pencil.svg', './assets/icons/ui/play.svg', './assets/icons/ui/plus.svg', './assets/icons/ui/radio.svg', './assets/icons/ui/route.svg', './assets/icons/ui/search.svg', './assets/icons/ui/shuffle.svg', './assets/icons/ui/sliders-horizontal.svg', './assets/icons/ui/sparkles.svg', './assets/icons/ui/star.svg', './assets/icons/ui/ticket-percent.svg', './assets/icons/ui/trees.svg', './assets/icons/ui/trophy.svg', './assets/icons/ui/user-round.svg', './assets/icons/ui/users.svg', './assets/icons/ui/utensils.svg', './assets/icons/ui/wand-sparkles.svg', './assets/icons/ui/waves.svg', './assets/icons/ui/x.svg'];
// Photos are cached on first view instead of up front, so installing stays light.
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('city-route-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 const paths=FILES.map(p=>new URL(p,self.registration.scope).pathname),photo=u.pathname.startsWith(new URL('./assets/images/',self.registration.scope).pathname);
 if(!paths.includes(u.pathname)&&!photo&&e.request.mode!=='navigate')return;
 e.respondWith(caches.open(CACHE).then(async c=>{
  const cached=await c.match(e.request);if(cached)return cached;
  try{const r=await fetch(e.request);if(photo&&r.ok)c.put(e.request,r.clone());return r;}catch(error){if(e.request.mode==='navigate')return c.match('./index.html');return Response.error();}
 }));
});
