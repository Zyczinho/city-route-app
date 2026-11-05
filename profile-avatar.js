// PROFILE-AVATAR runtime: uploads the profile photo to the signed-in account and restores it on every device.
// app.js keeps owning the local photo (state.profile.photo) and fires `cityroute:avatar-changed` /
// `cityroute:avatar-removed`; this module only syncs. Guests keep the local-only behaviour.
import {supabase,SUPABASE_URL} from './supabase-client.js';
import {DATA_KEY,scopedKey} from './account-scope.js';
import {AVATAR_BUCKET,avatarPath,avatarUrl,avatarPlan,isLocalPhoto,jpegBlobFromDataUrl,avatarSyncUnavailable} from './profile-avatar-model.js';

let session=null,unavailable=false,busy=null;
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};

function stop(error){
 if(avatarSyncUnavailable(error)){if(!unavailable)console.info('City Route avatar sync unavailable until migration 017 is applied.');unavailable=true;}
 else console.warn('City Route avatar sync:',error?.message||error);
}

// app.js owns the in-memory state: hand it the change instead of writing localStorage behind its back.
function setLocal(photo,{pending=false}={}){
 window.dispatchEvent(new CustomEvent('cityroute:avatar-synced',{detail:{photo:photo||null,pending:!!pending}}));
}

async function upload(photo){
 const user=session?.user,path=avatarPath(user?.id),blob=jpegBlobFromDataUrl(photo);
 if(!path||!blob||unavailable)return false;
 const {error}=await supabase.storage.from(AVATAR_BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'60'});
 if(error){stop(error);return false;}
 const {error:dbError}=await supabase.from('profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',user.id);
 if(dbError){stop(dbError);return false;}
 return true;
}

async function hydrate(){
 if(!session?.user||unavailable)return;
 const {data,error}=await supabase.from('profiles').select('avatar_path,updated_at').eq('id',session.user.id).maybeSingle();
 if(error){stop(error);return;}
 const local=read(DATA_KEY),guest=read(scopedKey('guest'));
 const plan=avatarPlan({remotePath:data?.avatar_path,localPhoto:local?.profile?.photo,pending:!!local?.profile?.avatarPending,guestPhoto:guest?.profile?.photo});
 if(plan.action==='use-remote'){setLocal(avatarUrl(data.avatar_path,data.updated_at,SUPABASE_URL));return;}
 if(plan.action==='upload'){
  if(plan.fromGuest)setLocal(plan.photo,{pending:true});
  if(await upload(plan.photo))setLocal(plan.photo);
 }
}

const run=fn=>{busy=(busy||Promise.resolve()).then(fn).catch(stop);return busy;};

window.addEventListener('cityroute:avatar-changed',()=>{
 const photo=read(DATA_KEY)?.profile?.photo;
 if(!session?.user||!isLocalPhoto(photo))return;
 setLocal(photo,{pending:true});
 run(async()=>{if(await upload(photo))setLocal(photo);});
});
window.addEventListener('cityroute:avatar-removed',()=>{
 if(!session?.user||unavailable)return;
 const path=avatarPath(session.user.id);
 run(async()=>{
  const {error}=await supabase.from('profiles').update({avatar_path:null,updated_at:new Date().toISOString()}).eq('id',session.user.id);
  if(error){stop(error);return;}
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
 });
});

supabase.auth.onAuthStateChange((event,next)=>{
 session=next||null;
 // auth-enhancements switches the local account scope first; sync after it settles.
 if(session)setTimeout(()=>run(hydrate),1200);
});
supabase.auth.getSession().then(({data})=>{session=data?.session||null;if(session)setTimeout(()=>run(hydrate),1200);}).catch(()=>{});
