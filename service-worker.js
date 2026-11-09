const CACHE='city-route-v75';
const FILES=['./', './index.html', './styles.css', './auth.css', './first-launch.css', './community.css', './social-routes.css', './route-share-ui.css?v=3', './places-pagination.css?v=2', './requests.css', './ux-cleanup.css?v=2', './onboarding-guide.css?v=2', './mobile-first30.css?v=1', './mobile-device-polish.css?v=1', './profile-polish.css?v=1', './commons-photo.css?v=1', './app.js', './onboarding-guide.js', './onboarding-content.js', './account-scope.js', './photo-fallback.js?v=2', './commons-photo-source.js', './place-photo-proposal.js', './commons-photo-runtime.js?v=1', './photo-quality.js', './core.js', './opening-hours.js', './planner-defaults.js', './route-optimizer.js', './route-planner-v2.js', './city-context.js', './catalogue-client.js', './nearby-client.js', './map-view.js', './map.css', './route-covers.js', './route-builder-model.js', './social-routes-client.js', './review-source-model.js', './place-reviews-client.js', './place-reviews.js?v=3', './requests-client.js', './supabase-config.js', './enhancements.js?v=24', './place-composer.js?v=5', './place-contributions.js?v=2', './place-contributions-client.js', './place-composer-model.js', './place-composer.css?v=3', './place-photo-gallery.css?v=2', './place-public-gallery.css?v=1', './ui-icons.css?v=3', './ui-icons.js', './place-public-gallery.js?v=1', './place-photo-model.js', './auth-enhancements.js?v=23', './profile-social-stats.js?v=1', './first-launch.js?v=2', './community-enhancements.js?v=23', './community-hub.js?v=4', './friends.js?v=3', './friends-client.js', './profile-avatar.js?v=1', './profile-avatar-model.js', './saved-places-sync.js?v=1', './saved-places-model.js', './follows-client.js', './social-routes-enhancements.js?v=12', './share-links.js?v=4', './route-export.js', './google-saved-import.js', './places-pagination.js', './nav-enhancements.js?v=4', './sw-update.js?v=1', './requests-enhancements.js?v=4', './ux-cleanup.js?v=5', './supabase-client.js', './manifest.webmanifest', './data/cities.json', './data/taxonomy.json', './data/places.json', './data/routes.json', './data/sidequests.json', './data/rankings.json', './data/cities/krakow/routes.json', './data/cities/krakow/places.json', './data/cities/lisbon/routes.json', './data/cities/lisbon/places.json', './assets/logo.png', './assets/icons/icon-180.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/brands/googlemaps.svg', './assets/icons/brands/tripadvisor.svg', './assets/icons/ui/arrow-down.svg', './assets/icons/ui/arrow-left.svg', './assets/icons/ui/arrow-up-right.svg', './assets/icons/ui/arrow-up.svg', './assets/icons/ui/bed-double.svg', './assets/icons/ui/bookmark.svg', './assets/icons/ui/building-2.svg', './assets/icons/ui/camera.svg', './assets/icons/ui/check.svg', './assets/icons/ui/chevron-down.svg', './assets/icons/ui/chevron-right.svg', './assets/icons/ui/clock.svg', './assets/icons/ui/compass.svg', './assets/icons/ui/flag.svg', './assets/icons/ui/grip-vertical.svg', './assets/icons/ui/house.svg', './assets/icons/ui/heart.svg', './assets/icons/ui/image-plus.svg', './assets/icons/ui/info.svg', './assets/icons/ui/landmark.svg', './assets/icons/ui/layers.svg', './assets/icons/ui/library.svg', './assets/icons/ui/link.svg', './assets/icons/ui/locate-fixed.svg', './assets/icons/ui/map-pin.svg', './assets/icons/ui/map.svg', './assets/icons/ui/minus.svg', './assets/icons/ui/navigation.svg', './assets/icons/ui/pencil.svg', './assets/icons/ui/play.svg', './assets/icons/ui/plus.svg', './assets/icons/ui/radio.svg', './assets/icons/ui/route.svg', './assets/icons/ui/search.svg', './assets/icons/ui/shuffle.svg', './assets/icons/ui/signpost.svg', './assets/icons/ui/sliders-horizontal.svg', './assets/icons/ui/sparkles.svg', './assets/icons/ui/star.svg', './assets/icons/ui/ticket-percent.svg', './assets/icons/ui/trash-2.svg', './assets/icons/ui/trees.svg', './assets/icons/ui/trophy.svg', './assets/icons/ui/user-round.svg', './assets/icons/ui/users.svg', './assets/icons/ui/utensils.svg', './assets/icons/ui/wand-sparkles.svg', './assets/icons/ui/waves.svg', './assets/icons/ui/x.svg', './assets/icons/ui/wine.svg', './assets/icons/ui/beer.svg', './assets/icons/ui/martini.svg', './assets/icons/ui/coffee.svg', './assets/icons/ui/music.svg', './assets/icons/ui/disc-3.svg', './assets/icons/ui/church.svg', './assets/icons/ui/palette.svg', './assets/icons/ui/binoculars.svg', './assets/icons/ui/store.svg', './assets/icons/ui/croissant.svg', './assets/icons/ui/cake-slice.svg', './assets/icons/ui/message-circle.svg', './assets/icons/ui/send.svg', './photo-provider-status.js?v=1', './activity-notifications.js?v=1', './activity-notifications-model.js', './direct-messages-client.js', './direct-messages-ui.js', './dm-notifications.js', './dm-notifications-model.js', './place-share-model.js', './assets/icons/ui/bell.svg'];
// Photos are cached on first view instead of up front, so installing stays light.
// A new version takes over at once (fresh copies, not the browser's HTTP cache); the page reloads itself when that happens.
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('city-route-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 // /r/... contains unique crawler metadata; NEVER cache its HTML as the generic offline index shell.
 if(u.pathname.startsWith('/r/'))return;
 const paths=FILES.map(p=>new URL(p,self.registration.scope).pathname),photo=u.pathname.startsWith(new URL('./assets/images/',self.registration.scope).pathname);
 if(!paths.includes(u.pathname)&&!photo&&e.request.mode!=='navigate')return;
 // HTML must be network-first: a stale app shell must not permanently pin buggy JS.
 if(e.request.mode==='navigate'){
  e.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const fresh=await fetch(e.request);
    if(fresh.ok){await cache.put('./index.html',fresh.clone());return fresh;}
   }catch{}
   return await cache.match('./index.html')||Response.error();
  })());
  return;
 }
 e.respondWith(caches.open(CACHE).then(async c=>{
  const cached=await c.match(e.request);if(cached)return cached;
  try{const r=await fetch(e.request);if(photo&&r.ok)c.put(e.request,r.clone());return r;}catch(error){if(e.request.mode==='navigate')return c.match('./index.html');return Response.error();}
 }));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const fallback=new URL('./#routes/community/chats',self.registration.scope);
  let target=fallback;
  try{
   const candidate=new URL(event.notification.data?.url||'',self.registration.scope);
   if(candidate.origin===self.location.origin&&/^#routes\/community\/dm\/[0-9a-f-]{36}$/i.test(candidate.hash))target=candidate;
  }catch{}
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const current=windows.find(w=>new URL(w.url).origin===target.origin);
  if(current){try{const opened=await current.navigate(target.href);await (opened||current).focus();return;}catch{}}
  await self.clients.openWindow(target.href);
 })());
});
