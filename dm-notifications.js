// In-app and foreground-PWA alerts for private City Route messages.
// Closed-app background push is intentionally NOT advertised here: it requires a VAPID push sender.
import {supabase} from './supabase-client.js';
import {createDirectMessagesClient,directChatHref} from './direct-messages-client.js';
import {computeUnread,shouldNotifyDirectMessage} from './dm-notifications-model.js';
const api=createDirectMessagesClient(supabase);
let userId=null,epoch=0,channels=[],unread=new Map(),total=0,scheduled=false,noticeTimer=null;
const seenIncoming=new Set();
const chatHref=peer=>directChatHref(peer)||'#routes/community/chats';
function isSupported(){return typeof Notification!=='undefined'&&typeof Notification.requestPermission==='function';}
function badge(parent,className,count){
 if(!parent)return;
 let el=parent.querySelector(':scope > .'+className);
 if(count<=0){el?.remove();return;}
 if(!el){el=document.createElement('span');el.className=className;el.setAttribute('aria-hidden','true');parent.append(el);}
 const text=count>99?'99+':String(count);
 if(el.textContent!==text)el.textContent=text;
}
function reflectUnread(){
 const bottom=document.querySelector('#navigation a[href="#routes/community"]');
 if(bottom){bottom.classList.add('dm-badge-anchor');badge(bottom,'dm-unread-badge',total);
  bottom.setAttribute('aria-label',total?'Społeczność, '+total+' nieprzeczytanych wiadomości':'Społeczność');
 }
 const chats=document.querySelector('[data-community-tabs] a[href="#routes/community/chats"]');
 if(chats){chats.classList.add('dm-badge-anchor');badge(chats,'dm-tab-unread-badge',total);
  chats.setAttribute('aria-label',total?'Czaty, '+total+' nieprzeczytanych wiadomości':'Czaty');
 }
 for(const row of document.querySelectorAll('[data-dm-peer]')){
  const count=unread.get(row.dataset.dmPeer)||0;
  badge(row,'dm-chat-unread-badge',count);
  const name=row.querySelector('strong')?.textContent||'Znajomy';
  row.setAttribute('aria-label',count?name+', '+count+' nieprzeczytanych wiadomości':name);
 }
 const title=document.title.replace(/^\(\d+\)\s+/,'');
 if(total)document.title='('+total+') '+title;
 else if(title!==document.title)document.title=title;
}
function scheduleReflect(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;reflectUnread();});}
export function unreadForPeer(peer){return unread.get(peer)||0;}
export function unreadTotal(){return total;}
export async function refreshUnread(){
 const uid=userId,current=epoch;
 if(!uid)return;
 try{
  const [messages,reads]=await Promise.all([api.recent(uid,200),api.readReceipts(uid)]);
  if(current!==epoch||uid!==userId)return;
  const summary=computeUnread(messages,reads,uid);
  unread=summary.byPeer;total=summary.total;scheduleReflect();
 }catch{/* Realtime may be offline: keep the last known indicators, retry on focus. */}
}
export async function markDirectThreadRead(me,peer,latestId){
 const n=Number(latestId);
 if(!me||!peer||!Number.isSafeInteger(n)||n<1)return;
 try{
  await api.markRead(me,peer,n);
  if(userId===me)await refreshUnread();
 }catch{/* Sending/reading should still work if read receipts are temporarily unavailable. */}
}
function showInApp(peer){
 let notice=document.getElementById('dm-message-notice');
 if(!notice){
  notice=document.createElement('aside');notice.id='dm-message-notice';notice.className='dm-message-notice';
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const copy=document.createElement('span'),link=document.createElement('a'),close=document.createElement('button');
  copy.dataset.dmNoticeText='';copy.textContent='Nowa wiadomość w City Route';
  link.dataset.dmNoticeLink='';link.textContent='Otwórz czat';
  close.type='button';close.textContent='×';close.setAttribute('aria-label','Zamknij powiadomienie');
  close.addEventListener('click',()=>notice.remove());
  notice.append(copy,link,close);document.body.append(notice);
 }
 notice.querySelector('[data-dm-notice-link]').href=chatHref(peer);
 notice.hidden=false;
 clearTimeout(noticeTimer);
 noticeTimer=setTimeout(()=>{notice?.remove();},9000);
}
async function showForegroundDeviceNotification(peer){
 if(!isSupported()||Notification.permission!=='granted'||document.visibilityState==='visible')return;
 const url=new URL('./'+chatHref(peer),location.href).href;
 const options={body:'Masz nową prywatną wiadomość od znajomego.',icon:'./assets/icons/icon-192.png',tag:'city-route-dm-'+peer,data:{url}};
 try{
  if('serviceWorker' in navigator){
   const registration=await navigator.serviceWorker.ready;
   // Installed apps subscribed to server Web Push will get one OS alert from the push event.
   if(await registration.pushManager?.getSubscription())return;
   if(registration?.showNotification){await registration.showNotification('City Route · Nowa wiadomość',options);return;}
  }
  const notification=new Notification('City Route · Nowa wiadomość',options);
  notification.onclick=()=>{window.focus();location.hash=chatHref(peer);notification.close();};
 }catch{/* No permission or OS support: in-app notice remains available. */}
}
function handleIncoming(message){
 if(!userId||!message||message.sender_id===userId||
  (message.user_low!==userId&&message.user_high!==userId))return;
 const id=Number(message.id);
 if(!Number.isSafeInteger(id)||id<1||seenIncoming.has(id))return;
 seenIncoming.add(id);
 if(seenIncoming.size>300){const oldest=seenIncoming.values().next().value;seenIncoming.delete(oldest);}
 const peer=message.sender_id;
 if(shouldNotifyDirectMessage(message,userId,location.hash)){
  unread.set(peer,(unread.get(peer)||0)+1);total+=1;scheduleReflect();
  showInApp(peer);void showForegroundDeviceNotification(peer);
 }
 void refreshUnread();
}
function clearUser(){
 epoch+=1;
 for(const ch of channels)void supabase.removeChannel(ch);
 channels=[];userId=null;unread=new Map();total=0;seenIncoming.clear();
 document.getElementById('dm-message-notice')?.remove();
 scheduleReflect();
}
function bindUser(session){
 const uid=session?.user?.id||null;
 if(uid===userId)return;
 clearUser();
 if(!uid)return;
 userId=uid;
 for(const field of ['user_low','user_high']){
  const ch=supabase.channel('dm-alerts-'+field+'-'+uid)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:field+'=eq.'+uid},payload=>handleIncoming(payload.new))
   .subscribe();
  channels.push(ch);
 }
 void refreshUnread();
}
export function dmNotificationControls(){
 if(!isSupported())return '<p class="fine">Powiadomienia o nowych wiadomościach są widoczne w aplikacji. Powiadomienia systemowe nie są obsługiwane w tej przeglądarce.</p>';
 const permission=Notification.permission;
 if(permission==='granted')return '<p class="fine dm-permission-ok">Powiadomienia systemowe włączone na tym urządzeniu (gdy aplikacja jest uruchomiona).</p>';
 if(permission==='denied')return '<p class="fine">Powiadomienia systemowe są zablokowane w ustawieniach urządzenia. W aplikacji nadal zobaczysz nowe wiadomości.</p>';
 return '<div class="dm-permission-cta"><button type="button" class="button dm-enable-notifications" data-enable-dm-notifications>Włącz powiadomienia</button><small>Otrzymasz je, gdy City Route działa w tle. Powiadomienia po całkowitym zamknięciu wymagają osobnego wdrożenia push.</small></div>';
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-enable-dm-notifications]');
 if(!button||!isSupported())return;
 // The permission prompt is only triggered by a real user gesture.
 const result=await Notification.requestPermission();
 const section=button.closest('.dm-permission-cta');
 if(section)section.outerHTML=dmNotificationControls();
 if(result==='granted')void refreshUnread();
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshUnread();});
window.addEventListener('focus',()=>{void refreshUnread();});
window.addEventListener('hashchange',scheduleReflect);
for(const id of ['main','navigation']){
 const root=document.getElementById(id);
 if(root)new MutationObserver(scheduleReflect).observe(root,{childList:true,subtree:id==='main'});
}
supabase.auth.onAuthStateChange((_event,session)=>queueMicrotask(()=>bindUser(session)));
const {data:{session:initialSession}}=await supabase.auth.getSession();
bindUser(initialSession);
