import { supabase,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY } from './supabase-client.js';
import {activateLocalScope,guestImportAvailable,importGuestActivity,friendlyNickname} from './account-scope.js';

const STORAGE_KEY='city-route-v1';
let session=null;
let notice='';
let syncTimer=null;
let hydrating=false;
const LOGIN_TOAST_KEY='city-route-login-success-pending-v1';
function markLoginSuccess(userId){try{if(userId)sessionStorage.setItem(LOGIN_TOAST_KEY,String(userId));}catch{}}
function clearLoginSuccess(){try{sessionStorage.removeItem(LOGIN_TOAST_KEY);}catch{}}
function showLoginSuccess(){
 if(!session?.user?.id)return;
 let pending=null;try{pending=sessionStorage.getItem(LOGIN_TOAST_KEY);}catch{}
 if(pending!==String(session.user.id))return;
 clearLoginSuccess();
 const el=document.querySelector('#toast');if(!el)return;
 el.textContent='Zalogowano pomyślnie';el.classList.add('show');
 setTimeout(()=>{if(el.textContent==='Zalogowano pomyślnie')el.classList.remove('show');},3200);
}


const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readLocal=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch{return null;}};
const writeLocal=value=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return true;}catch{return false;}};
const meaningful=v=>!!friendlyNickname(v);

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
  if(!session?.user||hydrating||!meaningful(readLocal()?.tester?.nickname))return;
  const {error}=await supabase.from('profiles').upsert(profilePayload(session.user),{onConflict:'id'});
  if(error?.code==='23505'||/profiles_nickname_ci_unique|nickname-taken/i.test(error?.message||'')){
    const {data}=await supabase.from('profiles').select('nickname').eq('id',session.user.id).maybeSingle();
    const local=readLocal();
    if(local?.tester&&data?.nickname){local.tester.nickname=data.nickname;localStorage.setItem(STORAGE_KEY,JSON.stringify(local));}
    setNotice('Ten nick jest zajęty. Wybierz inną nazwę.');
    if(location.hash==='#profile')window.dispatchEvent(new Event('hashchange'));
  }else if(error)console.warn('City Route profile sync:',error.message);
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
    const firstLink=local.tester?.id!==user.id;
    const {data,error}=await supabase.from('profiles').select('nickname,bio,stay,instagram,tiktok,website').eq('id',user.id).maybeSingle();
    if(error){console.warn('City Route profile load:',error.message);return;}

    let changed=firstLink,needsPush=!data;
    local.tester=local.tester||{};
    local.profile=local.profile||{};
    local.profile.socials=local.profile.socials||{};
    local.tester.id=user.id;

    if(data){
      const remoteName=meaningful(data.nickname)?data.nickname:'';
      if(remoteName){if(local.tester.nickname!==remoteName){local.tester.nickname=remoteName;changed=true;}}
      else if(meaningful(local.tester.nickname))needsPush=true;

      if(data.bio){if(data.bio!==(local.profile.bio||'')){local.profile.bio=data.bio;changed=true;}}
      else if(firstLink&&local.profile.bio)needsPush=true;
      else if(!firstLink&&local.profile.bio){local.profile.bio='';changed=true;}

      if(data.stay){if(data.stay!==(local.stay||'')){local.stay=data.stay;changed=true;}}
      else if(firstLink&&local.stay)needsPush=true;
      else if(!firstLink&&local.stay){local.stay='';changed=true;}

      for(const [remoteKey,localKey] of [['instagram','instagram'],['tiktok','tiktok'],['website','web']]){
        const remote=data[remoteKey]||'',current=local.profile.socials[localKey]||'';
        if(remote){if(remote!==current){local.profile.socials[localKey]=remote;changed=true;}}
        else if(firstLink&&current)needsPush=true;
        else if(!firstLink&&current){local.profile.socials[localKey]='';changed=true;}
      }
    }

    const wrote=writeLocal(local);
    if(needsPush&&wrote){
      const {error:pushError}=await supabase.from('profiles').upsert(profilePayload(user),{onConflict:'id'});
      if(pushError)console.warn('City Route profile migration:',pushError.message);
    }
    if(changed&&wrote){
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
  return `<section class="auth-card" data-city-auth data-auth-state="out" data-auth-user="" data-auth-notice="${esc(notice)}"><div><p class="kicker">Konto City Route</p><h2>Zapisz swój profil i korzystaj na różnych urządzeniach</h2><p class="fine">Trasy pozostają dostępne lokalnie. Konto synchronizuje na razie profil; grupy i chat dołączą na tej samej bazie.</p></div>
  ${notice?`<p class="auth-notice" role="status">${esc(notice)}</p>`:''}
  <button type="button" class="google-auth-button" data-auth-action="google"><span class="google-auth-mark" aria-hidden="true">G</span>Kontynuuj z Google</button>
  <div class="auth-divider" aria-hidden="true"><span>lub zaloguj się e-mailem</span></div>
  <form data-auth-form="login" class="auth-form"><h3>Zaloguj się</h3><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Hasło<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="primary">Zaloguj</button></form>
  <details class="auth-signup"><summary>Nie masz konta? Utwórz je</summary><form data-auth-form="signup" class="auth-form"><label>Nazwa<input name="nickname" minlength="2" maxlength="40" autocomplete="nickname" placeholder="Wybierz unikalny nick" required></label><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Hasło<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><button class="primary">Utwórz konto</button></form></details></section>`;
}

function signedInMarkup(){
 const canImport=guestImportAvailable(localStorage,session?.user?.id);
 // Signed-in users already have their identity at the top of Profile. Keep only real actions,
 // behind the collapsed More disclosure; never duplicate the account hero card.
 return `<section class="auth-account-tools" data-city-auth data-auth-state="in" data-auth-user="${esc(session?.user?.email||'')}" data-auth-notice="${esc(notice)}" data-guest-import="${canImport}">
  ${canImport?'<div class="auth-import"><p>Masz aktywność zapisaną jako gość na tym urządzeniu?</p><button type="button" data-auth-action="import-guest">Przenieś dane gościa</button></div>':''}
  <button type="button" class="auth-logout-button" data-auth-action="logout">Wyloguj się</button>
  ${notice&&notice!=='Zalogowano. Synchronizuję profil…'?'<p class="auth-notice" role="status">'+esc(notice)+'</p>':''}
 </section>`;
}

function renderAuth(){
 if(location.hash.split('/')[0]!=='#profile')return;
 const main=document.querySelector('#main');
 if(!main)return;
 const current=main.querySelector('[data-city-auth]');
 const html=session?signedInMarkup():signedOutMarkup();
 const wantedState=session?'in':'out',wantedUser=session?.user?.email||'';
 const host=session?main.querySelector('.profile-more-content'):main.querySelector('.profile-card');
 if(current&&current.dataset.authState===wantedState&&current.dataset.authUser===wantedUser&&current.dataset.authNotice===notice&&(session?host?.contains(current):current.previousElementSibling===host))return;
 if(current)current.remove();
 if(!host)return;
 host.insertAdjacentHTML(session?'beforeend':'afterend',html);
}

async function handleSubmit(form){
  const fd=new FormData(form),email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');
  form.querySelector('button')?.setAttribute('disabled','');
  setNotice('Łączenie z kontem…');
  if(form.dataset.authForm==='login'){
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setNotice(error.message);else setNotice('');
  }else{
    const nickname=String(fd.get('nickname')||'').trim();
    if(nickname.length<2||nickname.length>40){setNotice('Nick musi mieć 2–40 znaków.');form.querySelector('button')?.removeAttribute('disabled');return;}
    const {data:available,error:checkError}=await supabase.rpc('nickname_available',{p_nickname:nickname});
    if(!checkError&&!available){setNotice('Ten nick jest zajęty. Wpisz inny.');form.querySelector('button')?.removeAttribute('disabled');return;}
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{nickname},emailRedirectTo:`${location.origin}${location.pathname}`}});
    if(error)setNotice(error.code==='23505'||/nickname|duplicate/i.test(error.message)?'Nick zajęty. Wpisz inny.':error.message);
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
  if(action==='google'){
    e.preventDefault();
    if(session)return;
    const button=e.target.closest('[data-auth-action="google"]');
    if(button.disabled)return;
    button.disabled=true;
    setNotice('Przechodzę do logowania Google…');
    try{
      // Public GoTrue settings expose enabled providers without paid APIs or secrets.
      // Never redirect testers into a broken OAuth flow before Google is configured.
      const settingsResponse=await fetch(SUPABASE_URL+'/auth/v1/settings',{
        headers:{apikey:SUPABASE_PUBLISHABLE_KEY},cache:'no-store'
      });
      if(!settingsResponse.ok)throw Error('google-settings-unavailable');
      const settings=await settingsResponse.json();
      if(settings?.external?.google!==true){
        setNotice('Logowanie Google czeka na aktywację w ustawieniach City Route. Możesz użyć e-maila i hasła.');
        return;
      }
      const {error}=await supabase.auth.signInWithOAuth({
        provider:'google',
        options:{redirectTo:location.origin+location.pathname+'?cityroute_auth=google'}
      });
      if(error){
        setNotice(/not enabled|provider.*disabled|unsupported/i.test(error.message||'')
          ?'Logowanie Google wymaga jeszcze aktywacji w ustawieniach konta City Route. Możesz zalogować się e-mailem.'
          :'Google: '+error.message);
        button.disabled=false;
      }
    }catch(error){
      setNotice('Nie udało się rozpocząć logowania Google. Spróbuj e-mailem.');
      button.disabled=false;
    }
    return;
  }
  if(action==='import-guest'){
    e.preventDefault();
    if(!session?.user||!guestImportAvailable(localStorage,session.user.id))return;
    if(!confirm('Przenieść lokalną aktywność gościa na to konto? Zachowamy także kopię oryginalnych danych. Nie jest to jeszcze synchronizacja między urządzeniami.'))return;
    try{const result=importGuestActivity(localStorage,session.user.id);
      if(result.imported)location.reload();
    }catch(error){setNotice('Import nie powiódł się. Dane gościa pozostały zachowane.');}
    return;
  }
  if(action==='logout'){
    await supabase.auth.signOut();
    setNotice('Wylogowano.');
    return;
  }
  if(e.target.closest?.('[data-action="stay"]'))setTimeout(()=>scheduleProfileSync(),180);
},true);

const observer=new MutationObserver(()=>renderAuth());
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('hashchange',()=>setTimeout(renderAuth));

const {data:{session:initialSession}}=await supabase.auth.getSession();
session=initialSession;
if(session?.user&&new URLSearchParams(location.search).get('cityroute_auth')==='google')markLoginSuccess(session.user.id);
let bootChanged=false;
try{bootChanged=activateLocalScope(localStorage,session?.user?.id).changed;}catch(error){
 notice='Nie można bezpiecznie przełączyć profilu na tym urządzeniu. Sprawdź dostępne miejsce w przeglądarce.';
 console.warn('City Route account scope:',error);
}
if(bootChanged){
 if(session?.user&&new URLSearchParams(location.search).get('cityroute_auth')==='google')
  history.replaceState(null,'',location.pathname+'#profile');
 location.reload();
}
if(!bootChanged){
if(new URLSearchParams(location.search).get('cityroute_auth')==='google'){
  if(session?.user){
    // OAuth code has already been exchanged automatically by supabase-js (PKCE).
    history.replaceState(null,'',location.pathname+'#plan');
    location.hash='#profile'; // triggers the existing router; no shell rewrite
  }else{
    const params=new URLSearchParams(location.search);
    if(params.has('error')||params.has('error_description')){
      notice='Google: logowanie nie zostało zakończone. Spróbuj ponownie lub użyj e-maila.';
      history.replaceState(null,'',location.pathname+'#profile');
    }
  }
}
renderAuth();
if(session?.user)await hydrateProfile(session.user);
 if(session?.user)setTimeout(showLoginSuccess,350);
}
supabase.auth.onAuthStateChange((event,nextSession)=>{
 const wasUser=session?.user?.id||null;
 if(event==='SIGNED_IN'&&nextSession?.user?.id&&wasUser!==nextSession.user.id)markLoginSuccess(nextSession.user.id);
 if(event==='SIGNED_OUT')clearLoginSuccess();
 session=nextSession;
 try{
  const changed=activateLocalScope(localStorage,session?.user?.id).changed;
  if(changed){location.reload();return;}
 }catch(error){setNotice('Nie udało się bezpiecznie przełączyć lokalnych danych konta.');return;}
 renderAuth();
 if(session?.user){setTimeout(()=>hydrateProfile(session.user),120);setTimeout(showLoginSuccess,450);}
});
