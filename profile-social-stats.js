// PROFILE-SOCIAL-055 — persistent counters, distinct from local route activity.
import {supabase} from './supabase-client.js';

let generation=0;
async function refresh(){
 const panel=document.querySelector('[data-profile-social-counts]');
 if(!panel)return;
 const current=++generation;
 try{
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(current!==generation||!panel.isConnected)return;
  if(sessionError||!session?.user?.id){panel.hidden=true;return;}
  panel.hidden=false;
  const uid=session.user.id;
  const [followers,following,friends]=await Promise.allSettled([
   supabase.from('user_follows').select('follower_id',{count:'exact',head:true}).eq('followed_id',uid),
   supabase.from('user_follows').select('followed_id',{count:'exact',head:true}).eq('follower_id',uid),
   supabase.rpc('my_friends')
  ]);
  if(current!==generation||!panel.isConnected)return;
  const put=(name,value)=>{
   const node=panel.querySelector('[data-profile-'+name+']');
   if(node)node.textContent=Number.isSafeInteger(value)&&value>=0?new Intl.NumberFormat('pl-PL').format(value):'—';
  };
  const countFrom=result=>result.status==='fulfilled'&&!result.value.error?Number(result.value.count):NaN;
  put('followers',countFrom(followers));
  put('following',countFrom(following));
  const items=friends.status==='fulfilled'&&!friends.value.error?friends.value.data:null;
  put('friends',Array.isArray(items)?items.filter(v=>v.friend_status==='accepted').length:NaN);
 }catch{
  if(panel.isConnected)panel.hidden=true;
 }
}
const queue=()=>{void refresh();};
window.addEventListener('cityroute:profile-rendered',queue);
window.addEventListener('hashchange',queue);
supabase.auth.onAuthStateChange(()=>{setTimeout(queue,0);});
queue();
