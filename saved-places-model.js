// SAVED-PLACES-SYNC V3: a signed-in account stores the union of bookmarked catalogue
// and user-created places. Pure reconciliation rules; no network or localStorage here.
const REF=/^[A-Za-z0-9_.:-]{1,120}$/;
const CITY=/^[a-z0-9-]{1,40}$/;
const key=(city,ref)=>city+'\u0000'+ref;
export const validCity=city=>CITY.test(String(city||''));
export const syncableRef=ref=>REF.test(String(ref||''));
export const isPrivateRef=ref=>/^u-/.test(String(ref||''));
const safeUrl=url=>typeof url==='string'&&/^(https?:\/\/|\.\/|\/)/i.test(url)&&url.length<1200?url:null;

// Never upload device-only data: photos may be base64 and are deliberately kept local.
// The coordinate/name/details are sufficient to display the private place on a second device.
export function placeSnapshot(place){
 if(!place||!isPrivateRef(place.id)||!syncableRef(place.id)||!validCity(place.cityId)||!String(place.name||'').trim())return null;
 const src=place;
 const words=(items,max)=>Array.isArray(items)?items.filter(s=>typeof s==='string').slice(0,max).map(s=>s.slice(0,120)):[];
 const number=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
 return {
  id:String(src.id),cityId:String(src.cityId),kind:'user',
  visibility:src.visibility==='public'?'public':'private',
  name:String(src.name).slice(0,120),area:String(src.area||'Twoje miejsce').slice(0,150),
  description:String(src.description||'').slice(0,700),categoryId:String(src.categoryId||'hidden_gem').slice(0,80),
  cats:words(src.cats,6),tags:words(src.tags,12),lat:number(src.lat),lng:number(src.lng),
  minutes:number(src.minutes,20),cost:number(src.cost),
  tourist:String(src.tourist||'local').slice(0,40),foodStyle:String(src.foodStyle||'none').slice(0,40),
  partner:false,ratings:[],googlePlaceId:String(src.googlePlaceId||'').slice(0,140)||null,
  image:safeUrl(src.image),images:words(src.images,5).filter(v=>safeUrl(v)).map(v=>v),
  sourceUrl:safeUrl(src.sourceUrl),createdAt:String(src.createdAt||'').slice(0,40),
  verification:{editorial:false,community:false},
  submissionStatus:String(src.submissionStatus||'').slice(0,40)||null
 };
}
export function compactPending(ops=[]){
 const last=new Map();
 for(const op of ops)if(op&&validCity(op.c)&&syncableRef(op.p))last.set(key(op.c,op.p),{c:op.c,p:String(op.p),s:!!op.s,t:op.t||0});
 return [...last.values()];
}
export function recoverSyncQueue(current,legacy){
 if(current&&typeof current==='object')return {initialized:!!current.initialized,pending:compactPending(current.pending)};
 return {initialized:false,pending:compactPending(legacy?.pending)};
}
export function mergeLocalSources(...sources){
 const savedPlacesByCity={},userPlaces=[],seenPlaces=new Set();
 for(const src of sources){
  if(!src||typeof src!=='object')continue;
  for(const [c,ids] of Object.entries(src.savedPlacesByCity||{})){
   if(!validCity(c)||!Array.isArray(ids))continue;
   const acc=savedPlacesByCity[c]||[];
   for(const id of ids)if(syncableRef(id)&&!acc.includes(String(id)))acc.push(String(id));
   savedPlacesByCity[c]=acc;
  }
  for(const p of src.userPlaces||[]){
   const snap=placeSnapshot(p);
   if(!snap||seenPlaces.has(key(snap.cityId,snap.id)))continue;
   seenPlaces.add(key(snap.cityId,snap.id));userPlaces.push(p);
  }
 }
 return {savedPlacesByCity,userPlaces};
}
// On first V3 sync every device contributes its bookmarks. On subsequent syncs,
// only confirmed server rows and explicit queued actions decide catalogue saves.
export function mergeSaved({local={},remote=[],pending=[],initialized=false,userPlaces=[]}={}){
 const sets=new Map(),toInsert=[],toDelete=[],privateMap=new Map(),remotePrivate=[];
 const setFor=c=>{if(!sets.has(c))sets.set(c,new Set());return sets.get(c);};
 for(const place of userPlaces){
  const snap=placeSnapshot(place);
  if(snap)privateMap.set(key(snap.cityId,snap.id),snap);
 }
 for(const row of remote){
  if(!validCity(row?.city_slug)||!syncableRef(row?.place_ref))continue;
  if(isPrivateRef(row.place_ref)){
   const snap=placeSnapshot(row.place_snapshot);
   if(!snap||snap.cityId!==row.city_slug||snap.id!==row.place_ref)continue;
   remotePrivate.push(snap);
  }
  setFor(row.city_slug).add(String(row.place_ref));
 }
 const inserted=new Set(),deleted=new Set(),removedHere=new Set();
 const add=c=>p=>{
  const id=key(c,p);
  if(inserted.has(id)||deleted.has(id))return;
  const row={city_slug:c,place_ref:p};
  if(isPrivateRef(p)){
   const snap=privateMap.get(id);
   if(!snap)return;
   row.place_snapshot=snap;
  }
  toInsert.push(row);inserted.add(id);
 };
 for(const op of compactPending(pending)){
  const s=setFor(op.c),id=key(op.c,op.p);
  if(op.s){
   if(!s.has(op.p)){s.add(op.p);add(op.c)(op.p);}
  }else{
   removedHere.add(id);
   if(s.has(op.p)){s.delete(op.p);if(!deleted.has(id)){toDelete.push({city_slug:op.c,place_ref:op.p});deleted.add(id);}}
  }
 }
 if(!initialized){
  for(const [c,ids] of Object.entries(local||{})){
   if(!validCity(c)||!Array.isArray(ids))continue;
   const s=setFor(c);
   for(const id of ids){
    const p=String(id);
    if(!syncableRef(p)||s.has(p)||removedHere.has(key(c,p)))continue;
    if(isPrivateRef(p)&&!privateMap.has(key(c,p)))continue;
    s.add(p);add(c)(p);
   }
  }
 }
 const byCity={};
 for(const c of new Set([...Object.keys(local||{}).filter(validCity),...sets.keys()])){
  const account=sets.get(c)||new Set(),here=Array.isArray(local?.[c])?local[c].map(String):[];
  // Do not silently discard a device-only private place if its payload is not yet on the server.
  const kept=here.filter(id=>!syncableRef(id)||account.has(id)||(!initialized&&isPrivateRef(id)&&privateMap.has(key(c,id))&&!removedHere.has(key(c,id))));
  byCity[c]=[...new Set([...kept,...account].filter(id=>!removedHere.has(key(c,id))))];
 }
 const mergedPlaces=[...userPlaces],seen=new Set(userPlaces.map(p=>key(p.cityId,p.id)));
 for(const p of remotePrivate)if(!seen.has(key(p.cityId,p.id))){mergedPlaces.push(p);seen.add(key(p.cityId,p.id));}
 return {byCity,toInsert,toDelete,userPlaces:mergedPlaces};
}
export const sameLists=(a=[],b=[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export const savedSyncUnavailable=error=>{
 const code=String(error?.code||''),msg=String(error?.message||'');
 return code==='42P01'||code==='PGRST205'||/user_saved_places/i.test(msg)&&/does not exist|schema cache/i.test(msg);
};
