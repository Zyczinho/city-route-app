// SAVED-PLACES-SYNC (founder report 2026-11-05): saved places follow the signed-in account across devices.
// Pure merge rules only, covered by node tests. Runtime lives in saved-places-sync.js.

const REF=/^[A-Za-z0-9_.:-]{1,120}$/;
const CITY=/^[a-z0-9-]{1,40}$/;

// Private places created on one device ("u-…") exist only there, so they are never sent to the account.
export const syncableRef=ref=>REF.test(String(ref||''))&&!/^u-/.test(String(ref));
export const validCity=city=>CITY.test(String(city||''));
const key=(city,ref)=>city+'\u0000'+ref;

// Keep only the latest change per place.
export function compactPending(ops=[]){
 const last=new Map();
 for(const op of ops)if(op&&validCity(op.c)&&syncableRef(op.p))last.set(key(op.c,op.p),{c:op.c,p:op.p,s:!!op.s,t:op.t||0});
 return [...last.values()];
}

// local:   {cityId:[placeId,…]} from this device
// remote:  [{city_slug,place_ref}] from the account
// pending: changes made here that the account has not confirmed yet
// initialized: false the first time this account syncs on this device → this device's saves are added, not lost
export function mergeSaved({local={},remote=[],pending=[],initialized=false}={}){
 const sets=new Map(),toInsert=[],toDelete=[];
 const setFor=c=>{if(!sets.has(c))sets.set(c,new Set());return sets.get(c);};
 for(const row of remote)if(validCity(row?.city_slug)&&syncableRef(row?.place_ref))setFor(row.city_slug).add(row.place_ref);
 const ops=compactPending(pending),removedHere=new Set();
 for(const op of ops){
  const s=setFor(op.c);
  if(op.s){if(!s.has(op.p)){s.add(op.p);toInsert.push({city_slug:op.c,place_ref:op.p});}}
  else{removedHere.add(key(op.c,op.p));if(s.has(op.p)){s.delete(op.p);toDelete.push({city_slug:op.c,place_ref:op.p});}}
 }
 if(!initialized){
  for(const [c,ids] of Object.entries(local||{})){
   if(!validCity(c)||!Array.isArray(ids))continue;
   const s=setFor(c);
   for(const id of ids)if(syncableRef(id)&&!s.has(id)&&!removedHere.has(key(c,id))){s.add(id);toInsert.push({city_slug:c,place_ref:id});}
  }
 }
 const byCity={};
 const cities=new Set([...Object.keys(local||{}).filter(validCity),...sets.keys()]);
 for(const c of cities){
  const account=sets.get(c)||new Set(),here=Array.isArray(local?.[c])?local[c]:[];
  // Keep this device's order, drop what the account no longer has, keep private "u-" places, append new ones.
  const kept=here.filter(id=>!syncableRef(id)||account.has(id));
  const added=[...account].filter(id=>!kept.includes(id));
  byCity[c]=[...kept,...added];
 }
 return {byCity,toInsert,toDelete};
}

export const sameLists=(a=[],b=[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);

// Table not deployed yet (migration 018): keep local-only behaviour.
export const savedSyncUnavailable=error=>{
 const code=String(error?.code||''),msg=String(error?.message||'');
 return code==='42P01'||code==='PGRST205'||/user_saved_places/i.test(msg)&&/does not exist|schema cache/i.test(msg);
};
