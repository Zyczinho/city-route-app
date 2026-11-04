// BETA-HOURS-AUTH-046 — one-time guest-first onboarding.
// Never requests account, payment or geolocation. No DOM rewrite/observer loop.
const SEEN_KEY='city-route-first-launch-v1';
const done=()=>{try{return localStorage.getItem(SEEN_KEY)==='1';}catch{return false;}};
function finishIntro(next){
 try{localStorage.setItem(SEEN_KEY,'1');}catch{/* Private mode can still dismiss until reload. */}
 document.getElementById('first-launch-overlay')?.remove();
 if(next&&location.hash!==next)location.hash=next;
}
function maybeShowIntro(){
 if(done()||document.getElementById('first-launch-overlay'))return;
 if(location.hash&&location.hash!=='#plan')return; // never interrupt a shared deep-link
 if(location.search.includes('code=')||location.hash.includes('access_token='))return;
 const root=document.getElementById('main');
 if(!root?.querySelector('#build-form'))return;
 const dialog=document.createElement('section');
 dialog.id='first-launch-overlay';dialog.className='welcome-overlay';
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 dialog.setAttribute('aria-label','Pierwsze kroki w City Route');
 dialog.innerHTML=`<div class="welcome-panel">
   <div class="welcome-top"><div class="welcome-brand">CITY ROUTE <span>· 1001 CAVE</span></div><button type="button" class="welcome-skip" data-intro="skip">Pomiń</button></div>
   <p class="welcome-label">CZEŚĆ, ODKRYWCO</p>
   <h2>Poznaj miasto po swojemu.</h2>
   <p>Trzy rzeczy, które możesz zrobić już teraz — bez tworzenia konta.</p>
   <ol class="welcome-steps">
    <li><span class="welcome-number">01</span><div><strong>Odkrywaj sprawdzone miejsca</strong><small>Restauracje, muzea, zabytki i miejsca polecane przez innych.</small></div></li>
    <li><span class="welcome-number">02</span><div><strong>Ułóż trasę na wybrany dzień</strong><small>Podaj czas i godzinę startu. Dla części muzeów sprawdzimy godziny otwarcia.</small></div></li>
    <li><span class="welcome-number">03</span><div><strong>Zapisuj i dziel się trasami</strong><small>Bez konta możesz zwiedzać; do publikowania potrzebujesz logowania.</small></div></li>
   </ol>
   <div class="welcome-actions"><button type="button" class="welcome-primary" data-intro="plan">Ułóż pierwszą trasę</button>
   <button type="button" class="welcome-secondary" data-intro="places">Przeglądaj miejsca</button></div>
   <small class="welcome-foot">Przewodnik znajdziesz później w „Zacznij tutaj”.</small>
 </div>`;
 document.body.append(dialog);
 dialog.querySelector('[data-intro="plan"]')?.focus({preventScroll:true});
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('#first-launch-overlay [data-intro]');if(!b)return;
 e.preventDefault();finishIntro(b.dataset.intro==='places'?'#places':null);
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.getElementById('first-launch-overlay')){e.preventDefault();finishIntro(null);}
});
window.addEventListener('hashchange',()=>{
 if(location.hash!=='#plan')document.getElementById('first-launch-overlay')?.remove();
 else queueMicrotask(maybeShowIntro);
});
const host=document.getElementById('main');
if(host)new MutationObserver(()=>{if(!done()&&!document.getElementById('first-launch-overlay'))queueMicrotask(maybeShowIntro);})
 .observe(host,{childList:true});
maybeShowIntro();
