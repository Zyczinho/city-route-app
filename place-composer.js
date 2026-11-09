// CLAUDE-PLACE-017: one input to add a place fast (name, address, Google Maps link or coordinates).
// It decorates the existing #place-form rendered by app.js; app.js still validates and saves the place on submit,
// so this module only fills `name`, `where` (as coordinates) and `cat`. Saved places stay on this device.
import {iconMarkup} from './ui-icons.js';
import {MIN_QUERY,SUGGEST_DELAY_MS,classifyInput,formatCoords,normalizeQuery,keepsSelection,cityCheck,activeCity,cityParams,catalogueMatches,findDuplicate,categoryFromTypes,SOURCE_LABEL,latestOnly,sessionToken} from './place-composer-model.js';
import {loadLeaflet} from './map-view.js';
import {findPlacePhotoCandidates,acceptedPhotoRecord,acceptedGooglePlaceId,autoPhotoCandidateIndex} from './place-photo-proposal.js';

const STATE_KEY='city-route-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(s,root=document)=>root.querySelector(s);
const appState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null');}catch{return null;}};

let cities=null,catalogueByCity={},selection=null,generation=0,staleWhere='',lastQuery='',session=sessionToken(),timer=0,controller=null,map=null,marker=null,activeIndex=-1,options=[];
// P0 #1: automatic photo proposal for the picked venue. {key,status,candidates,index,accepted,skipped}
let proposal=null,proposalController=null;
const icon=n=>`<span class="i" style="--i:url(./assets/icons/ui/${n}.svg)" aria-hidden="true"></span>`;
const requests=latestOnly();

async function jsonOrNull(url,opts){
 try{const r=await fetch(url,opts);if(!(r.headers.get('content-type')||'').includes('json'))return null;const data=await r.json();return {ok:r.ok,data};}
 catch(error){if(error?.name==='AbortError')throw error;return null;}
}

async function loadCities(){
 if(cities)return cities;
 const r=await jsonOrNull('./data/cities.json');cities=Array.isArray(r?.data)?r.data:[{id:'warsaw',name:'Warszawa',center:{lat:52.2297,lng:21.0122},radiusKm:40}];
 return cities;
}
async function currentCity(){return activeCity(await loadCities(),{selectValue:$('#city-select')?.value||'',state:appState()});}

// Static catalogue mirror plus this device's own places: enough to warn before creating a duplicate, offline too.
async function knownPlaces(city){
 if(!catalogueByCity[city.id]){
  const url=city.id==='warsaw'?'./data/places.json':`./data/cities/${encodeURIComponent(city.id)}/places.json`;
  const r=await jsonOrNull(url);catalogueByCity[city.id]=Array.isArray(r?.data)?r.data.map(p=>({...p,source:'catalogue'})):[];
 }
 const mine=(appState()?.userPlaces||[]).filter(p=>(p.cityId||'warsaw')===city.id).map(p=>({...p,source:'mine'}));
 return [...catalogueByCity[city.id],...mine];
}

const formOf=()=>$('#place-form');
const ui=form=>({root:$('.pc',form),q:$('#pc-q',form),list:$('#pc-list',form),status:$('.pc-status',form),preview:$('.pc-preview',form),mapWrap:$('.pc-map-wrap',form)});

function status(form,text,kind=''){
 const box=ui(form).status;if(!box)return;box.textContent=text;box.dataset.kind=kind;
}

function closeList(form){
 const {list,q}=ui(form);if(!list)return;list.hidden=true;list.replaceChildren();q?.setAttribute('aria-expanded','false');q?.removeAttribute('aria-activedescendant');activeIndex=-1;options=[];
}

// Show only real, attributed images already held by City Route or returned from an
// authorized provider. Never guess a photo from a place name.
function optionPhoto(o){
 const photo=o.kind==='known'?o.place?.image:null;
 let src='';
 if(typeof photo==='string'&&/^(https:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(photo))src=photo;
 else if(typeof photo==='string'&&/^[a-z0-9_./-]+\.(?:jpg|jpeg|png|webp)$/i.test(photo))src='./assets/images/'+photo.replace(/^assets\/images\//,'');
 else if(o.kind==='provider'&&o.suggestion?.provider==='google'&&o.suggestion?.photo?.available&&/^[A-Za-z0-9_-]{10,300}$/.test(o.suggestion.placeId||''))src='/api/place-photo?id='+encodeURIComponent(o.suggestion.placeId);
 return src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'<span class="pc-opt-no-photo" aria-hidden="true">'+iconMarkup('camera')+'</span>';
}

function renderList(form,items){
 const {list,q}=ui(form);if(!list)return;
 options=items;activeIndex=-1;
 list.innerHTML=items.map((o,i)=>`<li id="pc-opt-${i}" role="option" aria-selected="false" data-pc-index="${i}" class="pc-opt pc-${o.kind}">
  <span class="pc-opt-thumb">${optionPhoto(o)}</span><span class="pc-opt-main"><strong>${esc(o.title)}</strong>${o.sub?`<small>${esc(o.sub)}</small>`:''}</span><span class="pc-src">${esc(o.badge||'')}</span></li>`).join('');
 list.hidden=!items.length;q.setAttribute('aria-expanded',String(!!items.length));
}

function setActive(form,i){
 const {list,q}=ui(form);if(!options.length)return;
 activeIndex=(i+options.length)%options.length;
 list.querySelectorAll('[role=option]').forEach((li,n)=>li.setAttribute('aria-selected',String(n===activeIndex)));
 q.setAttribute('aria-activedescendant',`pc-opt-${activeIndex}`);list.children[activeIndex]?.scrollIntoView?.({block:'nearest'});
}

const customOption=query=>({kind:'custom',title:`Nie ma tego miejsca? Dodaj „${query}”`,sub:'Wybierz punkt na mapie i zapisz.',badge:'',query});

async function suggest(form,query){
 const id=requests.next(),city=await currentCity();
 const local=catalogueMatches(query,await knownPlaces(city)).map(p=>({kind:'known',title:p.name,sub:p.source==='mine'?'Twoje miejsce · już zapisane':`Już w City Route${p.area?' · '+p.area:''}`,badge:SOURCE_LABEL[p.source],place:p}));
 if(!requests.isCurrent(id))return;
 renderList(form,local);
 clearTimeout(timer);controller?.abort();
 timer=setTimeout(async()=>{
  controller=new AbortController();status(form,`Szukam w: ${city.name}…`);
  let r=null;try{r=await jsonOrNull(`/api/place-suggest?q=${encodeURIComponent(query)}&${cityParams(city)}&session=${session}`,{signal:controller.signal,headers:{accept:'application/json'}});}catch{return;}
  if(!requests.isCurrent(id))return;
  const found=(r?.data?.suggestions||[]).filter(s=>!local.some(p=>p.place.name.toLowerCase()===String(s.name).toLowerCase())).map(s=>({kind:'provider',title:s.name,sub:[s.address,s.district].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' · '),badge:SOURCE_LABEL[s.provider]||'',suggestion:s}));
  renderList(form,[...local,...found,...(!local.length&&!found.length?[customOption(query)]:[])]);
  if(!r||!r.ok){renderList(form,[...local,customOption(query)]);status(form,'Wyszukiwanie online jest teraz niedostępne. Możesz dodać miejsce samodzielnie.','error');}
  else if(!found.length&&!local.length)status(form,`Nie znaleziono miejsca w ${city.name}. Wybierz „Dodaj własne miejsce”.`);
  else status(form,'');
 },SUGGEST_DELAY_MS);
}

function setCategory(form,cat){
 const select=$('select[name="cat"]',form);
 if(select&&[...select.options].some(option=>option.value===cat)){select.value=cat;select.dispatchEvent(new Event('change',{bubbles:true}));return;}
 const radio=$(`input[name="cat"][value="${cat}"]`,form);if(radio&&!radio.checked){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
}

// `where` is written without an input event: enhancements.js would otherwise re-run address geocoding on submit.
function writeLocation(form,location){
 const where=$('input[name="where"]',form);if(!where)return;
 where.value=location?formatCoords(location):'';
 if(location){form.dataset.placeResolved='1';form.dataset.pcWhere=where.value;if(where.value===staleWhere)staleWhere='';}else{delete form.dataset.placeResolved;delete form.dataset.pcWhere;}
}

// Forget the previous pick: its coordinates (only if the composer wrote them), preview, map and auto-filled name.
// Bumping `generation` also discards picks that are still resolving.
function resetSelection(form){
 selection=null;generation++;delete form.dataset.pcGooglePlaceId;
 const where=$('input[name="where"]',form),name=$('input[name="name"]',form);
 if(where&&(where.value===form.dataset.pcWhere||!where.value)){if(where.value)staleWhere=where.value;where.value='';delete form.dataset.placeResolved;delete form.dataset.pcWhere;}
 if(name?.dataset.pcAuto==='1'){name.value='';delete name.dataset.pcAuto;}
 clearProposal(form);renderPreview(form,null);hideMap(form);
}

function fillName(form,name){
 const input=$('input[name="name"]',form);if(!input||!name)return;
 if(!input.value.trim()||input.dataset.pcAuto==='1'){input.value=name.slice(0,60);input.dataset.pcAuto='1';}
}

async function choose(form,picked){
 const gen=generation,city=await currentCity();if(gen!==generation)return;
 const check=cityCheck(picked.location,city);
 if(picked.location&&!check.ok){
  selection=null;writeLocation(form,null);clearProposal(form);renderPreview(form,null);
  return status(form,`To miejsce jest ${check.km} km od centrum: ${city.name} (limit ${check.limit} km). Zmień miasto u góry albo wybierz inny wynik.`,'error');
 }
 const dup=picked.source==='catalogue'||picked.source==='mine'?null:findDuplicate(picked,await knownPlaces(city));
 if(gen!==generation)return;
 selection={...picked,query:normalizeQuery(lastQuery),category:picked.category||categoryFromTypes(picked.types||[],picked.name||''),dup};
 form.dataset.pcGooglePlaceId=/^[A-Za-z0-9_-]{10,300}$/.test(String(picked.placeId||''))?picked.placeId:'';
 if(picked.name)fillName(form,picked.name);
 setCategory(form,selection.category);
 writeLocation(form,picked.location||null);
 renderPreview(form,selection);
 proposePhoto(form,selection);
 if(picked.location&&picked.source!=='google')showMap(form,picked.location);
 const name=$('input[name="name"]',form);
 if(!picked.location)status(form,'Ustaw pinezkę na mapie albo wklej współrzędne do pola wyszukiwania.');
 else if(!name?.value.trim()){status(form,'Lokalizacja ustawiona. Dodaj jeszcze nazwę.','ok');name?.focus();}
 else status(form,'');
}

function renderPreview(form,sel){
 const {preview}=ui(form);if(!preview)return;
 if(!sel){preview.hidden=true;preview.replaceChildren();return;}
 const photo='<div class="pc-photo-slot" aria-live="polite"></div>';
 const dup=sel.dup?`<div class="pc-dup" role="alert"><p><strong>To chyba już jest: ${esc(sel.dup.place.name)}</strong> (${sel.dup.m} m stąd).</p><div class="pc-actions"><button type="button" data-action="place" data-id="${esc(sel.dup.place.id)}">Zobacz</button><button type="button" data-action="add" data-id="${esc(sel.dup.place.id)}">Dodaj do Mojej trasy</button></div></div>`:'';
 const where=sel.location?formatCoords(sel.location):'brak lokalizacji';
 preview.innerHTML=`${photo}<div class="pc-card"><p class="pc-name">${esc(sel.name||'Nowe miejsce')}</p>${sel.address?`<p class="pc-addr">${esc(sel.address)}</p>`:''}<p class="pc-meta">${esc(SOURCE_LABEL[sel.source]||'')} · ${esc(where)}</p>${sel.source==='google'&&sel.location?'<button type="button" class="pc-link" data-pc="adjust">Popraw pinezkę</button>':''}</div>${dup}`;
 preview.hidden=false;
 renderProposal(form);
}

// ---- Automatic photo proposal (P0 #1) ----
const proposalKey=sel=>sel?.location&&String(sel.name||'').trim().length>=3?[String(sel.name).trim().toLowerCase(),Number(sel.location.lat).toFixed(4),Number(sel.location.lng).toFixed(4),sel.placeId||''].join('|'):'';
const currentCandidate=()=>proposal?.candidates?.[proposal.index]||null;

const validGoogleId=id=>/^[A-Za-z0-9_-]{10,300}$/.test(String(id||''))?String(id):'';
function syncAccepted(form){
 const c=proposal?.accepted?currentCandidate():null,record=c?acceptedPhotoRecord(c):null;
 if(record)form.dataset.pcPhoto=JSON.stringify(record);else delete form.dataset.pcPhoto;
 // An accepted Google photo is not copied: the place keeps its Google id and shows the photo through the proxy.
 form.dataset.pcGooglePlaceId=validGoogleId(selection?.placeId)||acceptedGooglePlaceId(c);
}

function clearProposal(form){
 proposalController?.abort();proposalController=null;proposal=null;
 if(form)delete form.dataset.pcPhoto;
}

async function proposePhoto(form,sel){
 const key=proposalKey(sel);
 if(!key){clearProposal(form);return renderProposal(form);}
 if(proposal?.key===key)return renderProposal(form);
 clearProposal(form);
 const controller=new AbortController();proposalController=controller;
 proposal={key,status:'loading',candidates:[],index:0,accepted:false,autoSelected:false,skipped:false};renderProposal(form);
 const city=await currentCity();
 let result;
 try{result=await findPlacePhotoCandidates(sel,{city:city?.name||'',cityInfo:city,signal:controller.signal});}
 catch{if(controller.signal.aborted)return;result={status:'error',candidates:[]};}
 if(proposalController!==controller||proposal?.key!==key)return;
 const autoIndex=autoPhotoCandidateIndex(result.candidates);
 proposal={...proposal,status:result.status,candidates:result.candidates,index:Math.max(0,autoIndex),accepted:autoIndex>=0,autoSelected:autoIndex>=0};
 renderProposal(formOf()||form);
}

function creditLine(c){
 const author=c.source?`<a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${esc(c.author)}</a>`:esc(c.author);
 const license=c.licenseUrl?`<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a>`:esc(c.license);
 return c.via==='Google Maps'?`Zdjęcie: ${author} · Google Maps. Wyświetlamy je z Google, nie kopiujemy pliku.`:`Zdjęcie: ${author} · ${license} · ${esc(c.via)}`;
}

function renderProposal(form){
 const slot=form&&$('.pc-photo-slot',form);if(!slot)return;
 syncAccepted(form);
 if(!proposal){slot.replaceChildren();return;}
 const own='<button type="button" data-pc-photo="own">'+icon('image-plus')+'Dodaj własne</button>';
 if(proposal.status==='loading'){slot.innerHTML='<p class="pc-photo-state">'+icon('camera')+'Szukam zdjęcia tego miejsca…</p>';return;}
 if(proposal.status!=='ok'){
  slot.innerHTML=`<div class="pc-photo-empty"><p class="pc-photo-state">${icon('camera')}${proposal.status==='error'?'Nie udało się teraz sprawdzić zdjęć.':'Nie mamy pewnego zdjęcia tego miejsca.'}</p><div class="pc-photo-actions">${own}</div></div>`;return;
 }
 if(proposal.skipped){slot.innerHTML=`<div class="pc-photo-empty"><p class="pc-photo-state">${icon('camera')}Bez proponowanego zdjęcia.</p><div class="pc-photo-actions"><button type="button" data-pc-photo="undo">Pokaż propozycję</button>${own}</div></div>`;return;}
 const c=currentCandidate(),many=proposal.candidates.length>1,name=$('input[name="name"]',form)?.value.trim()||'to miejsce';
 slot.innerHTML=`<figure class="pc-photo${proposal.accepted?' is-accepted':''}">
  <img src="${esc(c.src)}" alt="Zdjęcie: ${esc(name)}" decoding="async" referrerpolicy="no-referrer">
  <figcaption><strong>${proposal.accepted?icon('check')+(proposal.autoSelected?'Zdjęcie wybrane automatycznie':'Zdjęcie wybrane'):'Proponowane zdjęcie'}</strong><span>${creditLine(c)}</span>${many?`<span class="pc-photo-count">${proposal.index+1} z ${proposal.candidates.length}</span>`:''}</figcaption>
 </figure>
 <div class="pc-photo-actions">${proposal.accepted
  ?`${many?'<button type="button" data-pc-photo="next">'+icon('shuffle')+'Inne</button>':''}<button type="button" data-pc-photo="skip">${icon('x')}Usuń</button>`
  :`<button type="button" class="primary" data-pc-photo="accept">${icon('check')}Użyj zdjęcia</button>${many?'<button type="button" data-pc-photo="next">'+icon('shuffle')+'Inne</button>':own}<button type="button" data-pc-photo="skip">${icon('x')}Pomiń</button>`}</div>
 ${proposal.accepted?'<p class="fine pc-photo-note">Jeśli dodasz własne zdjęcia, okładką będzie Twoje.</p>':''}`;
 slot.querySelector('img')?.addEventListener('error',()=>{
  if(!proposal||currentCandidate()!==c)return;
  proposal.candidates=proposal.candidates.filter(x=>x!==c);proposal.index=0;proposal.accepted=false;proposal.autoSelected=false;
  if(!proposal.candidates.length)proposal.status='none';
  renderProposal(formOf()||form);
 },{once:true});
}

function onProposalAction(form,action){
 if(!proposal)return;
 if(action==='own'){$('input[name="photo"]',form)?.click();return;}
 if(action==='accept'){proposal.accepted=true;proposal.autoSelected=false;proposal.skipped=false;}
 if(action==='next'&&proposal.candidates.length>1){proposal.index=(proposal.index+1)%proposal.candidates.length;proposal.accepted=false;proposal.autoSelected=false;}
 if(action==='skip'){proposal.accepted=false;proposal.autoSelected=false;proposal.skipped=true;}
 if(action==='undo')proposal.skipped=false;
 renderProposal(form);
}

function knownCard(form,place){
 const {preview}=ui(form);writeLocation(form,null);selection=null;clearProposal(form);
 preview.innerHTML=`<div class="pc-dup"><div class="pc-known-preview">${optionPhoto({kind:'known',place})}<p><strong>Już mamy to miejsce: ${esc(place.name)}</strong>${place.area?` · ${esc(place.area)}`:''}</p><div class="pc-actions"><button type="button" data-action="place" data-id="${esc(place.id)}">Zobacz</button><button type="button" class="primary" data-action="add" data-id="${esc(place.id)}">Dodaj do Mojej trasy</button></div></div>`;
 preview.hidden=false;hideMap(form);status(form,'Nie trzeba dodawać go drugi raz.','ok');
}

async function showMap(form,center){
 const {mapWrap}=ui(form);if(!mapWrap)return;
 mapWrap.hidden=false;
 const canvas=$('.pc-map',mapWrap);
 let L;try{L=await loadLeaflet();}catch{mapWrap.hidden=true;status(form,'Mapa się nie wczytała. Wklej współrzędne albo użyj swojej lokalizacji.','error');return;}
 if(!formOf()?.contains(canvas))return;
 if(!map||map.getContainer()!==canvas){
  map?.remove();
  map=L.map(canvas,{zoomControl:true,keyboard:true,attributionControl:true}).setView([center.lat,center.lng],16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  marker=L.marker([center.lat,center.lng],{draggable:true,keyboard:true,title:'Pinezka miejsca',alt:'Pinezka miejsca'}).addTo(map);
  marker.on('dragend',()=>movePin(form,marker.getLatLng()));
  map.on('click',e=>{marker.setLatLng(e.latlng);movePin(form,e.latlng);});
 }else{map.setView([center.lat,center.lng],Math.max(map.getZoom(),15));marker.setLatLng([center.lat,center.lng]);}
 setTimeout(()=>map?.invalidateSize(),50);
}

function hideMap(form){const {mapWrap}=ui(form);if(mapWrap)mapWrap.hidden=true;}

async function movePin(form,latlng){
 const location={lat:latlng.lat,lng:latlng.lng},city=await currentCity(),check=cityCheck(location,city);
 if(!check.ok)return status(form,`Pinezka jest poza miastem ${city.name} (${check.km} km od centrum).`,'error');
 selection={...(selection||{source:'pin',name:$('input[name="name"]',form)?.value||'',query:normalizeQuery(lastQuery)}),location,source:selection?.source==='google'?'google':'pin'};
 selection.dup=findDuplicate(selection,await knownPlaces(city));
 writeLocation(form,location);renderPreview(form,selection);
 proposePhoto(form,{...selection,name:$('input[name="name"]',form)?.value.trim()||selection.name});
 status(form,$('input[name="name"]',form)?.value.trim()?'':'Dodaj nazwę miejsca.','ok');
}

async function pick(form,option){
 closeList(form);
 if(option.kind==='known')return knownCard(form,option.place);
 if(option.kind==='custom'){
  const city=await currentCity();fillName(form,option.query);
  selection={source:'pin',name:option.query,query:normalizeQuery(lastQuery),category:categoryFromTypes([],option.query)};setCategory(form,selection.category);
  clearProposal(form);renderPreview(form,null);status(form,'Przesuń pinezkę na właściwe miejsce, wklej współrzędne albo użyj swojej lokalizacji.');
  return showMap(form,selection.location||city.center);
 }
 const s=option.suggestion;
 if(s.location)return choose(form,{...s,source:s.provider});
 status(form,'Pobieram lokalizację…');
 const gen=generation,city=await currentCity(),r=await jsonOrNull(`/api/place-details?id=${encodeURIComponent(s.placeId)}&${cityParams(city)}&session=${session}`);
 session=sessionToken();
 if(gen!==generation)return;
 if(r?.data?.status==='ok')return choose(form,{...r.data,source:'google'});
 fillName(form,s.name);
 if(r?.data?.status==='outside-city')return status(form,`Ten wynik leży poza miastem ${city.name}. Zmień miasto u góry albo wybierz inny.`,'error');
 status(form,'Nie udało się pobrać lokalizacji. Ustaw pinezkę na mapie.','error');showMap(form,city.center);
}

async function readMapsLink(form,link){
 const city=await currentCity(),id=requests.next();
 status(form,'Odczytuję link Google Maps…');
 const where=$('input[name="where"]',form);
 const r=await jsonOrNull(`/api/place-preview?url=${encodeURIComponent(link)}&${cityParams(city)}`);
 if(!requests.isCurrent(id))return;
 if(r?.data?.status==='ok')return choose(form,{...r.data,source:'maps-link',address:r.data.address||''});
 // Keep the link: app.js resolves it once more through /api/location on save.
 if(where){where.value=link;delete form.dataset.placeResolved;}
 status(form,'Nie udało się odczytać tego linku. Ustaw pinezkę na mapie albo wklej współrzędne.','error');
 showMap(form,city.center);
}

function onQuery(form,value){
 lastQuery=value;
 if(!keepsSelection(selection,value))resetSelection(form);
 const input=classifyInput(value);
 clearTimeout(timer);controller?.abort();requests.cancel();
 if(input.kind==='empty'||input.kind==='short'){closeList(form);status(form,input.kind==='short'?`Wpisz co najmniej ${MIN_QUERY} znaki.`:'');return;}
 if(input.kind==='maps'){closeList(form);return readMapsLink(form,input.value);}
 if(input.kind==='other-link'){closeList(form);return status(form,'To nie jest link Google Maps. Wklej link z Map albo wpisz nazwę.','error');}
 if(input.kind==='coords'){closeList(form);return choose(form,{source:'coords',location:input.location,name:''});}
 suggest(form,input.value);
}

const MARKUP=`<section class="pc" aria-label="Szybkie dodawanie miejsca">
 <label class="pc-label" for="pc-q">Znajdź miejsce</label>
 <div class="pc-field"><input id="pc-q" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pc-list" autocomplete="off" autocapitalize="sentences" enterkeyhint="search" maxlength="300" placeholder="Nazwa, adres, link Maps, współrzędne"></div>
 <ul id="pc-list" class="pc-list" role="listbox" aria-label="Podpowiedzi" hidden></ul>
 <p class="pc-status fine" role="status" aria-live="polite"></p>
 <div class="pc-preview" hidden></div>
 <div class="pc-map-wrap" hidden><div class="pc-map" role="application" aria-label="Mapa: przesuń pinezkę albo kliknij miejsce"></div><p class="fine">Przeciągnij pinezkę albo dotknij mapy.</p></div>
</section>`;

function relabel(form){
 const submit=$('button.primary.big',form);
 if(submit)for(const n of submit.childNodes)if(n.nodeType===3&&/Zapisz miejsce/.test(n.textContent))n.textContent='Dodaj miejsce';
 const vis={private:'Tylko dla mnie',public:'Zaproponuj społeczności'};
 for(const [value,text] of Object.entries(vis)){const span=$(`input[name="vis"][value="${value}"]`,form)?.nextElementSibling;if(span&&span.children.length===0)span.textContent=text;}
}

function decorate(){
 const form=formOf();if(!form||form.dataset.composer==='1')return;
 form.dataset.composer='1';form.classList.add('pc-form');
 form.insertAdjacentHTML('afterbegin',MARKUP);
 // Order for one-handed use: search, name, where, category, note, photo, visibility.
 const nameLabel=$('input[name="name"]',form)?.closest('label'),whereSet=$('input[name="where"]',form)?.closest('fieldset'),cat=$('select[name="cat"]',form)?.closest('label')||$('input[name="cat"]',form)?.closest('fieldset');
 const note=$('textarea[name="note"]',form)?.closest('label'),photo=$('input[name="photo"]',form)?.closest('label'),gallery=$('.place-photo-editor',form),vis=$('input[name="vis"]',form)?.closest('fieldset');
 const root=$('.pc',form);let after=root;
 for(const el of [nameLabel,whereSet,cat,note,photo,gallery,vis])if(el){after.after(el);after=el;}
 // The raw `where` field stays in the form as the value app.js saves; the search box above replaces it visually.
 if(whereSet){const legend=$('legend',whereSet),raw=$('input[name="where"]',whereSet)?.closest('label');if(legend)legend.textContent='Albo: jestem na miejscu';if(raw&&!raw.querySelector('input').value)raw.hidden=true;}
 relabel(form);
 // app.js re-renders the form (photo, location button); restore what the user already picked.
 const {q}=ui(form);
 if(lastQuery)q.value=lastQuery;
 else{const seeded=$('input[name="name"]',form)?.value.trim();if(seeded){lastQuery=seeded;q.value=seeded;}}
 if(selection){
  form.dataset.pcGooglePlaceId=/^[A-Za-z0-9_-]{10,300}$/.test(String(selection.placeId||''))?selection.placeId:'';
  renderPreview(form,selection);
  if(selection.location){writeLocation(form,selection.location);if(selection.source!=='google')showMap(form,selection.location);}
 }else{
  // app.js may re-render from a draft taken before the pick was dropped; never let those coordinates come back.
  const where=$('input[name="where"]',form);
  if(staleWhere&&where?.value===staleWhere){where.value='';delete form.dataset.placeResolved;where.closest('label').hidden=true;}
 }
}

window.addEventListener('hashchange',()=>{if(location.hash.slice(1).split('/')[0]!=='add-place'){selection=null;staleWhere='';lastQuery='';session=sessionToken();clearProposal(null);}});

// Runs before enhancements.js (window capture precedes document capture): a typed address that was not picked
// from the list goes to `where`, so the existing save-time address lookup still finds it.
window.addEventListener('submit',e=>{
 const form=e.target;if(form?.id!=='place-form')return;
 syncAccepted(form);
 const where=$('input[name="where"]',form),q=$('#pc-q',form),input=classifyInput(q?.value);
 if(where&&!where.value.trim()&&selection?.source==='pin'&&!selection.location){
  e.preventDefault();e.stopImmediatePropagation();status(form,'Najpierw dotknij mapy albo przeciągnij pinezkę na to miejsce.','error');return;
 }
 if(where&&!where.value.trim()&&(input.kind==='text'||input.kind==='maps')){where.value=input.value;delete form.dataset.placeResolved;where.closest('label').hidden=false;}
},true);

document.addEventListener('input',e=>{
 const form=e.target.closest?.('#place-form');if(!form)return;
 if(e.target.id==='pc-q')return onQuery(form,e.target.value);
 if(e.target.name==='name')delete e.target.dataset.pcAuto;
});

document.addEventListener('keydown',e=>{
 if(e.target.id!=='pc-q')return;const form=formOf();if(!form)return;
 if(e.key==='ArrowDown'&&options.length){e.preventDefault();setActive(form,activeIndex+1);}
 else if(e.key==='ArrowUp'&&options.length){e.preventDefault();setActive(form,activeIndex-1);}
 else if(e.key==='Enter'){e.preventDefault();const o=options[activeIndex>=0?activeIndex:0];if(o)pick(form,o);}
 else if(e.key==='Escape'){closeList(form);}
});

document.addEventListener('click',e=>{
 const form=e.target.closest?.('#place-form');if(!form)return;
 const opt=e.target.closest('[data-pc-index]');if(opt){e.preventDefault();return pick(form,options[Number(opt.dataset.pcIndex)]);}
 if(e.target.closest('[data-pc="adjust"]')&&selection?.location)showMap(form,selection.location);
 const photoAction=e.target.closest('[data-pc-photo]');if(photoAction){e.preventDefault();onProposalAction(form,photoAction.dataset.pcPhoto);}
});

const observer=new MutationObserver(decorate);
observer.observe(document.querySelector('#main')||document.documentElement,{subtree:true,childList:true});
decorate();
