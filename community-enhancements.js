import { supabase } from './supabase-client.js';

let session=null;
let channel=null;
let rendering=false;
let rerenderQueued=false;
let reloadTimer=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=value=>new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const communityRoute=()=>location.hash.startsWith('#profile/community');
const groupId=()=>communityRoute()?(location.hash.split('/')[2]||''):'';
const main=()=>document.querySelector('#main');

function stopRealtime(){
  if(channel){supabase.removeChannel(channel);channel=null;}
  clearTimeout(reloadTimer);
}

function queueRender(){
  if(rerenderQueued)return;
  rerenderQueued=true;
  queueMicrotask(()=>{rerenderQueued=false;routeRender();});
}

function profileEntry(){
  if(communityRoute()||location.hash.split('/')[0]!=='#profile')return;
  const root=main();
  if(!root||root.querySelector('[data-community-entry]'))return;
  const anchor=root.querySelector('.community-card')||root.querySelector('.profile-card');
  if(!anchor)return;
  const text=session?'Twórz grupy, dołączaj do innych odkrywców i rozmawiaj na żywo.':'Zaloguj się, żeby tworzyć grupy odkrywców i korzystać z czatu.';
  anchor.insertAdjacentHTML('afterend',`<section class="community-entry" data-community-entry><div><p class="kicker">Społeczność</p><h2>Grupy odkrywców</h2><p>${esc(text)}</p></div><a class="button primary" href="${session?'#profile/community':'#profile'}">${session?'Otwórz grupy':'Zaloguj się'}</a></section>`);
}

function shell(title,body){
  const root=main();
  if(!root)return;
  root.innerHTML=`<section class="community-page" data-community-root><header class="community-head"><a class="back" href="#profile">← Profil</a><p class="kicker">Społeczność</p><h1>${esc(title)}</h1></header>${body}</section>`;
}

function status(text,kind=''){
  const el=document.querySelector('[data-community-status]');
  if(!el)return;
  el.textContent=text;
  el.className=`community-status ${kind}`.trim();
}

async function renderGroups(){
  stopRealtime();
  shell('Grupy odkrywców','<p class="community-status" data-community-status>Wczytuję grupy…</p>');
  if(!session){
    shell('Grupy odkrywców',`<div class="community-empty"><h2>Zaloguj się, aby dołączyć do społeczności</h2><p>Konto jest potrzebne, żeby członkostwo i wiadomości działały na różnych urządzeniach.</p><a class="button primary" href="#profile">Przejdź do logowania</a></div>`);
    return;
  }

  const [{data:groups,error:gErr},{data:mine,error:mErr}]=await Promise.all([
    supabase.from('explorer_groups').select('id,name,description,created_by,is_public,created_at').order('created_at',{ascending:false}),
    supabase.from('group_members').select('group_id,role').eq('user_id',session.user.id)
  ]);
  if(gErr||mErr){shell('Grupy odkrywców',`<p class="community-status error">${esc(gErr?.message||mErr?.message||'Nie udało się pobrać grup.')}</p>`);return;}

  const roleByGroup=new Map((mine||[]).map(x=>[x.group_id,x.role]));
  const ids=(groups||[]).map(g=>g.id);
  let counts=new Map();
  if(ids.length){
    const {data:members}=await supabase.from('group_members').select('group_id').in('group_id',ids);
    for(const row of members||[])counts.set(row.group_id,(counts.get(row.group_id)||0)+1);
  }

  const cards=(groups||[]).map(g=>{
    const role=roleByGroup.get(g.id),joined=!!role,count=counts.get(g.id)||0;
    const roleLabel=role==='owner'?'Założyciel':role==='moderator'?'Moderator':role==='member'?'Członek':'';
    return `<article class="group-card"><div class="group-card-top"><div><p class="kicker">${g.is_public?'Grupa publiczna':'Grupa prywatna'}${roleLabel?' · '+esc(roleLabel):''}</p><h2>${esc(g.name)}</h2></div><span class="member-count">${count} ${count===1?'osoba':'osób'}</span></div><p>${esc(g.description)||'Bez opisu.'}</p><div class="group-actions"><a class="button ${joined?'primary':''}" href="#profile/community/${encodeURIComponent(g.id)}">${joined?'Otwórz chat':'Zobacz grupę'}</a>${!joined&&g.is_public?`<button data-community-action="join" data-group="${esc(g.id)}">Dołącz</button>`:''}</div></article>`;
  }).join('');

  shell('Grupy odkrywców',`<section class="community-create"><details><summary>+ Utwórz grupę</summary><form data-community-form="create"><label>Nazwa<input name="name" minlength="2" maxlength="80" required placeholder="Np. Warszawa po pracy"></label><label>Opis<textarea name="description" maxlength="500" rows="3" placeholder="Dla kogo jest ta grupa?"></textarea></label><p class="fine">W MVP grupy są publiczne. Prywatne zaproszenia dodamy później.</p><button class="primary">Utwórz grupę</button></form></details></section><p class="community-status" data-community-status></p><section class="group-list">${cards||'<div class="community-empty"><h2>Jeszcze nie ma grup</h2><p>Utwórz pierwszą grupę odkrywców City Route.</p></div>'}</section>`);
}

async function fetchProfiles(ids){
  if(!ids.length)return new Map();
  const {data}=await supabase.from('profiles').select('id,nickname').in('id',[...new Set(ids)]);
  return new Map((data||[]).map(p=>[p.id,p.nickname||'Odkrywca']));
}

async function renderGroup(id){
  stopRealtime();
  shell('Grupa','<p class="community-status">Wczytuję grupę…</p>');
  if(!session){location.hash='#profile';return;}

  const {data:group,error:gErr}=await supabase.from('explorer_groups').select('id,name,description,created_by,is_public,created_at').eq('id',id).maybeSingle();
  if(gErr||!group){shell('Grupa',`<div class="community-empty"><h2>Nie znaleziono grupy</h2><a class="button" href="#profile/community">Wróć do grup</a></div>`);return;}

  const {data:myMembership}=await supabase.from('group_members').select('role').eq('group_id',id).eq('user_id',session.user.id).maybeSingle();
  const joined=!!myMembership;
  if(!joined){
    shell(group.name,`<p class="lead">${esc(group.description)||'Bez opisu.'}</p><div class="community-empty"><p>Dołącz do grupy, żeby zobaczyć członków i chat.</p>${group.is_public?`<button class="primary" data-community-action="join" data-group="${esc(group.id)}">Dołącz do grupy</button>`:'<p>Ta grupa jest prywatna.</p>'}<a class="button" href="#profile/community">Wszystkie grupy</a></div>`);
    return;
  }

  const [{data:members,error:memErr},{data:messages,error:msgErr}]=await Promise.all([
    supabase.from('group_members').select('user_id,role,joined_at').eq('group_id',id).order('joined_at',{ascending:true}),
    supabase.from('messages').select('id,group_id,user_id,body,created_at').eq('group_id',id).order('created_at',{ascending:true}).limit(100)
  ]);
  if(memErr||msgErr){shell(group.name,`<p class="community-status error">${esc(memErr?.message||msgErr?.message||'Nie udało się wczytać grupy.')}</p>`);return;}

  const profiles=await fetchProfiles([...(members||[]).map(x=>x.user_id),...(messages||[]).map(x=>x.user_id)]);
  const membersHtml=(members||[]).map(m=>`<li><span>${esc(profiles.get(m.user_id)||'Odkrywca')}</span><small>${m.role==='owner'?'Założyciel':m.role==='moderator'?'Moderator':'Członek'}</small></li>`).join('');
  const messagesHtml=(messages||[]).map(m=>{const own=m.user_id===session.user.id;return `<article class="chat-message ${own?'own':''}"><div class="chat-meta"><strong>${esc(profiles.get(m.user_id)||'Odkrywca')}</strong><time>${esc(fmtDate(m.created_at))}</time></div><p>${esc(m.body)}</p>${own?`<button class="chat-delete" data-community-action="delete-message" data-message="${m.id}" aria-label="Usuń wiadomość">Usuń</button>`:''}</article>`;}).join('');

  shell(group.name,`<div class="group-detail-head"><div><p class="lead">${esc(group.description)||'Bez opisu.'}</p><p class="fine">${(members||[]).length} ${(members||[]).length===1?'członek':'członków'} · ${myMembership.role==='owner'?'Jesteś założycielem':'Jesteś członkiem'}</p></div><a class="button" href="#profile/community">Wszystkie grupy</a></div><div class="community-grid"><section class="chat-panel"><div class="chat-list" data-chat-list>${messagesHtml||'<p class="community-empty-inline">Napisz pierwszą wiadomość.</p>'}</div><form class="chat-form" data-community-form="message" data-group="${esc(id)}"><label class="sr-only" for="chat-body">Wiadomość</label><textarea id="chat-body" name="body" maxlength="2000" rows="2" required placeholder="Napisz do grupy…"></textarea><button class="primary">Wyślij</button></form></section><aside class="members-panel"><h2>Członkowie</h2><ul>${membersHtml}</ul>${myMembership.role!=='owner'?`<button class="danger" data-community-action="leave" data-group="${esc(id)}">Opuść grupę</button>`:'<p class="fine">Jako założyciel nie możesz opuścić grupy w tym MVP.</p>'}</aside></div><p class="community-status" data-community-status></p>`);

  const list=document.querySelector('[data-chat-list]');
  if(list)list.scrollTop=list.scrollHeight;
  channel=supabase.channel(`city-route-group-${id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`group_id=eq.${id}`},()=>{
    clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>renderGroup(id),120);
  }).on('postgres_changes',{event:'DELETE',schema:'public',table:'messages',filter:`group_id=eq.${id}`},()=>{
    clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>renderGroup(id),120);
  }).subscribe();
}

async function routeRender(){
  if(rendering)return;
  rendering=true;
  try{
    if(communityRoute()){
      const id=groupId();
      if(id)await renderGroup(id);else await renderGroups();
    }else{
      stopRealtime();
      profileEntry();
    }
  }finally{rendering=false;}
}

async function joinGroup(id){
  if(!session)return location.hash='#profile';
  status('Dołączam…');
  const {error}=await supabase.from('group_members').insert({group_id:id,user_id:session.user.id,role:'member'});
  if(error&&error.code!=='23505'){status(error.message,'error');return;}
  location.hash=`#profile/community/${id}`;
}

async function leaveGroup(id){
  if(!session)return;
  status('Opuszczam grupę…');
  const {error}=await supabase.from('group_members').delete().eq('group_id',id).eq('user_id',session.user.id);
  if(error){status(error.message,'error');return;}
  location.hash='#profile/community';
}

async function createGroup(form){
  if(!session)return;
  const fd=new FormData(form),name=String(fd.get('name')||'').trim(),description=String(fd.get('description')||'').trim();
  const button=form.querySelector('button');button?.setAttribute('disabled','');
  status('Tworzę grupę…');
  const {data,error}=await supabase.from('explorer_groups').insert({name,description,created_by:session.user.id,is_public:true}).select('id').single();
  button?.removeAttribute('disabled');
  if(error){status(error.message,'error');return;}
  location.hash=`#profile/community/${data.id}`;
}

async function sendMessage(form){
  if(!session)return;
  const id=form.dataset.group,body=String(new FormData(form).get('body')||'').trim();
  if(!body)return;
  const button=form.querySelector('button');button?.setAttribute('disabled','');
  const {error}=await supabase.from('messages').insert({group_id:id,user_id:session.user.id,body});
  button?.removeAttribute('disabled');
  if(error){status(error.message,'error');return;}
  form.reset();
}

async function deleteMessage(id){
  if(!session)return;
  const {error}=await supabase.from('messages').delete().eq('id',id).eq('user_id',session.user.id);
  if(error)status(error.message,'error');
}

document.addEventListener('submit',e=>{
  const form=e.target.closest?.('[data-community-form]');
  if(!form)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(form.dataset.communityForm==='create')createGroup(form);
  if(form.dataset.communityForm==='message')sendMessage(form);
},true);

document.addEventListener('click',e=>{
  const el=e.target.closest?.('[data-community-action]');
  if(!el)return;
  const action=el.dataset.communityAction;
  if(action==='join')joinGroup(el.dataset.group);
  if(action==='leave')leaveGroup(el.dataset.group);
  if(action==='delete-message')deleteMessage(el.dataset.message);
},true);

window.addEventListener('hashchange',()=>setTimeout(queueRender,0));
const observer=new MutationObserver(()=>{
  if(communityRoute()){
    const root=main();
    if(root&&!root.querySelector('[data-community-root]'))queueRender();
  }else profileEntry();
});
observer.observe(document.querySelector('#main')||document.documentElement,{subtree:true,childList:true});

const {data:{session:initialSession}}=await supabase.auth.getSession();
session=initialSession;
supabase.auth.onAuthStateChange((_event,next)=>{session=next;queueRender();});
queueRender();
