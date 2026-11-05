// SAVED-PLACES-SYNC runtime: "Zapisz" on the phone shows up on the desktop for the same account.
// app.js owns savedPlacesByCity and fires `cityroute:saved-changed`; this module sends the change to the account,
// keeps a small offline queue, and hands the merged result back with `cityroute:saved-synced`.
// Guests keep the local-only behaviour.
import {supabase} from './supabase-client.js';
import {DATA_KEY} from './account-scope.js';
import {syncableRef,validCity,compactPending,mergeSaved,savedSyncUnavailable} from './saved-places-model.js';

const TABLE='user_saved_places',QUEUE_PREFIX='city-route-saved-sync-v1:',REFRESH_MS=30000;
let session=null,unavailable=false,chain=Promise.resolve(),lastPull=0;

const readJSON=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
const queueKey=()=>session?.user?.id?QUEUE_PREFIX+session.user.id:null;
function queue(){const q=readJSON(queueKey())||{};return {initialized:!!q.initialized,pending:Array.isArray(q.pending)?q.pending:[]};}
function saveQueue(q){try{localStorage.setItem(queueKey(),JSON.stringify(q));}catch{}}

function stop(error){
 if(savedSyncUnavailable(error)){if(!unavailable)console.info('City Route saved-places sync unavailable until migration 018 is applied.');unavailable=true;}
 else console.warn('City Route saved-places sync:',error?.message||error);
}

async function sync(){
 if(!session?.user||unavailable||!queueKey())return;
 const {data,error}=await supabase.from(TABLE).select('city_slug,place_ref');
 if(error){stop(error);return;}
 const q=queue(),local=readJSON(DATA_KEY)?.savedPlacesByCity||{};
 const {byCity,toInsert,toDelete}=mergeSaved({local,remote:data||[],pending:q.pending,initialized:q.initialized});
 if(toInsert.length){
  const {error:e}=await supabase.from(TABLE).upsert(toInsert.map(r=>({...r,user_id:session.user.id})),{onConflict:'user_id,city_slug,place_ref',ignoreDuplicates:true});
  if(e){stop(e);return;}
 }
 for(const r of toDelete){
  const {error:e}=await supabase.from(TABLE).delete().eq('city_slug',r.city_slug).eq('place_ref',r.place_ref);
  if(e){stop(e);return;}
 }
 // Keep changes made while this sync was running; they go out on the next run.
 const sent=new Set(q.pending.map(o=>o.c+'|'+o.p+'|'+o.t));
 saveQueue({initialized:true,pending:queue().pending.filter(o=>!sent.has(o.c+'|'+o.p+'|'+o.t))});
 lastPull=Date.now();
 window.dispatchEvent(new CustomEvent('cityroute:saved-synced',{detail:{byCity}}));
}
const run=()=>{chain=chain.then(sync).catch(stop);return chain;};

window.addEventListener('cityroute:saved-changed',e=>{
 const {cityId,placeId,saved}=e.detail||{};
 if(!session?.user||unavailable||!validCity(cityId)||!syncableRef(placeId))return;
 const q=queue();
 q.pending=compactPending([...q.pending,{c:cityId,p:String(placeId),s:!!saved,t:Date.now()}]);
 saveQueue(q);
 run();
});

// Pick up changes made on another device when the app comes back to the foreground.
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&session?.user&&Date.now()-lastPull>REFRESH_MS)run();
});
window.addEventListener('online',()=>{if(session?.user)run();});

supabase.auth.onAuthStateChange((event,next)=>{
 session=next||null;
 // auth-enhancements switches the local account scope first; sync after it settles.
 if(session)setTimeout(run,1200);
});
supabase.auth.getSession().then(({data})=>{session=data?.session||null;if(session)setTimeout(run,1200);}).catch(()=>{});
