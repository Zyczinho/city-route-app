import { supabase,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY } from './supabase-client.js';
import {activateLocalScope,guestImportAvailable,importGuestActivity,friendlyNickname} from './account-scope.js';

const STORAGE_KEY='city-route-v1';
let session=null;
let notice='';
let syncTimer=null;
let hydrating=false;

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
  const email=session?.user?.email||'';
  const canImport=guestImportAvailable(localStorage,session?.user?.id);
  const nickname=readLocal()?.tester?.nickname;
  return `<section class="auth-card auth-card-on" data-city-auth data-auth-state="in" data-auth-user="${esc(email)}" data-auth-notice="${esc(notice)}" data-guest-import="${canImport}">
   <div><p class="kicker">Konto City Route</p><h2>Konto aktywne</h2><p class="fine">${esc(email)} · profil synchronizowany przez Supabase.</p>
   ${!meaningful(nickname)?'<p class="fine"><strong>Ustaw swoją nazwę odkrywcy</strong> w edycji profilu — techniczne ID nie będzie wyświetlane.</p>':''}
   ${canImport?'<div class="auth-import"><p><strong>Masz aktywność sprzed logowania?</strong> Znaleźliśmy lokalną historię na tym urządzeniu. Możesz dobrowolnie przenieść ją na to konto. Nie usuwamy kopii gościa.</p><button type="button" data-auth-action="import-guest">Przenieś lokalne miejsca, trasy i oceny</button></div>':''}</div>
   ${notice?`<p class="auth-notice" role="status">${esc(notice)}</p>`:''}<button data-auth-action="logout">Wyloguj</button></section>`;
}

function renderAuth(){
  if(location.hash.split('/')[0]!=='#profile')return;
  const main=document.querySelector('#main');
  if(!main)return;
  const current=main.querySelector('[data-city-auth]');
  const html=session?signedInMarkup():signedOutMarkup();
  const wantedState=session?'in':'out',wantedUser=session?.user?.email||'';
  if(current&&current.dataset.authState===wantedState&&current.dataset.authUser===wantedUser&&current.dataset.authNotice===notice)return;
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
}
supabase.auth.onAuthStateChange((_event,nextSession)=>{
 session=nextSession;
 try{
  const changed=activateLocalScope(localStorage,session?.user?.id).changed;
  if(changed){location.reload();return;}
 }catch(error){setNotice('Nie udało się bezpiecznie przełączyć lokalnych danych konta.');return;}
 renderAuth();
 if(session?.user)setTimeout(()=>hydrateProfile(session.user));
});
