// SAVED-PLACES-SYNC V2: preserve local bookmarks on first upgrade, then use the signed-in
// account as the source of truth. Private u-* places intentionally stay on this device.
import {supabase} from './supabase-client.js';
import {DATA_KEY,ACTIVE_KEY,scopeFor} from './account-scope.js';
import {syncableRef,validCity,compactPending,mergeSaved,recoverSyncQueue,savedSyncUnavailable} from './saved-places-model.js';

const TABLE='user_saved_places',QUEUE_PREFIX='city-route-saved-sync-v2:';
const LEGACY_QUEUE_PREFIX='city-route-saved-sync-v1:';
const BACKUP_PREFIX='city-route-saved-before-v2:',REFRESH_MS=60000;
let session=null,unavailable=false,chain=Promise.resolve(),lastPull=0,authTimer=null;
let currentStatus=null;

const readJSON=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
const queueKey=userId=>QUEUE_PREFIX+userId;
const queueFor=userId=>recoverSyncQueue(readJSON(queueKey(userId)),readJSON(LEGACY_QUEUE_PREFIX+userId));
const sameAccount=userId=>session?.user?.id===userId&&localStorage.getItem(ACTIVE_KEY)===scopeFor(userId);
const opSignature=op=>[op.c,op.p,op.s,op.t].join('|');

function report(status){
 if(currentStatus===status)return;
 currentStatus=status;
 window.dispatchEvent(new CustomEvent('cityroute:saved-sync-status',{detail:{status}}));
}
function persistQueue(userId,q){
 try{localStorage.setItem(queueKey(userId),JSON.stringify(q));return true;}
 catch(error){console.warn('City Route saved-places queue storage:',error);report('error');return false;}
}
function backupBeforeRecovery(userId,local){
 const key=BACKUP_PREFIX+userId;
 if(localStorage.getItem(key)!==null)return;
 // No cloud deletion or guest import: the snapshot is only the active account on this device.
 localStorage.setItem(key,JSON.stringify({savedPlacesByCity:local,createdAt:new Date().toISOString()}));
}
function stop(error){
 if(savedSyncUnavailable(error)){
  unavailable=true;
  console.warn('City Route saved-places sync: database table is unavailable.');
 }else console.warn('City Route saved-places sync:',error?.message||error);
 report('error');
}

async function sync(){
 const userId=session?.user?.id;
 if(!userId||unavailable||!sameAccount(userId))return;
 if(navigator.onLine===false){report('offline');return;}
 report('syncing');
 try{
  const q=queueFor(userId);
  const local=readJSON(DATA_KEY)?.savedPlacesByCity||{};
  if(!q.initialized)backupBeforeRecovery(userId,local);

  const {data:remote,error:readError}=await supabase.from(TABLE)
   .select('city_slug,place_ref').eq('user_id',userId);
  if(readError)throw readError;
  if(!sameAccount(userId))return;
  const {toInsert,toDelete}=mergeSaved({local,remote:remote||[],pending:q.pending,initialized:q.initialized});

  if(toInsert.length){
   const {error}=await supabase.from(TABLE).upsert(
    toInsert.map(row=>({...row,user_id:userId})),
    {onConflict:'user_id,city_slug,place_ref',ignoreDuplicates:true}
   );
   if(error)throw error;
   if(!sameAccount(userId))return;
  }
  for(const row of toDelete){
   const {error}=await supabase.from(TABLE).delete()
    .eq('user_id',userId).eq('city_slug',row.city_slug).eq('place_ref',row.place_ref);
   if(error)throw error;
   if(!sameAccount(userId))return;
  }

  // Read back confirmed server state. An ignored/blocked write may otherwise look successful
  // locally and remove the only copy of a bookmark.
  const {data:confirmed,error:confirmError}=await supabase.from(TABLE)
   .select('city_slug,place_ref').eq('user_id',userId);
  if(confirmError)throw confirmError;
  if(!sameAccount(userId))return;
  const confirmedRefs=new Set((confirmed||[]).map(row=>row.city_slug+'|'+row.place_ref));
  if(toInsert.some(row=>!confirmedRefs.has(row.city_slug+'|'+row.place_ref))||
     toDelete.some(row=>confirmedRefs.has(row.city_slug+'|'+row.place_ref))){
   throw new Error('Server did not confirm saved-place changes.');
  }

  // A click can happen during an awaited network call. Never discard the newer local operation
  // or replace the current UI with a snapshot from before that click.
  const sent=new Set(q.pending.map(opSignature));
  const remaining=queueFor(userId).pending.filter(op=>!sent.has(opSignature(op)));
  if(!persistQueue(userId,{initialized:true,pending:remaining}))return;
  const latestPending=queueFor(userId).pending;
  const latestLocal=readJSON(DATA_KEY)?.savedPlacesByCity||{};
  const byCity=mergeSaved({local:latestLocal,remote:confirmed||[],pending:latestPending,initialized:true}).byCity;
  lastPull=Date.now();
  window.dispatchEvent(new CustomEvent('cityroute:saved-synced',{detail:{byCity,userId}}));
  report('synced');
 }catch(error){stop(error);}
}
const run=()=>{chain=chain.then(sync).catch(stop);return chain;};

window.addEventListener('cityroute:saved-changed',event=>{
 const {cityId,placeId,saved}=event.detail||{};
 const userId=session?.user?.id;
 if(!userId||!sameAccount(userId)||!validCity(cityId)||!syncableRef(placeId))return;
 const q=queueFor(userId);
 q.pending=compactPending([...q.pending,{c:cityId,p:String(placeId),s:!!saved,t:Date.now()}]);
 if(persistQueue(userId,q))run();
});

window.addEventListener('cityroute:saved-sync-request',()=>{if(session?.user)run();});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&session?.user&&Date.now()-lastPull>3000)run();
});
window.addEventListener('focus',()=>{if(session?.user&&Date.now()-lastPull>3000)run();});
window.addEventListener('online',()=>{if(session?.user)run();});
setInterval(()=>{
 if(document.visibilityState==='visible'&&session?.user&&Date.now()-lastPull>REFRESH_MS)run();
},REFRESH_MS);

function authChanged(next){
 const previous=session?.user?.id||null;
 session=next||null;
 if(previous!==session?.user?.id){
  lastPull=0;unavailable=false;currentStatus=null;
 }
 clearTimeout(authTimer);
 if(session?.user){
  // auth-enhancements activates the account-local snapshot (and reloads when necessary).
  authTimer=setTimeout(run,1200);
 }else report('guest');
}
supabase.auth.onAuthStateChange((_event,next)=>authChanged(next));
supabase.auth.getSession().then(({data})=>{
 // Do not overwrite a newer auth event with an older getSession result.
 if(!session)authChanged(data?.session||null);
}).catch(stop);
