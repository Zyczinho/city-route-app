import {supabase} from './supabase-client.js';
import {createSocialRoutesClient} from './social-routes-client.js';

const api=createSocialRoutesClient({client:supabase});
const STORAGE_KEY='city-route-v1';
const EDIT_KEY='city-route-social-editing';
let session=null,feed=[],marks=new Map(),sort='popular',rendering=false,queued=false,placeIndex=new Map(),completedDraft=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const readState=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{};}catch{return {};}};
const writeState=value=>localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
const cityId=()=>document.querySelector('#city-select')?.value||readState().cityId||'warsaw';
const main=()=>document.querySelector('#main');
const plural=(n,a,b,c)=>n===1?a:([2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?b:c);
const stars=v=>v==null?'Brak ocen':`★ ${Number(v).toFixed(1).replace('.',',')}`;
const log=(type,data={})=>{const s=readState();s.events=Array.isArray(s.events)?s.events:[];s.events.push({type,...data,city_id:cityId(),at:new Date().toISOString()});s.events=s.events.slice(-5000);writeState(s);};
const socialHash=()=>{const [kind,id]=(location.hash.slice(1)||'').split('/');return {kind,id};};

function imageSrc(p){const image=p?.image||p?.image_url;if(!image)return '';return /^(https?:|data:image\/)/.test(image)?image:`./assets/images/${image}`;}
function photo(src,alt=''){return src?`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'<div class="social-ph" aria-hidden="true">◎</div>';}

async function loadPlaces(city){
 const {data,error}=await supabase.rpc('catalogue_places',{city_slug:city});
 if(error){placeIndex=new Map();return;}
 placeIndex=new Map((data||[]).map(p=>[String(p.id),{...p,image:p.image_url||null}]));
}
function routeCover(route,used=new Set()){
 for(const id of route.stops||[]){const src=imageSrc(placeIndex.get(String(id)));if(src&&!used.has(src)){used.add(src);return src;}}
 return '';
}
function stopNames(route){return (route.stops||[]).map(id=>placeIndex.get(String(id))?.name||id);}
function currentEditorialImages(){return new Set([...document.querySelectorAll('.route-card img')].map(x=>x.getAttribute('src')).filter(Boolean));}

function authRequired(){
 if(session)return false;
 alert('Zaloguj się, żeby zapisywać, publikować i oceniać trasy.');
 location.hash='#profile';
 return true;
}
function markRoutesNav(){
 const nav=document.querySelector('#navigation');if(!nav)return;
 nav.querySelectorAll('a').forEach(a=>{a.classList.remove('active');a.removeAttribute('aria-current');});
 const a=nav.querySelector('a[href="#routes"]');if(a){a.classList.add('active');a.setAttribute('aria-current','page');}
}

function card(route,cover){
 const m=marks.get(route.uuid)||{saved:false,rating:null};
 return `<article class="social-route-card" data-social-route="${esc(route.uuid)}"><a class="social-route-hit" href="#community-route/${esc(route.uuid)}"><div class="social-media">${photo(cover,route.name)}<span class="social-author">@${esc(route.author.nickname)}</span></div><div class="social-body"><h3>${esc(route.name)}</h3>${route.description?`<p>${esc(route.description)}</p>`:''}<p class="social-path">${stopNames(route).map(esc).join(' → ')}</p><div class="social-stats"><span>${route.stopCount} ${plural(route.stopCount,'przystanek','przystanki','przystanków')}</span><span>${esc(route.transport)}</span><span>${stars(route.stats.ratingAvg)} · ${route.stats.ratings}</span><span>♡ ${route.stats.saves}</span>${route.stats.forks?`<span>⑂ ${route.stats.forks}</span>`:''}</div></div></a><div class="social-card-actions"><a href="#social-profile/${esc(route.author.id)}">Profil autora</a><button data-social-action="save" data-route="${esc(route.uuid)}" aria-pressed="${m.saved}">${m.saved?'Zapisano':'Zapisz'}</button></div></article>`;
}

async function refreshFeed(){
 const city=cityId();
 await loadPlaces(city);
 const page=await api.loadCommunityRoutes({citySlug:city,sort,limit:20});
 feed=page.routes;
 marks=session?await api.loadRouteMarks(feed.map(r=>r.uuid)):new Map();
}

async function injectFeed(){
 if(location.hash.split('/')[0]!=='#routes')return;
 const root=main();if(!root)return;
 const note=root.querySelector('.community-note');if(!note||root.querySelector('[data-social-feed]'))return;
 const oldHead=[...root.querySelectorAll('.section-head')].find(x=>x.querySelector('h2')?.textContent.trim()==='Trasy społeczności');
 if(oldHead){const maybeMine=oldHead.nextElementSibling;if(maybeMine?.classList.contains('route-grid')){oldHead.querySelector('h2').textContent='Twoje zapisane trasy';oldHead.querySelector('span').textContent='lokalnie';}else oldHead.remove();}
 note.insertAdjacentHTML('beforebegin','<section data-social-feed class="social-feed"><div class="section-head"><h2>Społeczność</h2><label class="social-sort">Sortuj <select data-social-sort><option value="popular">Popularne</option><option value="top">Najlepiej oceniane</option><option value="newest">Najnowsze</option></select></label></div><p class="social-loading" data-social-status>Wczytuję trasy społeczności…</p></section>');
 note.hidden=true;
 const host=root.querySelector('[data-social-feed]');
 try{
  await refreshFeed();
  const used=currentEditorialImages();
  host.innerHTML=`<div class="section-head"><h2>Społeczność</h2><label class="social-sort">Sortuj <select data-social-sort><option value="popular" ${sort==='popular'?'selected':''}>Popularne</option><option value="top" ${sort==='top'?'selected':''}>Najlepiej oceniane</option><option value="newest" ${sort==='newest'?'selected':''}>Najnowsze</option></select></label></div>${feed.length?`<div class="social-grid">${feed.map(r=>card(r,routeCover(r,used))).join('')}</div>`:'<div class="empty"><p>Jeszcze nikt nie opublikował trasy w tym mieście.</p><a class="button primary" href="#my-route">Ułóż pierwszą</a></div>'}`;
 }catch(error){host.innerHTML='<div class="section-head"><h2>Społeczność</h2></div><div class="empty"><p>Nie udało się wczytać tras społeczności.</p></div>';console.warn('Social feed',error);}
}

function currentDraft(){
 const s=readState(),city=cityId(),meta=s.builderMetaByCity?.[city]||{};
 const name=document.querySelector('#builder-name')?.value??meta.name??'';
 const transport=document.querySelector('#builder-transport')?.value??meta.transport??'walking';
 const stops=[...(s.basketsByCity?.[city]||s.basket||[])];
 return {cityId:city,name:String(name).trim(),transport,stops};
}
function publishDialog(override=null){
 if(authRequired())return;
 completedDraft=override?{...override,stops:[...override.stops]}:null;
 const draft=completedDraft||currentDraft();if(draft.stops.length<2)return alert('Dodaj co najmniej 2 przystanki.');
 if(!draft.name)return alert('Najpierw nazwij trasę.');
 let stored=null;if(!completedDraft){try{stored=JSON.parse(sessionStorage.getItem(EDIT_KEY)||'null');}catch{sessionStorage.removeItem(EDIT_KEY);}}
 const dialog=document.createElement('dialog');dialog.className='social-dialog';
 dialog.innerHTML=`<form method="dialog" data-social-publish><button type="button" class="social-close" data-social-action="close-dialog" aria-label="Zamknij">×</button><p class="kicker">Społeczność</p><h2>${stored?.editingRouteId?'Zaktualizuj trasę':'Opublikuj trasę'}</h2><p class="fine">${esc(draft.name)} · ${draft.stops.length} przystanków</p><label>Opis<textarea name="description" maxlength="500" rows="4" placeholder="Co warto wiedzieć o tej trasie?">${esc(stored?.description||'')}</textarea></label><label>Tagi<input name="tags" value="${esc((stored?.tags||[]).join(', '))}" placeholder="np. lokalnie, jedzenie"></label><label>Widoczność<select name="visibility"><option value="public" ${stored?.visibility!=='unlisted'?'selected':''}>Publiczna — widoczna w Społeczności</option><option value="unlisted" ${stored?.visibility==='unlisted'?'selected':''}>Tylko link</option></select></label><button class="primary big" type="submit">${stored?.editingRouteId?'Zapisz zmiany':'Opublikuj'}</button><p class="social-form-status" role="status"></p></form>`;
 document.body.append(dialog);dialog.showModal();
}
async function submitPublish(form){
 const button=form.querySelector('button[type=submit]'),status=form.querySelector('.social-form-status');button.disabled=true;status.textContent='Publikuję…';
 const fd=new FormData(form),draft=completedDraft||currentDraft();let stored=null;if(!completedDraft){try{stored=JSON.parse(sessionStorage.getItem(EDIT_KEY)||'null');}catch{sessionStorage.removeItem(EDIT_KEY);}}
 const tags=String(fd.get('tags')||'').split(',').map(x=>x.trim().toLowerCase().replace(/\s+/g,'-')).filter(Boolean);
 try{
  const id=await api.publishRoute({draft,description:String(fd.get('description')||'').trim(),tags,visibility:String(fd.get('visibility')||'public'),editingRouteId:stored?.editingRouteId||null,forkedFrom:stored?.forkedFrom||null});
  completedDraft=null;sessionStorage.removeItem(EDIT_KEY);log('community_route_publish',{route_id:id,editing:!!stored?.editingRouteId});form.closest('dialog')?.remove();location.hash=`#community-route/${id}`;
 }catch(error){status.textContent=error.code==='unknown-stop'?'Jednego z miejsc nie można opublikować. Usuń prywatne lub nieaktualne miejsce.':`Nie udało się opublikować (${error.code||'błąd'}).`;button.disabled=false;}
}

function writeDraft(route,{editing=false}={}){
 const city=cityId();if(route.cityId!==city){alert('Najpierw przełącz aplikację na miasto tej trasy.');return;}
 const s=readState(),existing=s.basketsByCity?.[city]||s.basket||[];
 if(existing.length&&!confirm('Twoja obecna trasa zostanie zastąpiona. Kontynuować?'))return;
 const fork=editing?{draft:{cityId:city,stops:[...route.stops],name:route.name,transport:route.transport},forkedFrom:null}:api.forkRoute(route,{cityId:city,isKnown:id=>placeIndex.has(String(id)),now:new Date().toISOString()});
 s.basketsByCity=s.basketsByCity||{};s.builderMetaByCity=s.builderMetaByCity||{};s.basketsByCity[city]=[...fork.draft.stops];s.basket=[...fork.draft.stops];s.builderMetaByCity[city]={cityId:city,name:fork.draft.name,transport:fork.draft.transport,revision:0,updatedAt:new Date().toISOString()};writeState(s);
 sessionStorage.setItem(EDIT_KEY,JSON.stringify(editing?{editingRouteId:route.uuid,description:route.description,tags:route.tags,visibility:route.visibility}:{forkedFrom:fork.forkedFrom}));
 log(editing?'community_route_edit':'community_route_fork',{route_id:route.uuid});location.hash='#my-route';location.reload();
}

async function renderCommunityRoute(id){
 const root=main();if(!root)return;
 if(root.querySelector('[data-social-route-root]')?.dataset.socialRouteRoot===id)return;
 const reserved=currentEditorialImages();markRoutesNav();
 root.innerHTML=`<p class="loading" data-social-route-loading="${esc(id)}">Wczytuję trasę społeczności…</p>`;
 try{
  const route=await api.loadCommunityRoute(id);if(!route){root.innerHTML=`<div class="empty" data-social-route-root="${esc(id)}"><p>Nie znaleziono tej trasy.</p><a class="button" href="#routes">Wróć do tras</a></div>`;return;}
  await loadPlaces(route.cityId);const cover=routeCover(route,reserved);const mark=session?(await api.loadRouteMarks([route.uuid])).get(route.uuid):null;const own=session?.user?.id===route.author.id;const authorFeedback=own?await api.loadAuthorFeedback(route.uuid).catch(()=>[]):[];
  root.innerHTML=`<section class="social-detail" data-social-route-root="${esc(id)}"><a class="back" href="#routes">← Trasy</a><div class="social-detail-cover">${photo(cover,route.name)}</div><p class="kicker">Trasa społeczności</p><h1>${esc(route.name)}</h1><p class="lead">${esc(route.description||'Trasa użytkownika City Route.')}</p><a class="social-author-link" href="#social-profile/${esc(route.author.id)}">Autor: ${esc(route.author.nickname)}</a><div class="social-stats large"><span>${route.stopCount} przystanków</span><span>${esc(route.transport)}</span><span>${stars(route.stats.ratingAvg)} · ${route.stats.ratings} ocen</span><span>♡ ${route.stats.saves}</span><span>⑂ ${route.stats.forks}</span></div>${route.forkedFrom?`<p class="fine">Na bazie: ${esc(route.forkedFrom.name||'innej trasy')}</p>`:''}<div class="detail-actions social-detail-actions"><button class="primary big" data-social-action="fork" data-route="${esc(route.uuid)}">Użyj jako bazę</button><button data-social-action="save" data-route="${esc(route.uuid)}" aria-pressed="${!!mark?.saved}">${mark?.saved?'Zapisano':'Zapisz trasę'}</button>${own?`<button data-social-action="edit" data-route="${esc(route.uuid)}">Edytuj</button><button data-social-action="archive" data-route="${esc(route.uuid)}">Archiwizuj</button><button class="danger" data-social-action="delete" data-route="${esc(route.uuid)}">Usuń</button>`:''}</div>${!own?`<section class="social-rating"><h2>Oceń trasę</h2><div role="group" aria-label="Ocena 1 do 5">${[1,2,3,4,5].map(n=>`<button data-social-action="rate" data-route="${esc(route.uuid)}" data-rating="${n}" aria-pressed="${mark?.rating===n}">${n}★</button>`).join('')}</div><p class="fine">Ocena jest dobrowolna. Jeśli chcesz zostawić wskazówkę autorowi, najpierw wybierz gwiazdki.</p></section><form class="social-feedback-form" data-social-feedback data-route="${esc(route.uuid)}"><label>Feedback dla autora <span>(opcjonalnie, niepubliczny)</span><textarea name="feedback" rows="3" maxlength="500" placeholder="Co Ci się podobało, co poprawić?"></textarea></label><button type="submit" class="primary" ${mark?.rating?'':'disabled'}>Wyślij wskazówkę</button><p class="social-feedback-status" role="status"></p></form>`:`<section class="social-author-feedback"><h2>Feedback do Twojej trasy</h2>${authorFeedback.length?authorFeedback.map(f=>`<blockquote><span>★ ${f.rating}/5</span><p>${esc(f.feedback)}</p></blockquote>`).join(''):'<p class="fine">Nie ma jeszcze tekstowych opinii.</p>'}</section>`}<h2>Przystanki</h2><ol class="social-stops">${route.stops.map((sid,i)=>{const p=placeIndex.get(String(sid));return `<li><span>${i+1}</span><div>${photo(imageSrc(p),p?.name||sid)}</div><strong>${esc(p?.name||sid)}</strong></li>`;}).join('')}</ol></section>`;
  log('community_route_view',{route_id:id});
 }catch(error){root.innerHTML=`<div class="empty" data-social-route-root="${esc(id)}"><p>Nie udało się wczytać trasy.</p><a class="button" href="#routes">Wróć</a></div>`;console.warn(error);}
}

async function renderProfile(id){
 const root=main();if(!root)return;
 if(root.querySelector('[data-social-profile-root]')?.dataset.socialProfileRoot===id)return;
 markRoutesNav();root.innerHTML=`<p class="loading" data-social-profile-loading="${esc(id)}">Wczytuję profil…</p>`;
 try{
  const activeCity=cityId();
  const [profile,routes]=await Promise.all([api.loadPublicProfile(id),api.loadAuthorRoutes({userId:id,citySlug:activeCity})]);
  if(!profile){root.innerHTML=`<div class="empty" data-social-profile-root="${esc(id)}"><p>Profil nie jest publiczny.</p><a class="button" href="#routes">Wróć</a></div>`;return;}
  await loadPlaces(activeCity);const used=new Set();
  root.innerHTML=`<section class="social-profile" data-social-profile-root="${esc(id)}"><a class="back" href="#routes">← Trasy</a><p class="kicker">Odkrywca</p><h1>${esc(profile.nickname)}</h1><p class="lead">${esc(profile.bio||'Autor tras społeczności City Route.')}</p><div class="social-links">${Object.entries(profile.socials).filter(([,v])=>v).map(([k,v])=>`<a href="${esc(/^https?:/.test(v)?v:'https://'+v)}" target="_blank" rel="noopener noreferrer">${esc(k)}</a>`).join('')}</div><div class="section-head"><h2>Publiczne trasy w tym mieście</h2><span>${routes.length} / ${profile.routeCount}</span></div><div class="social-grid">${routes.map(r=>card(r,routeCover(r,used))).join('')||'<div class="empty"><p>Brak publicznych tras w tym mieście.</p></div>'}</div></section>`;
 }catch(error){root.innerHTML=`<div class="empty" data-social-profile-root="${esc(id)}"><p>Nie udało się wczytać profilu.</p></div>`;console.warn(error);}
}

async function renderSaved(){
 if(authRequired())return;
 const root=main();if(!root)return;
 if(root.querySelector('[data-social-saved-root]'))return;
 markRoutesNav();root.innerHTML='<p class="loading" data-social-saved-loading>Wczytuję zapisane trasy…</p>';
 try{
  const activeCity=cityId(),allSaved=await api.loadSavedRoutes(),saved=allSaved.filter(x=>x.cityId===activeCity);
  root.innerHTML=`<section data-social-saved-root><a class="back" href="#routes">← Trasy</a><p class="kicker">Twoje konto</p><h1>Zapisane trasy</h1><p class="fine">Pokazujemy zapisane trasy dla aktywnego miasta. Przełącz miasto, aby zobaczyć pozostałe.</p><div class="cards">${saved.map(x=>`<article class="card"><h3>${esc(x.name)}</h3><p class="muted">${esc(x.cityId)} · ${x.type==='community'?'Społeczność':'City Route'}</p><a class="button" href="${x.type==='community'?`#community-route/${x.routeId}`:`#route/${x.id}`}">Otwórz</a></article>`).join('')||'<div class="empty"><p>Nie masz jeszcze zapisanych tras w tym mieście.</p></div>'}</div></section>`;
 }catch(error){root.innerHTML='<div class="empty" data-social-saved-root><p>Nie udało się wczytać zapisanych tras.</p></div>';console.warn(error);}
}

function injectMyRoute(){
 if(location.hash.split('/')[0]!=='#my-route')return;const root=main();if(!root||root.querySelector('[data-social-publish-button]'))return;
 const actions=root.querySelector('.detail-actions');if(!actions)return;
 const draft=currentDraft();if(draft.stops.length<2)return;
 const b=document.createElement('button');b.dataset.socialPublishButton='1';b.dataset.socialAction='publish';b.className='social-publish';b.textContent=session?'Opublikuj trasę':'Zaloguj się i opublikuj';actions.append(b);
}
function injectProfileEntry(){
 if(location.hash.split('/')[0]!=='#profile')return;const root=main();if(!root||root.querySelector('[data-social-saved-entry]'))return;
 const menu=root.querySelector('.menu');if(menu){const a=document.createElement('a');a.href='#social-saved';a.dataset.socialSavedEntry='1';a.innerHTML='<span>🔖</span><span>Zapisane trasy<small>Trasy City Route i społeczności</small></span><span>›</span>';menu.prepend(a);}
}

async function toggleSave(routeId){
 if(authRequired())return;const current=marks.get(routeId);
 try{if(current?.saved){await api.unsaveRoute(routeId);marks.set(routeId,{...current,saved:false});log('community_route_unsave',{route_id:routeId});}else{await api.saveRoute(routeId);marks.set(routeId,{...(current||{}),saved:true});log('community_route_save',{route_id:routeId});}queueRender();}catch(error){alert(`Nie udało się zapisać trasy (${error.code||'błąd'}).`);}
}
async function rate(routeId,rating){if(authRequired())return;try{await api.rateRoute(routeId,rating);marks.set(routeId,{...(marks.get(routeId)||{}),rating:Number(rating)});log('community_route_rate',{route_id:routeId,rating:Number(rating)});document.querySelectorAll(`[data-social-action="rate"][data-route="${routeId}"]`).forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rating)===Number(rating))));document.querySelector('[data-social-feedback] button[type="submit"]')?.removeAttribute('disabled');queueRender();}catch(error){alert(error.code==='forbidden'?'Nie możesz ocenić własnej trasy.':'Nie udało się zapisać oceny.');}}

async function handleAction(el){
 const action=el.dataset.socialAction,id=el.dataset.route;
 if(action==='close-dialog'){completedDraft=null;el.closest('dialog')?.remove();return;}
 if(action==='publish'){publishDialog();return;}
 if(action==='save'){await toggleSave(id);return;}
 if(action==='rate'){await rate(id,el.dataset.rating);return;}
 const route=feed.find(r=>r.uuid===id)||await api.loadCommunityRoute(id);if(!route)return;
 if(action==='fork'){if(authRequired())return;await loadPlaces(route.cityId);writeDraft(route);return;}
 if(action==='edit'){if(authRequired())return;await loadPlaces(route.cityId);writeDraft(route,{editing:true});return;}
 if(action==='archive'){if(authRequired())return;if(confirm('Archiwizować tę trasę?')){await api.archiveRoute(id);location.hash='#routes';log('community_route_archive',{route_id:id});}return;}
 if(action==='delete'){if(authRequired())return;if(confirm('Usunąć tę trasę? Tego nie można cofnąć.')){await api.deleteOwnedRoute(id);location.hash='#routes';log('community_route_delete',{route_id:id});}return;}
}

async function routeRender(){
 if(rendering)return;rendering=true;
 try{
  const {kind,id}=socialHash();
  if(kind==='community-route'&&id){await renderCommunityRoute(id);return;}
  if(kind==='social-profile'&&id){await renderProfile(id);return;}
  if(kind==='social-saved'){await renderSaved();return;}
  injectMyRoute();injectProfileEntry();await injectFeed();
 }finally{rendering=false;}
}
function queueRender(){if(queued)return;queued=true;setTimeout(()=>{queued=false;routeRender();},0);}

// Finished sessions can be published verbatim; do not replace the user's editable basket.
// The normal publish form remains the only network write path (auth/RLS validation unchanged).
document.addEventListener('cityroute:publish-completed',event=>{
 const d=event.detail||{},current=cityId();
 if(!Array.isArray(d.stops)||d.stops.length<2||d.cityId!==current)return;
 publishDialog({cityId:d.cityId,name:String(d.name||'Ukończona trasa').slice(0,80),transport:d.transport||'walking',stops:d.stops.filter(id=>typeof id==='string')});
});
document.addEventListener('click',e=>{const el=e.target.closest?.('[data-social-action]');if(el){e.preventDefault();handleAction(el).catch(console.error);}},true);
document.addEventListener('change',e=>{if(e.target.matches?.('[data-social-sort]')){sort=e.target.value;const host=document.querySelector('[data-social-feed]');if(host)host.remove();const note=document.querySelector('.community-note');if(note)note.hidden=false;queueRender();}});
document.addEventListener('submit',async e=>{
 const form=e.target.closest?.('[data-social-feedback]');if(!form)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(authRequired())return;
 const status=form.querySelector('.social-feedback-status'),button=form.querySelector('button[type="submit"]');
 button.disabled=true;status.textContent='Zapisuję…';
 try{
  await api.saveFeedback(form.dataset.route,String(new FormData(form).get('feedback')||'').trim());
  status.textContent='Feedback wysłany autorowi. Nie jest publiczny.';
  log('community_route_feedback',{route_id:form.dataset.route});
 }catch(error){status.textContent=error.code==='rate-first'?'Najpierw oceń trasę od 1 do 5.':'Nie udało się zapisać feedbacku ('+(error.code||'błąd')+').';}
 finally{button.disabled=false;}
},true);
document.addEventListener('submit',e=>{const form=e.target.closest?.('[data-social-publish]');if(form){e.preventDefault();e.stopImmediatePropagation();submitPublish(form);}},true);
window.addEventListener('hashchange',queueRender);
const observer=new MutationObserver(queueRender);observer.observe(document.querySelector('#main')||document.documentElement,{subtree:true,childList:true});
const {data:{session:initialSession}}=await supabase.auth.getSession();session=initialSession;supabase.auth.onAuthStateChange((_event,next)=>{session=next;queueRender();});queueRender();
