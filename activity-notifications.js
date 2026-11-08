// One persistent City Route activity inbox: private messages, group messages and friend invitations.
// Body content is intentionally absent; only safe, generated internal paths are opened.
import {supabase} from './supabase-client.js';
import {activityLabel,activityTarget} from './activity-notifications-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,feedChannel=null,unread=0,initialized=false,lastItems=[],filter='all';
const root=()=>document.querySelector('#main');
function headerBell(){
 const right=document.querySelector('.top .right');if(!right)return null;
 let anchor=right.querySelector('[data-notifications-link]');
 if(!anchor){
  anchor=document.createElement('a');anchor.href='#routes/community/notifications';
  anchor.className='activity-bell';anchor.dataset.notificationsLink='';
  anchor.setAttribute('aria-label','Powiadomienia City Route');
  anchor.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/bell.svg)" aria-hidden="true"></span><span class="activity-count" hidden></span>';
  right.insertBefore(anchor,right.querySelector('#me')||null);
 }
 return anchor;
}
function updateBell(){
 const bell=headerBell();if(!bell)return;
 const count=bell.querySelector('.activity-count');count.hidden=unread===0;
 count.textContent=unread>99?'99+':String(unread);
 bell.setAttribute('aria-label',unread?'Powiadomienia City Route, '+unread+' nieprzeczytanych':'Powiadomienia City Route');
}
async function reloadCount(){
 if(!me)return;
 const id=me;
 try{
  const {count,error}=await supabase.from('activity_notifications').select('id',{head:true,count:'exact'}).eq('recipient_id',id).is('read_at',null);
  if(error||id!==me)return;
  unread=Math.max(0,Number(count)||0);updateBell();
 }catch{}
}
function inAppAlert(notification){
 if(notification.kind==='direct_message')return;// Existing DM alert already handles direct messages.
 let notice=document.getElementById('activity-alert');
 if(!notice){notice=document.createElement('aside');notice.id='activity-alert';notice.className='activity-alert';
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  notice.innerHTML='<span data-activity-notice-title></span><a data-activity-notice-target>Otwórz</a><button type="button" data-dismiss-activity-alert aria-label="Zamknij">×</button>';
  document.body.append(notice);}
 const title=activityLabel(notification.kind).label;
 notice.querySelector('[data-activity-notice-title]').textContent=title;
 notice.querySelector('[data-activity-notice-target]').href=activityTarget(notification.target_hash);
 notice.querySelector('[data-dismiss-activity-alert]').onclick=()=>notice.remove();
}
async function onIncoming(item){
 if(item?.recipient_id!==me)return;
 await reloadCount();
 if(document.visibilityState==='visible'&&location.hash!=='#routes/community/notifications')inAppAlert(item);
 if(location.hash==='#routes/community/notifications')void renderActivityCenter({session:{user:{id:me}},shell:globalThis.__activityShell});
}
function bindSession(session){
 const id=session?.user?.id||null;if(id===me)return;
 if(feedChannel){void supabase.removeChannel(feedChannel);feedChannel=null;}
 me=id;unread=0;lastItems=[];updateBell();document.getElementById('activity-alert')?.remove();
 if(!id)return;
 feedChannel=supabase.channel('city-route-activity-'+id)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'activity_notifications',filter:'recipient_id=eq.'+id},payload=>{void onIncoming(payload.new);})
  .subscribe();
 void reloadCount();
}
export async function renderActivityCenter({session,shell}){
 if(typeof shell==='function')globalThis.__activityShell=shell;
 if(!session?.user?.id){shell('Powiadomienia','<p class="community-empty-inline">Zaloguj się, aby zobaczyć swoje powiadomienia.</p>');return;}
 const userId=session.user.id;
 shell('Powiadomienia','<p class="community-status">Wczytujemy aktywności…</p>');
 const {data,error}=await supabase.from('activity_notifications')
  .select('id,kind,actor_id,target_hash,created_at,read_at')
  .eq('recipient_id',userId).order('created_at',{ascending:false}).limit(100);
 if(location.hash!=='#routes/community/notifications'||me!==userId)return;
 if(error){shell('Powiadomienia','<p class="community-status error">Nie udało się wczytać powiadomień.</p>');return;}
 lastItems=data||[];
 const shown=filter==='unread'?lastItems.filter(x=>!x.read_at):lastItems;
 const date=value=>{try{return new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return '';}};
 const items=shown.map(item=>{
  const info=activityLabel(item.kind),unread=!item.read_at;
  return '<a class="activity-entry '+(unread?'unread':'')+'" href="'+esc(activityTarget(item.target_hash))+'" data-activity-open="'+item.id+'">'+
   '<span class="activity-icon" aria-hidden="true"><span class="i" style="--i:url(./assets/icons/ui/bell.svg)"></span></span>'+
   '<span class="activity-copy"><strong>'+esc(info.label)+'</strong><small>'+esc(info.detail)+'</small></span>'+
   '<time>'+esc(date(item.created_at))+'</time>'+(unread?'<span class="activity-dot" aria-label="Nieprzeczytane"></span>':'')+'</a>';
 }).join('');
 shell('Powiadomienia','<div class="activity-controls"><p class="lead">Wiadomości, grupy i znajomi — wszystko w jednym miejscu.</p>'+
  '<div class="activity-filter"><button type="button" data-activity-filter="all" aria-pressed="'+(filter==='all')+'">Wszystkie</button>'+
  '<button type="button" data-activity-filter="unread" aria-pressed="'+(filter==='unread')+'">Nieprzeczytane</button></div>'+
  '<button type="button" class="button" data-activity-read-all '+(lastItems.some(x=>!x.read_at)?'':'disabled')+'>Oznacz wszystkie jako przeczytane</button></div>'+
  '<div class="activity-list" aria-live="polite">'+(items||'<div class="community-empty"><p>Nie masz powiadomień w tej kategorii.</p></div>')+'</div>'+
  (data?.length===100?'<p class="fine">Pokazujemy 100 najnowszych aktywności.</p>':''));
}
document.addEventListener('click',async event=>{
 const open=event.target.closest?.('[data-activity-open]');
 if(open&&me){
  event.preventDefault();
  const id=Number(open.dataset.activityOpen),row=lastItems.find(x=>x.id===id);
  if(!row)return;
  if(!row.read_at)await supabase.from('activity_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',me);
  await reloadCount();location.hash=activityTarget(row.target_hash);return;
 }
 const readAll=event.target.closest?.('[data-activity-read-all]');
 if(readAll&&me){
  readAll.disabled=true;
  await supabase.from('activity_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',me).is('read_at',null);
  await reloadCount();return void renderActivityCenter({session:{user:{id:me}},shell:globalThis.__activityShell});
 }
 const f=event.target.closest?.('[data-activity-filter]');
 if(f&&me){filter=f.dataset.activityFilter==='unread'?'unread':'all';return void renderActivityCenter({session:{user:{id:me}},shell:globalThis.__activityShell});}
});
function initialize(){
 if(initialized)return;initialized=true;
 headerBell();
 supabase.auth.onAuthStateChange((_event,session)=>queueMicrotask(()=>bindSession(session)));
 void supabase.auth.getSession().then(({data})=>bindSession(data.session)).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
