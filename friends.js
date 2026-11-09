// Friends section lives inside Community. No new bottom navigation item.
import {supabase} from './supabase-client.js';
import {createFriendsClient,normalizeFriendsError} from './friends-client.js';
const api=createFriendsClient(supabase),HASH='#routes/community/friends';
const root=()=>document.querySelector('#main');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seq=0,query='',queued=false,processing=false;
const active=()=>location.hash===HASH;

function actionButtons(item){
 const attrs=`data-id="${esc(item.user_id)}"`;
 if(item.friend_status==='accepted')return `<a class="button friend-dm-cta" href="#routes/community/dm/${esc(item.user_id)}">Wyślij wiadomość</a><button type="button" data-friend-action="remove" ${attrs}>Usuń ze znajomych</button>`;
 if(item.friend_status==='pending')return item.requested_by_me?'<span class="friend-pending">Zaproszenie wysłane</span>':`<button type="button" class="primary" data-friend-action="accept" ${attrs}>Akceptuj</button><button type="button" data-friend-action="decline" ${attrs}>Odrzuć</button>`;
 return `<button type="button" class="primary" data-friend-action="request" ${attrs}>Dodaj do znajomych</button>`;
}
const row=item=>`<article class="friend-row"><a class="friend-profile-link" href="#social-profile/${esc(item.user_id)}" aria-label="Profil @${esc(item.nickname)}"><span class="friend-avatar" aria-hidden="true">${esc(String(item.nickname).slice(0,1).toUpperCase())}</span></a><div class="friend-details"><a class="friend-profile-link" href="#social-profile/${esc(item.user_id)}"><strong>@${esc(item.nickname)}</strong></a>${item.friend_status==='accepted'?'<small>Znajomy</small>':item.friend_status==='pending'?'<small>Zaproszenie do znajomych</small>':''}</div><div class="friend-actions">${actionButtons(item)}</div></article>`;
function screen(inside){
 const host=root();if(!host||!active())return;
 host.innerHTML=`<section class="friends-page" data-friends-page><p class="kicker">Społeczność</p><h1>Znajomi</h1><p class="lead">Znajdź odkrywców po unikalnym nicku i zaproś ich do znajomych.</p>${inside}</section>`;
}
async function renderFriends(){
 if(!active()||processing)return;
 const token=++seq,host=root();
 if(!host)return;
 screen('<p role="status" class="fine">Wczytuję znajomych…</p>');
 const {data:{session},error:sessionError}=await supabase.auth.getSession();
 if(!active()||token!==seq)return;
 if(sessionError||!session){
  screen('<div class="community-empty"><h2>Znajomi po zalogowaniu</h2><p>Do wyszukiwania i zapraszania odkrywców potrzebujesz konta.</p><a class="button primary" href="#profile">Zaloguj się</a></div>');
  return;
 }
 let mine,found;
 try{
  [mine,found]=await Promise.all([api.mine(),query.trim().length>=2?api.search(query):Promise.resolve([])]);
 }catch(error){
  if(!active()||token!==seq)return;
  const code=normalizeFriendsError(error).code;
  screen(`<div class="community-empty"><h2>Znajomi jeszcze niedostępni</h2><p>Aktualizujemy obsługę znajomych. Wróć do tej zakładki po wdrożeniu aktualizacji bazy.</p><small>${esc(code)}</small></div>`);
  return;
 }
 if(!active()||token!==seq)return;
 const accepted=mine.filter(x=>x.friend_status==='accepted'),received=mine.filter(x=>x.friend_status==='pending'&&!x.requested_by_me),sent=mine.filter(x=>x.friend_status==='pending'&&x.requested_by_me);
 const section=(heading,list,empty)=>`<section class="friend-section"><h2>${heading}</h2>${list.length?list.map(row).join(''):`<p class="fine">${empty}</p>`}</section>`;
 screen(`<form class="friend-search" data-friend-search><label for="friend-nick">Wyszukaj po nicku</label><div><input id="friend-nick" type="search" name="nickname" minlength="2" maxlength="40" value="${esc(query)}" placeholder="Wpisz co najmniej 2 znaki" autocomplete="off"><button type="submit" class="primary">Szukaj</button></div></form>
  ${query.trim().length>=2?section('Wyniki wyszukiwania',found,'Nie znaleziono użytkowników o takim nicku.'):''}
  ${section('Zaproszenia do Ciebie',received,'Nie masz nowych zaproszeń.')}
  ${section('Twoi znajomi',accepted,'Nie masz jeszcze znajomych.')}
  ${sent.length?section('Wysłane zaproszenia',sent,''):''}`);
}
function queueRender(){
 if(!active())return;
 if(queued)return;queued=true;
 queueMicrotask(()=>{queued=false;if(active()&&!root()?.querySelector('[data-friends-page]'))renderFriends();});
}
document.addEventListener('submit',e=>{
 const f=e.target.closest?.('[data-friend-search]');if(!f)return;
 e.preventDefault();query=String(new FormData(f).get('nickname')||'').trim().slice(0,40);
 renderFriends();
},true);
document.addEventListener('click',async e=>{
 const button=e.target.closest?.('[data-friend-action]');if(!button||!active())return;
 e.preventDefault();
 const action=button.dataset.friendAction,userId=button.dataset.id;
 if(!userId||!['request','accept','decline','remove'].includes(action)||processing)return;
 if(action==='remove'&&!confirm('Usunąć tę osobę ze znajomych?'))return;
 processing=true;button.disabled=true;
 try{
  if(action==='request')await api.request(userId);
  else if(action==='accept'||action==='decline')await api.respond(userId,action==='accept');
  else await api.remove(userId);
 }catch(error){alert('Nie udało się wykonać działania ('+normalizeFriendsError(error).code+').');}
 finally{processing=false;renderFriends();}
},true);
window.addEventListener('hashchange',()=>{seq++;if(active())renderFriends();});
new MutationObserver(queueRender).observe(root()||document.documentElement,{subtree:true,childList:true});
supabase.auth.onAuthStateChange(()=>{if(active())renderFriends();});
queueRender();
