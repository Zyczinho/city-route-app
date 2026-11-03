// Main photo for each route. Rule from the product owner: no two routes may ever show the same main photo,
// even when they share stops. Editorial routes carry their own `image`; other routes (generated, user) borrow
// a stop photo that no other route already uses, or get no photo rather than a duplicate.

export const coverKey=image=>{
  const s=String(image||'').trim();if(!s)return '';
  const file=s.split(/[?#]/)[0].split('/').pop();
  return decodeURIComponent(file).toLowerCase().replace(/^\d+px-/,'');
};

const lookup=places=>typeof places==='function'?places:places instanceof Map?id=>places.get(id):id=>(places||[]).find(p=>p.id===id);

// routes: in display priority order (earlier routes keep their photo). Returns Map(routeId -> cover|null),
// cover = {image, imageCaption, imageCredit, source:'route'|'stop', placeId?}.
export function assignRouteCovers(routes,places,{reserved=[]}={}){
  const find=lookup(places),used=new Set(reserved.map(coverKey).filter(Boolean)),out=new Map();
  const take=(r,cover)=>{used.add(coverKey(cover.image));out.set(r.id,cover);};
  for(const r of routes){
    const key=coverKey(r.image);
    if(key&&!used.has(key))take(r,{image:r.image,imageCaption:r.imageCaption||r.name,imageCredit:r.imageCredit||null,source:'route'});
  }
  for(const r of routes){
    if(out.has(r.id))continue;
    const stop=(r.stops||[]).map(find).find(p=>p?.image&&!used.has(coverKey(p.image)));
    if(stop)take(r,{image:stop.image,imageCaption:stop.imageCaption||stop.name,imageCredit:stop.imageCredit||null,source:'stop',placeId:stop.id});
    else out.set(r.id,null);
  }
  return out;
}

// Editorial data check: returns [{key, routes:[ids]}] for every photo used by more than one route.
export function duplicateCovers(routes){
  const by=new Map();
  for(const r of routes){const k=coverKey(r.image);if(k)by.set(k,[...(by.get(k)||[]),r.id]);}
  return [...by].filter(([,ids])=>ids.length>1).map(([key,routes])=>({key,routes}));
}
