import { supabase } from './supabase-client.js';

const STORAGE_KEY='city-route-v1';
let session=null;
let notice='';
let syncTimer=null;
let hydrating=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readLocal=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch{return null;}};
const writeLocal=value=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return true;}catch{return false;}};
const meaningful=v=>typeof v==='string'&&v.trim()&&v.trim()!=='Explorer';

function profilePayload(user){
  const local=readLocal();
  if(!local)return {id:user.id,nickname:user.user_metadata?.nickname||'Odkrywca'};
  return {
    id:user.id,
    nickname:meaningful(local.tester?.nickname)?local.tester.nickname:(user.user_metadata?.nickname||'Odkrywca'),
    bio:local.profile?.bio||'',
    stay:local.stay||null,
    instagram:local.profile?.socials?.instagram||'',
    tiktok:local.profile?.socials?.tiktok||'',
    website:local.profile?.socials?.web||''
  };
}

async function pushProfile(){
  if(!session?.user||hydrating)return;
  const {error}=await supabase.from('profiles').upsert(profilePayload(session.user),{onConflict:'id'});
  if(error)console.warn('City Route profile sync:',error.message);
}

function scheduleProfileSync(delay=120){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(pushProfile,delay);
}

async function hydrateProfile(user){
  hydrating=true;
  try{
    const local=readLocal();
    if(!local)return;
    const {data,error}=await supabase.from('profiles').select('nickname,bio,stay,instagram,tiktok,website').eq('id',user.id).maybeSingle();
    if(error){console.warn('City Route profile load:',error.message);return;}

    let changed=local.tester?.id!==user.id;
    local.tester=local.tester||{};
    local.profile=local.profile||{};
    local.profile.socials=local.profile.socials||{};
    local.tester.id=user.id;

    if(data){
      const remoteName=meaningful(data.nickname)?data.nickname:'';
      if(remoteName&&local.tester.nickname!==remoteName){local.tester.nickname=remoteName;changed=true;}
      if((data.bio||'')!==(local.profile.bio||'')){local.profile.bio=data.bio||'';changed=true;}
      if((data.stay||'')!==(local.stay||'')){local.stay=data.stay||'';changed=true;}
      for(const [remoteKey,localKey] of [['instagram','instagram'],['tiktok','tiktok'],['website','web']]){
        if((data[remoteKey]||'')!==(local.profile.socials[localKey]||'')){local.profile.socials[localKey]=data[remoteKey]||'';changed=true;}
      }
    }else{
      await supabase.from('profiles').upsert(profilePayload(user),{onConflict:'id'});
    }

    if(changed&&writeLocal(local)){
      const marker=`city-route-auth-hydrated:${user.id}`;
      if(sessionStorage.getItem(marker)!=='1'){
        sessionStorage.setItem(marker,'1');
        location.reload();
      }
    }
  }finally{hydrating=false;}
}

function setNotice(text){notice=text;renderAuth();}

function signedOutMarkup(){
  return `<section class="auth-card" data-city-auth><div><p class="kicker">Konto City Route</p><h2>Zapisz swój profil i korzystaj na różnych urządzeniach</h2><p class="fine">Trasy pozostają dostępne lokalnie. Konto synchronizuje na razie profil; grupy i chat dołączą na tej samej bazie.</p></div>
  ${notice?`<p class="auth-notice" role="status">${esc(notice)}</p>`:''}
  <form data-auth-form="login" class="auth-form"><h3>Zaloguj się</h3><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Hasło<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="primary">Zaloguj</button></form>
  <details class="auth-signup"><summary>Nie masz konta? Utwórz je</summary><form data-auth-form="signup" class="auth-form"><label>Nazwa<input name="nickname" maxlength="40" autocomplete="nickname" placeholder="Odkrywca"></label><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Hasło<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><button class="primary">Utwórz konto</button></form></details></section>`;
}

function signedInMarkup(){
  const email=session?.user?.email||'';
  return `<section class="auth-card auth-card-on" data-city-auth><div><p class="kicker">Konto City Route</p><h2>Konto aktywne</h2><p class="fine">${esc(email)} · profil synchronizowany przez Supabase.</p></div>${notice?`<p class="auth-notice" role="status">${esc(notice)}</p>`:''}<button data-auth-action="logout">Wyloguj</button></section>`;
}

function renderAuth(){
  if(location.hash.split('/')[0]!=='#profile')return;
  const main=document.querySelector('#main');
  if(!main)return;
  const current=main.querySelector('[data-city-auth]');
  const html=session?signedInMarkup():signedOutMarkup();
  if(current){current.outerHTML=html;return;}
  const profile=main.querySelector('.profile-card');
  if(profile)profile.insertAdjacentHTML('afterend',html);
}

async function handleSubmit(form){
  const fd=new FormData(form),email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');
  form.querySelector('button')?.setAttribute('disabled','');
  setNotice('Łączenie z kontem…');
  if(form.dataset.authForm==='login'){
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setNotice(error.message);else setNotice('Zalogowano. Synchronizuję profil…');
  }else{
    const nickname=String(fd.get('nickname')||'').trim()||'Odkrywca';
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{nickname},emailRedirectTo:`${location.origin}${location.pathname}#profile`}});
    if(error)setNotice(error.message);
    else if(!data.session)setNotice('Konto utworzone. Sprawdź e-mail i potwierdź adres.');
    else setNotice('Konto utworzone. Synchronizuję profil…');
  }
  form.querySelector('button')?.removeAttribute('disabled');
}

document.addEventListener('submit',e=>{
  const auth=e.target.closest?.('[data-auth-form]');
  if(auth){e.preventDefault();e.stopImmediatePropagation();handleSubmit(auth);return;}
  if(e.target.id==='profile-form')setTimeout(()=>scheduleProfileSync(),200);
},true);

document.addEventListener('click',async e=>{
  const action=e.target.closest?.('[data-auth-action]')?.dataset.authAction;
  if(action==='logout'){
    await supabase.auth.signOut();
    notice='Wylogowano.';
    return;
  }
  if(e.target.closest?.('[data-action="stay"]'))setTimeout(()=>scheduleProfileSync(),180);
},true);

const observer=new MutationObserver(()=>renderAuth());
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('hashchange',()=>setTimeout(renderAuth));

const {data:{session:initialSession}}=await supabase.auth.getSession();
session=initialSession;
renderAuth();
if(session?.user)await hydrateProfile(session.user);

supabase.auth.onAuthStateChange((_event,nextSession)=>{
  session=nextSession;
  renderAuth();
  if(session?.user)setTimeout(()=>hydrateProfile(session.user));
});
