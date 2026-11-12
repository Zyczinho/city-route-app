// SAVED-PLACES-SYNC V3: lossless account union, including private u-* bookmarks.
// Account-owned Supabase rows are authoritative after first import; guest history
// can be imported separately with an explicit action, without touching guest data.
import {supabase} from './supabase-client.js';
import {DATA_KEY,ACTIVE_KEY,scopeFor,scopedKey} from './account-scope.js';
import {syncableRef,validCity,compactPending,mergeSaved,mergeLocalSources,recoverSyncQueue,placeSnapshot,savedSyncUnavailable} from './saved-places-model.js';

const TABLE='user_saved_places',QUEUE_PREFIX='city-route-saved-sync-v3:';
const OLD_QUEUE_PREFIX='city-route-saved-sync-v2:',FIRST_QUEUE_PREFIX='city-route-saved-sync-v1:';
const BACKUP_PREFIX='city-route-saved-before-v3:',OLD_BACKUP_PREFIX='city-route-saved-before-v2:';
const GUEST_IMPORT_PREFIX='city-route-guest-saved-import-v3:',REFRESH_MS=60000;
let session=null,unavailable=false,chain=Promise.resolve(),lastPull=0,authTimer=null,currentStatus=null;
const readJSON=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
const queueKey=id=>QUEUE_PREFIX+id;
const guestKey=id=>GUEST_IMPORT_PREFIX+id;
const sameAccount=id=>session?.user?.id===id&&localStorage.getItem(ACTIVE_KEY)===scopeFor(id);
const opSignature=op=>[op.c,op.p,op.s,op.t].join('|');
function queueFor(id){
 return recoverSyncQueue(readJSON(queueKey(id)),readJSON(OLD_QUEUE_PREFIX+id)||readJSON(FIRST_QUEUE_PREFIX+id));
}
function report(status){
 if(currentStatus===status)return;
 currentStatus=status;
 window.dispatchEvent(new CustomEvent('cityroute:saved-sync-status',{detail:{status}}));
}
function persistQueue(id,q){
 try{localStorage.setItem(queueKey(id),JSON.stringify(q));return true;}
 catch(error){console.warn('Saved places queue:',error);report('error');return false;}
}
function accountSnapshots(id,initial,importGuest){
 const active=readJSON(DATA_KEY)||{};
 if(!initial&&!importGuest)return mergeLocalSources(active);
 const sources=[active];
 // Safe, one-time recovery for the SAME account; we do not automatically import guest data.
 if(initial){
  sources.push(readJSON(scopedKey(scopeFor(id))),readJSON(OLD_BACKUP_PREFIX+id),
               readJSON(BACKUP_PREFIX+id));
 }
 if(importGuest)sources.push(readJSON(scopedKey('guest')));
 return mergeLocalSources(...sources);
}
function backupBeforeRecovery(id,local){
 const key=BACKUP_PREFIX+id;
 if(localStorage.getItem(key)!==null)return;
 // Store compact place descriptions, not multi-megabyte device-only photo data.
 const compact={savedPlacesByCity:local.savedPlacesByCity,
   userPlaces:local.userPlaces.map(placeSnapshot).filter(Boolean),createdAt:new Date().toISOString()};
 localStorage.setItem(key,JSON.stringify(compact));
}
function stop(error){
 if(savedSyncUnavailable(error)){unavailable=true;console.warn('Saved places table is unavailable.');}
 else console.warn('Saved places sync:',error?.message||error);
 report('error');
}
async function sync(){
 const id=session?.user?.id;
 if(!id||unavailable||!sameAccount(id))return;
 if(navigator.onLine===false){report('offline');return;}
 report('syncing');
 try{
  const q=queueFor(id),guestImport=localStorage.getItem(guestKey(id))==='pending';
  const localState=accountSnapshots(id,!q.initialized,guestImport);
  if(!q.initialized)backupBeforeRecovery(id,localState);
  const local=localState.savedPlacesByCity;

  const {data:remote,error:readError}=await supabase.from(TABLE)
   .select('city_slug,place_ref,place_snapshot').eq('user_id',id);
  if(readError)throw readError;
  if(!sameAccount(id))return;
  const proposal=mergeSaved({local,remote:remote||[],pending:q.pending,
    initialized:q.initialized&&!guestImport,userPlaces:localState.userPlaces});
  if(proposal.toInsert.length){
   const {error}=await supabase.from(TABLE).upsert(
    proposal.toInsert.map(row=>({...row,user_id:id,place_snapshot:row.place_snapshot||null})),
    {onConflict:'user_id,city_slug,place_ref',ignoreDuplicates:true}
   );
   if(error)throw error;
   if(!sameAccount(id))return;
  }
  for(const row of proposal.toDelete){
   const {error}=await supabase.from(TABLE).delete()
    .eq('user_id',id).eq('city_slug',row.city_slug).eq('place_ref',row.place_ref);
   if(error)throw error;
   if(!sameAccount(id))return;
  }
  // Confirm *both* catalogue IDs and user-created place payloads on the server.
  const {data:confirmed,error:confirmError}=await supabase.from(TABLE)
   .select('city_slug,place_ref,place_snapshot').eq('user_id',id);
  if(confirmError)throw confirmError;
  if(!sameAccount(id))return;
  const refs=new Map((confirmed||[]).map(row=>[row.city_slug+'|'+row.place_ref,row]));
  if(proposal.toInsert.some(row=>{
   const found=refs.get(row.city_slug+'|'+row.place_ref);
   return !found||(row.place_snapshot&&!found.place_snapshot);
  })||proposal.toDelete.some(row=>refs.has(row.city_slug+'|'+row.place_ref))){
   throw new Error('Saved places were not confirmed by the account.');
  }
  const sent=new Set(q.pending.map(opSignature));
  const remaining=queueFor(id).pending.filter(op=>!sent.has(opSignature(op)));
  if(!persistQueue(id,{initialized:true,pending:remaining}))return;
  if(guestImport)localStorage.setItem(guestKey(id),'done');
  // A new bookmark can arrive while an earlier request is in flight.
  const next=mergeSaved({local:readJSON(DATA_KEY)?.savedPlacesByCity||{},
   remote:confirmed||[],pending:queueFor(id).pending,initialized:true,
   userPlaces:readJSON(DATA_KEY)?.userPlaces||[]});
  lastPull=Date.now();
  window.dispatchEvent(new CustomEvent('cityroute:saved-synced',
   {detail:{byCity:next.byCity,userPlaces:next.userPlaces,userId:id}}));
  report('synced');
 }catch(error){stop(error);}
}
const run=()=>{chain=chain.then(sync).catch(stop);return chain;};

window.addEventListener('cityroute:saved-changed',event=>{
 const {cityId,placeId,saved}=event.detail||{};
 const id=session?.user?.id;
 if(!id||!sameAccount(id)||!validCity(cityId)||!syncableRef(placeId))return;
 const q=queueFor(id);
 q.pending=compactPending([...q.pending,{c:cityId,p:String(placeId),s:!!saved,t:Date.now()}]);
 if(persistQueue(id,q))run();
});
window.addEventListener('cityroute:saved-import-guest',()=>{
 const id=session?.user?.id;
 if(!id||!sameAccount(id))return;
 const source=readJSON(scopedKey('guest'));
 if(!source||!Object.values(source.savedPlacesByCity||{}).some(a=>Array.isArray(a)&&a.length))return;
 try{localStorage.setItem(guestKey(id),'pending');run();}catch(e){stop(e);}
});
window.addEventListener('cityroute:saved-sync-request',()=>{if(session?.user)run();});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&session?.user&&Date.now()-lastPull>3000)run();
});
window.addEventListener('focus',()=>{if(session?.user&&Date.now()-lastPull>3000)run();});
window.addEventListener('online',()=>{if(session?.user)run();});
setInterval(()=>{if(document.visibilityState==='visible'&&session?.user&&Date.now()-lastPull>REFRESH_MS)run();},REFRESH_MS);
function authChanged(next){
 const previous=session?.user?.id||null;
 session=next||null;
 if(previous!==session?.user?.id){lastPull=0;unavailable=false;currentStatus=null;}
 clearTimeout(authTimer);
 if(session?.user)authTimer=setTimeout(run,1200);
 else report('guest');
}
supabase.auth.onAuthStateChange((_event,next)=>authChanged(next));
supabase.auth.getSession().then(({data})=>{
 if(!session)authChanged(data?.session||null);
}).catch(stop);
