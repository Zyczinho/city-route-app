// Private 1:1 chat, deliberately separate from group messages and their realtime subscription.
import {supabase} from './supabase-client.js';
import {createFriendsClient} from './friends-client.js';
import {createDirectMessagesClient,directPair,directChatHref} from './direct-messages-client.js';
const friends=createFriendsClient(supabase),api=createDirectMessagesClient(supabase);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=value=>new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
let channel=null,timer=null,lastArgs=null;
export function stopDirectThread(){
 if(channel){void supabase.removeChannel(channel);channel=null;}
 if(timer){clearTimeout(timer);timer=null;}
 lastArgs=null;
}
export async function renderPrivateInbox(session){
 if(!session)return '<p class="community-empty-inline">Zaloguj się, aby rozmawiać ze znajomymi.</p>';
 let accepted=[];
 try{accepted=(await friends.mine()).filter(x=>x.friend_status==='accepted');}
 catch{return '<p class="community-status error">Lista znajomych jest chwilowo niedostępna.</p>';}
 let latest=new Map(),note='';
 try{
  for(const row of await api.recent(session.user.id)){
   const peer=row.user_low===session.user.id?row.user_high:row.user_low;
   if(!latest.has(peer))latest.set(peer,row);
  }
 }catch{note='<p class="community-status error">Historia prywatnych wiadomości jest jeszcze niedostępna.</p>';}
 const ordered=[...accepted].sort((a,b)=>(latest.get(b.user_id)?.created_at||'').localeCompare(latest.get(a.user_id)?.created_at||''));
 const cards=ordered.map(friend=>{
  const msg=latest.get(friend.user_id),url=directChatHref(friend.user_id);
  if(!url)return '';
  return `<a class="community-chat-link dm-chat-link" href="${url}"><span class="community-chat-icon">${esc(String(friend.nickname||'O').slice(0,1).toUpperCase())}</span><span class="community-chat-copy"><strong>@${esc(friend.nickname||'Odkrywca')}</strong><small>${msg?esc(msg.body):'Napisz pierwszą wiadomość'}</small></span>${msg?`<time>${esc(fmtDate(msg.created_at))}</time>`:''}</a>`;
 }).join('');
 return `<h2 class="dm-section-title">Ostatnie rozmowy · Prywatne</h2><div class="community-chat-index">${cards||'<p class="community-empty-inline">Dodaj znajomego, aby rozpocząć rozmowę.</p>'}</div>${note}`;
}
export async function renderDirectThread({peerId,session,shell}){
 stopDirectThread();
 const expected=directChatHref(peerId);
 shell('Rozmowa prywatna','<p class="community-status">Wczytuję rozmowę…</p>');
 if(!session){shell('Rozmowa prywatna','<div class="community-empty"><p>Zaloguj się, aby wysłać wiadomość.</p><a class="button primary" href="#profile">Zaloguj się</a></div>');return;}
 const me=session.user.id,pair=directPair(me,peerId);
 if(!pair||!expected){shell('Rozmowa prywatna','<p class="community-status error">Nieprawidłowy link do rozmowy.</p>');return;}
 try{
  const mine=await friends.mine();
  if(location.hash!==expected)return;
  const friend=mine.find(x=>x.user_id===peerId&&x.friend_status==='accepted');
  if(!friend){
   shell('Rozmowa prywatna','<div class="community-empty"><p>Wiadomości prywatne możesz wysyłać tylko do zaakceptowanych znajomych.</p><a class="button" href="#routes/community/friends">Przejdź do znajomych</a></div>');return;
  }
  const messages=await api.thread(me,peerId);
  if(location.hash!==expected)return;
  const cards=messages.map(m=>{
   const own=m.sender_id===me;
   return `<article class="chat-message dm-message ${own?'own':''}"><div class="chat-meta"><strong>${own?'Ty':'@'+esc(friend.nickname)}</strong><time>${esc(fmtDate(m.created_at))}</time></div><p>${esc(m.body)}</p></article>`;
  }).join('');
  shell('@'+friend.nickname,`<div class="dm-peer-head"><span>Rozmowa prywatna · tylko Wy dwoje</span><a href="#social-profile/${esc(peerId)}">Profil odkrywcy</a></div><section class="chat-panel dm-panel"><div class="chat-list" data-chat-list aria-label="Wiadomości prywatne">${cards||'<p class="community-empty-inline">Nie macie jeszcze wiadomości. Napisz pierwszą!</p>'}</div><form class="chat-form dm-form" data-community-form="direct-message" data-peer="${esc(peerId)}"><label class="sr-only" for="direct-message-body">Wiadomość do @${esc(friend.nickname)}</label><textarea id="direct-message-body" name="body" required maxlength="2000" rows="2" placeholder="Napisz wiadomość…"></textarea><button type="submit" class="dm-send">Wyślij</button></form></section><p class="community-status" role="status" data-community-status></p>`);
  const list=document.querySelector('[data-chat-list]');if(list)list.scrollTop=list.scrollHeight;
  lastArgs={peerId,session,shell};
  channel=supabase.channel('city-route-dm-'+pair.user_low+'-'+pair.user_high)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:'user_low=eq.'+pair.user_low},event=>{
    if(event.new?.user_high!==pair.user_high||location.hash!==expected)return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{void renderDirectThread({peerId,session,shell});},180);
   }).subscribe();
 }catch(error){
  if(location.hash!==expected)return;
  shell('Rozmowa prywatna',`<div class="community-empty"><p>Nie udało się otworzyć rozmowy (${esc(error.code||'błąd połączenia')}).</p><a class="button" href="#routes/community/chats">Wróć do czatów</a></div>`);
 }
}
export async function sendDirectMessage(form){
 const args=lastArgs;if(!args||form.dataset.peer!==args.peerId)return;
 const body=String(new FormData(form).get('body')||'').trim();
 if(!body)return;
 const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session||session.user.id!==args.session.user.id)throw Error('session-expired');
  await api.send(session.user.id,args.peerId,body);
  form.reset();
  await renderDirectThread({...args,session});
 }catch(error){
  const note=document.querySelector('[data-community-status]');
  if(note){note.textContent=error.code==='42501'?'Możesz wysyłać wiadomości tylko zaakceptowanym znajomym.':'Nie udało się wysłać wiadomości. Spróbuj ponownie.';note.classList.add('error');}
 }finally{if(button?.isConnected)button.disabled=false;}
}
