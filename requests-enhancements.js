import {supabase} from './supabase-client.js';
import {createRequestsClient} from './requests-client.js';

const api=createRequestsClient({client:supabase});
const STORAGE_KEY='city-route-v1';
const PREFILL_KEY='city-route-request-prefill';
const OPEN_PLACE_KEY='city-route-request-open-place';
let session=null,taxonomy=null,categories=[],rendering=false,queued=false,similarTimer=null,similarSeq=0,rankingSort='popular';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readState=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{};}catch{return {};}};
const writeState=value=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}}
const main=()=>document.querySelector('#main');
const cityId=()=>document.querySelector('#city-select')?.value||readState().cityId||'warsaw';
const route=()=>{const [kind,id]=(location.hash.slice(1)||'').split('/');return {kind,id};};
const statusLabel=s=>({open:'Czeka',planned:'W planach',added:'Dodane',declined:'Nie dodamy'}[s]||s);
const kindLabel=k=>k==='category_gap'?'Brak w kategorii':'Konkretne miejsce';
const plural=(n,a,b,c)=>n===1?a:([2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?b:c);
const date=v=>v?new Date(v).toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}):'—';
const toast=text=>{const el=document.querySelector('#toast');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600);};
const log=(type,data={})=>{const s=readState();s.events=Array.isArray(s.events)?s.events:[];s.events.push({type,...data,city_id:cityId(),at:new Date().toISOString()});s.events=s.events.slice(-5000);writeState(s);};

async function ensureTaxonomy(){
 if(taxonomy)return taxonomy;
 const r=await fetch('./data/taxonomy.json');if(!r.ok)throw new Error('taxonomy');taxonomy=await r.json();
 categories=taxonomy.groups.flatMap(g=>g.types.map(t=>({id:t.id,label:t.labelPl||t.id,group:g.labelPl||g.id})));
 return taxonomy;
}
const catLabel=id=>categories.find(c=>c.id===id)?.label||id||'Bez kategorii';
const globalCategory=legacy=>taxonomy?.legacyAliases?.[legacy]||null;
const categoryOptions=(selected='')=>`<option value="">Wybierz kategorię</option>${taxonomy.groups.map(g=>`<optgroup label="${esc(g.labelPl||g.id)}">${g.types.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.labelPl||t.id)}</option>`).join('')}</optgroup>`).join('')}`;

function authRequired(){
 if(session)return false;
 alert('Zaloguj się, żeby wysłać prośbę lub dodać +1.');
 location.hash='#profile';
 return true;
}
function savePrefill(prefill){sessionStorage.setItem(PREFILL_KEY,JSON.stringify(prefill));}
function takePrefill(){try{return JSON.parse(sessionStorage.getItem(PREFILL_KEY)||'{}')||{};}catch{return {};}}
function clearPrefill(){sessionStorage.removeItem(PREFILL_KEY);}

function requestEntry({label,small='',kind='place',title='',categoryId='',sourceUrl='',className=''}){
 return `<a class="request-entry ${className}" href="#places/request" data-request-entry data-kind="${esc(kind)}" data-title="${esc(title)}" data-category="${esc(categoryId)}" data-source="${esc(sourceUrl)}"><span><strong>${esc(label)}</strong>${small?`<small>${esc(small)}</small>`:''}</span><span aria-hidden="true">→</span></a>`;
}

async function injectPlacesEntryPoints(){
 const {kind,id}=route();if(kind!=='places'||id)return;
 await ensureTaxonomy();const root=main();if(!root)return;
 const add=root.querySelector('.add-place');
 if(add&&!root.querySelector('[data-request-generic]'))add.insertAdjacentHTML('afterend',`<div data-request-generic>${requestEntry({label:'Poproś o miejsce dla wszystkich',small:'Nie zapis lokalny — prośba trafia do rankingu City Route'})}<a class="request-rank-link" href="#places/requests">Zobacz, czego brakuje innym →</a></div>`);

 const search=root.querySelector('#search'),count=root.querySelectorAll('.place-list .place').length,q=search?.value?.trim()||'';
 if(q.length>=2&&count<=2&&!root.querySelector('[data-request-search]')){
  const listHead=root.querySelector('.list-head');
  listHead?.insertAdjacentHTML('beforebegin',`<div data-request-search>${requestEntry({label:`Nie ma „${q}”? Poproś o dodanie`,small:`${count} ${plural(count,'wynik','wyniki','wyników')} — sprawdzimy też podobne prośby`,title:q,className:'compact'})}</div>`);
 }

 const selected=root.querySelector('.chips [data-action="cat"][aria-pressed="true"]');
 const legacy=selected?.dataset.value||'all';
 if(!['all','sidequests'].includes(legacy)&&!root.querySelector('[data-request-category]')){
  const categoryId=globalCategory(legacy),label=selected.textContent.trim();
  const list=root.querySelector('.place-list');
  list?.insertAdjacentHTML('afterend',`<div data-request-category>${requestEntry({label:`Za mało: ${label}? Daj znać`,small:'Dodaj głos do brakującej kategorii',kind:'category_gap',title:`Więcej: ${label}`,categoryId:categoryId||'',className:'compact'})}</div>`);
 }
 maybeOpenResolvedPlace();
}

async function injectUserPlaceRequest(){
 const dialog=document.querySelector('#place-dialog');if(!dialog?.open||dialog.querySelector('[data-request-user-place]'))return;
 const marker=dialog.querySelector('[data-action="toggle-visibility"][data-id]');if(!marker)return;
 await ensureTaxonomy();const p=readState().userPlaces?.find(x=>String(x.id)===String(marker.dataset.id));if(!p)return;
 const categoryId=globalCategory(p.cats?.[0])||p.categoryId||'';
 const sourceUrl=Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.lat},${p.lng}`)}`:'';
 const actions=dialog.querySelector('.sheet-actions');if(!actions)return;
 actions.insertAdjacentHTML('afterbegin',`<div data-request-user-place class="request-user-place">${requestEntry({label:'Poproś o dodanie dla wszystkich',small:'Wyślij to miejsce do wspólnego katalogu',title:p.name||'',categoryId,sourceUrl,className:'wide'})}</div>`);
}

function injectProfileEntry(){
 const {kind,id}=route();if(kind!=='profile'||id)return;const root=main();if(!root||root.querySelector('[data-request-profile-entry]'))return;
 const menus=[...root.querySelectorAll('.menu')],menu=menus.at(-1);if(!menu)return;
 menu.insertAdjacentHTML('afterbegin',`<a href="#profile/requests" data-request-profile-entry><span aria-hidden="true">＋</span><span>Twoje prośby<small>Status miejsc i kategorii, o które prosisz</small></span><span aria-hidden="true">›</span></a>`);
}

function markNav(tab){
 const nav=document.querySelector('#navigation');if(!nav)return;
 nav.querySelectorAll('a').forEach(a=>{a.classList.remove('active');a.removeAttribute('aria-current');});
 const a=nav.querySelector(`a[href="#${tab}"]`);if(a){a.classList.add('active');a.setAttribute('aria-current','page');}
}

function requestCard(r,mark=null,{similar=false}={}){
 const mine=!!mark?.mine,supported=!!mark?.supported;
 const button=mine?'<button disabled>Twoja prośba</button>':supported?`<button data-request-support="unsupport" data-id="${esc(r.id)}">Wycofaj +1</button>`:`<button class="primary" data-request-support="support" data-id="${esc(r.id)}">+1 · Też tego chcę</button>`;
 return `<article class="request-card" data-request-id="${esc(r.id)}"><div class="request-card-main"><p class="kicker">${esc(kindLabel(r.kind))}${r.categoryId?` · ${esc(catLabel(r.categoryId))}`:''}</p><h3>${esc(r.title)}</h3><p class="request-status"><span class="request-status-${esc(r.status)}">${esc(statusLabel(r.status))}</span>${similar&&r.similarity!=null?` · podobieństwo ${Math.round(r.similarity*100)}%`:''}</p></div><div class="request-count"><strong>${r.supports}</strong><span>${plural(r.supports,'osoba','osoby','osób')}</span></div><div class="request-card-action">${button}</div></article>`;
}

async function renderRanking(force=false){
 const root=main();if(!root)return;if(!force&&root.querySelector('[data-requests-ranking]'))return;
 markNav('places');root.innerHTML='<p class="loading" data-requests-ranking>Wczytuję prośby…</p>';
 try{
  await ensureTaxonomy();const page=await api.loadRequests({citySlug:cityId(),sort:rankingSort,limit:30});
  const marks=session?await api.loadMyRequestMarks(page.requests.map(r=>r.id)):new Map();
  root.innerHTML=`<section data-requests-ranking><section class="page-head"><a class="back" href="#places">← Miejsca</a><p class="kicker">Prośby społeczności</p><h1>Czego brakuje w mieście?</h1><p class="lead">Każde +1 to jedna zalogowana osoba. Najczęściej wspierane prośby trafiają najwyżej.</p></section><div class="request-toolbar"><a class="button primary" href="#places/request" data-request-entry data-kind="place">Poproś o miejsce</a><label>Sortuj<select data-request-sort><option value="popular" ${rankingSort==='popular'?'selected':''}>Najwięcej +1</option><option value="newest" ${rankingSort==='newest'?'selected':''}>Najnowsze</option></select></label></div>${page.requests.length?`<div class="request-list">${page.requests.map(r=>requestCard(r,marks.get(r.id))).join('')}</div>`:'<div class="empty"><p>Nie ma jeszcze aktywnych próśb w tym mieście.</p><a class="button primary" href="#places/request" data-request-entry data-kind="place">Dodaj pierwszą</a></div>'}</section>`;
 }catch(error){root.innerHTML=`<section data-requests-ranking><a class="back" href="#places">← Miejsca</a><div class="empty"><p>Nie udało się wczytać próśb (${esc(error.code||'błąd')}).</p></div></section>`;}
}

function requestError(code){return ({'invalid-title':'Wpisz nazwę lub opis brakującego miejsca (2–120 znaków).','invalid-category':'Wybierz prawidłową kategorię.','category-required':'Wybierz kategorię.','invalid-note':'Notatka może mieć maksymalnie 500 znaków.','invalid-url':'Link musi zaczynać się od http:// lub https://.','rate-limited':'Osiągnąłeś limit 20 nowych próśb w ciągu 24 godzin.','request-not-supportable':'Ta prośba nie przyjmuje już głosów.','creator-support-required':'Autor prośby nie może wycofać własnego +1.','auth-required':'Zaloguj się, aby wykonać tę akcję.','network':'Nie udało się połączyć. Spróbuj ponownie.'}[code]||`Nie udało się (${code||'błąd'}).`);}

async function renderRequestForm(force=false){
 const root=main();if(!root)return;if(!force&&root.querySelector('[data-request-form-root]'))return;
 markNav('places');await ensureTaxonomy();const p=takePrefill(),kind=p.kind==='category_gap'?'category_gap':'place',categoryId=p.categoryId||'';
 root.innerHTML=`<section data-request-form-root><section class="page-head"><a class="back" href="#places">← Miejsca</a><p class="kicker">Prośba do City Route</p><h1>Powiedz, czego brakuje.</h1><p class="lead">To nie jest prywatne miejsce na Twoim telefonie. Prośba trafia do wspólnego rankingu; podobne zgłoszenia łączymy przez +1.</p></section><form class="profile-form request-form" data-request-form><fieldset class="plain"><legend>O co prosisz?</legend><label class="request-radio"><input type="radio" name="kind" value="place" ${kind==='place'?'checked':''}> Konkretne miejsce</label><label class="request-radio"><input type="radio" name="kind" value="category_gap" ${kind==='category_gap'?'checked':''}> Więcej miejsc w kategorii</label></fieldset><label>Nazwa lub krótki opis<input name="title" required maxlength="120" value="${esc(p.title||'')}" placeholder="Np. Kebab u Ahmeda albo Więcej klubów"></label><label>Kategoria<select name="category">${categoryOptions(categoryId)}</select></label><label>Notatka dla redakcji<textarea name="note" maxlength="500" rows="3" placeholder="Opcjonalnie: gdzie to jest, dlaczego warto, czego dokładnie brakuje"></textarea></label><label>Link do miejsca<input name="source" type="url" maxlength="500" value="${esc(p.sourceUrl||'')}" placeholder="https://maps.google.com/…"></label><section class="request-similar" data-request-similar><p class="fine">Wpisz nazwę — sprawdzimy, czy ktoś już o to prosił.</p></section><button class="primary big" type="submit">Wyślij prośbę</button><p class="fine">Wysłanie prośby i +1 wymagają zalogowania. Inni użytkownicy nie zobaczą Twojej notatki, linku ani tożsamości.</p><p class="request-form-status" role="status"></p></form><p class="request-rank-bottom"><a href="#places/requests">Zobacz ranking aktywnych próśb →</a></p></section>`;
 scheduleSimilar(root.querySelector('[data-request-form]'),0);
}

function scheduleSimilar(form,delay=280){clearTimeout(similarTimer);similarTimer=setTimeout(()=>loadSimilar(form),delay);}
async function loadSimilar(form){
 if(!form?.isConnected)return;const fd=new FormData(form),title=String(fd.get('title')||'').trim(),kind=String(fd.get('kind')||'place'),categoryId=String(fd.get('category')||'')||null,host=form.querySelector('[data-request-similar]');
 if(title.length<2){host.innerHTML='<p class="fine">Wpisz nazwę — sprawdzimy, czy ktoś już o to prosił.</p>';return;}
 const seq=++similarSeq;host.innerHTML='<p class="fine">Szukam podobnych próśb…</p>';
 try{
  const rows=await api.findSimilarRequests({citySlug:cityId(),title,kind,categoryId,limit:5});if(seq!==similarSeq||!form.isConnected)return;
  const marks=session?await api.loadMyRequestMarks(rows.map(r=>r.id)):new Map();
  host.innerHTML=rows.length?`<h2>Może już o to proszą?</h2><p class="fine">Zamiast duplikatu dodaj +1.</p><div class="request-list compact">${rows.map(r=>requestCard(r,marks.get(r.id),{similar:true})).join('')}</div>`:'<p class="fine">Nie znaleźliśmy podobnej aktywnej prośby.</p>';
 }catch{if(seq===similarSeq)host.innerHTML='<p class="fine">Nie udało się sprawdzić podobnych próśb. Nadal możesz wysłać własną.</p>';}
}

async function submitRequest(form){
 if(authRequired())return;const status=form.querySelector('.request-form-status'),button=form.querySelector('button[type="submit"]'),fd=new FormData(form);button.disabled=true;status.textContent='Wysyłam…';
 try{
  const id=await api.createRequest({citySlug:cityId(),kind:String(fd.get('kind')||'place'),title:String(fd.get('title')||''),categoryId:String(fd.get('category')||'')||null,note:String(fd.get('note')||''),sourceUrl:String(fd.get('source')||'')||null});
  log('place_request_create',{request_id:id,kind:String(fd.get('kind')||'place')});clearPrefill();toast('Prośba wysłana. Twój głos już się liczy.');location.hash='#profile/requests';
 }catch(error){status.textContent=requestError(error.code);button.disabled=false;}
}

async function renderMyRequests(force=false){
 const root=main();if(!root)return;if(!force&&root.querySelector('[data-my-requests]'))return;markNav('profile');
 if(!session){root.innerHTML='<section data-my-requests><section class="page-head"><a class="back" href="#profile">← Profil</a><p class="kicker">Twoje prośby</p><h1>Zaloguj się</h1><p class="lead">Statusy próśb są przypisane do Twojego konta.</p><a class="button primary" href="#profile">Przejdź do logowania</a></section></section>';return;}
 root.innerHTML='<p class="loading" data-my-requests>Wczytuję Twoje prośby…</p>';
 try{
  await ensureTaxonomy();const rows=await api.loadMyRequests();
  root.innerHTML=`<section data-my-requests><section class="page-head"><a class="back" href="#profile">← Profil</a><p class="kicker">Twoje prośby</p><h1>Co zgłosiłeś?</h1><p class="lead">Tutaj zobaczysz decyzję City Route i liczbę osób, które dołączyły do Twojej prośby.</p></section><a class="button primary" href="#places/request" data-request-entry data-kind="place">Nowa prośba</a>${rows.length?`<div class="request-list mine">${rows.map(r=>`<article class="request-card my-request"><div class="request-card-main"><p class="kicker">${esc(kindLabel(r.kind))}${r.categoryId?` · ${esc(catLabel(r.categoryId))}`:''}</p><h3>${esc(r.title)}</h3><p><span class="request-status-${esc(r.status)}">${esc(statusLabel(r.status))}</span> · ${r.supports} ${plural(r.supports,'osoba','osoby','osób')} · ${esc(date(r.createdAt))}</p>${r.note?`<p class="request-note">${esc(r.note)}</p>`:''}${r.sourceUrl?`<p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">Twój link ↗</a></p>`:''}</div><div class="request-card-action">${r.status==='added'&&r.resolvedPlaceId?`<button class="primary" data-request-open-place="${esc(r.resolvedPlaceId)}" data-request-open-city="${esc(r.cityId||'')}">Zobacz dodane miejsce</button>`:''}${r.canEdit?`<button class="danger" data-request-delete="${esc(r.id)}">Usuń prośbę</button>`:''}</div></article>`).join('')}</div>`:'<div class="empty"><p>Nie wysłałeś jeszcze żadnej prośby.</p><a class="button primary" href="#places/request" data-request-entry data-kind="place">Poproś o pierwsze miejsce</a></div>'}</section>`;
 }catch(error){root.innerHTML=`<section data-my-requests><a class="back" href="#profile">← Profil</a><div class="empty"><p>Nie udało się wczytać Twoich próśb (${esc(error.code||'błąd')}).</p></div></section>`;}
}

function maybeOpenResolvedPlace(){
 const raw=sessionStorage.getItem(OPEN_PLACE_KEY);if(!raw||route().kind!=='places'||route().id)return;
 sessionStorage.removeItem(OPEN_PLACE_KEY);
 let target;try{target=JSON.parse(raw);}catch{target={placeId:raw,cityId:null};}
 const id=String(target?.placeId||'').trim(),targetCity=String(target?.cityId||'').trim();if(!id)return;
 if(targetCity&&targetCity!==cityId()){toast('To miejsce jest w innym mieście albo nie jest jeszcze w katalogu.');return;}
 const root=main(),hit=[...root.querySelectorAll('[data-action="place"][data-id]')].find(x=>String(x.dataset.id)===id);
 if(hit){hit.click();return;}
 toast('To miejsce jest w innym mieście albo nie jest jeszcze w katalogu.');
}

async function enhance(){
 if(rendering){queued=true;return;}rendering=true;
 try{
  const {kind,id}=route();
  if(kind==='places'&&id==='request')await renderRequestForm();
  else if(kind==='places'&&id==='requests')await renderRanking();
  else if(kind==='profile'&&id==='requests')await renderMyRequests();
  else{
   if(kind==='places'&&!id)await injectPlacesEntryPoints();
   if(kind==='profile'&&!id)injectProfileEntry();
  }
  await injectUserPlaceRequest();
 }catch(error){console.warn('Requests UI',error);}
 finally{rendering=false;if(queued){queued=false;queueMicrotask(enhance);}}
}

document.addEventListener('click',async e=>{
 const entry=e.target.closest?.('[data-request-entry]');if(entry){savePrefill({kind:entry.dataset.kind||'place',title:entry.dataset.title||'',categoryId:entry.dataset.category||'',sourceUrl:entry.dataset.source||''});return;}
 const support=e.target.closest?.('[data-request-support]');if(support){e.preventDefault();if(authRequired())return;support.disabled=true;try{if(support.dataset.requestSupport==='unsupport'){await api.unsupportRequest(support.dataset.id);log('place_request_unvote',{request_id:support.dataset.id});toast('Wycofano +1.');}else{await api.supportRequest(support.dataset.id);log('place_request_vote',{request_id:support.dataset.id});toast('Dodano +1.');}const {kind,id}=route();if(kind==='places'&&id==='requests')await renderRanking(true);else if(kind==='places'&&id==='request')await loadSimilar(document.querySelector('[data-request-form]'));}catch(error){alert(requestError(error.code));support.disabled=false;}return;}
 const del=e.target.closest?.('[data-request-delete]');if(del){if(!confirm('Usunąć tę prośbę?'))return;del.disabled=true;try{await api.deleteMyRequest(del.dataset.requestDelete);toast('Prośba usunięta.');await renderMyRequests(true);}catch(error){alert(requestError(error.code));del.disabled=false;}return;}
 const open=e.target.closest?.('[data-request-open-place]');if(open){sessionStorage.setItem(OPEN_PLACE_KEY,JSON.stringify({placeId:open.dataset.requestOpenPlace,cityId:open.dataset.requestOpenCity||''}));location.hash='#places';return;}
});

document.addEventListener('input',e=>{const form=e.target.closest?.('[data-request-form]');if(form&&['title','category'].includes(e.target.name))scheduleSimilar(form);});
document.addEventListener('change',e=>{
 if(e.target.matches?.('[data-request-sort]')){rankingSort=e.target.value==='newest'?'newest':'popular';renderRanking(true);return;}
 const form=e.target.closest?.('[data-request-form]');if(form&&['kind','category'].includes(e.target.name))scheduleSimilar(form,0);
});
document.addEventListener('submit',e=>{const form=e.target.closest?.('[data-request-form]');if(form){e.preventDefault();submitRequest(form);}});
window.addEventListener('hashchange',enhance);
new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});

const {data:{session:initialSession}}=await supabase.auth.getSession();session=initialSession;
supabase.auth.onAuthStateChange((_event,next)=>{session=next;enhance();});
ensureTaxonomy().catch(()=>{}).finally(enhance);
