import {iconMarkup,iconNode} from './ui-icons.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let enriching=false,lastPreview='',lastDirectSearchAt=0;

const mapsInput=()=>document.querySelector('#place-form input[name="where"]');
const placeForm=()=>document.querySelector('#place-form');
const nameInput=()=>document.querySelector('#place-form input[name="name"]');
const isMaps=v=>/^https:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(v||'').trim());
const isCoords=v=>/^\s*[-+]?\d{1,2}(?:[.,]\d+)?\s*[,;]\s*[-+]?\d{1,3}(?:[.,]\d+)?\s*$/.test(String(v||''));
const isAddress=v=>{const s=String(v||'').trim();return s.length>=3&&!/^https?:\/\//i.test(s)&&!isCoords(s);};
const WARSAW={id:'warsaw',name:'Warszawa',country:'Polska',countryCode:'PL',locale:'pl-PL',center:{lat:52.2297,lng:21.0122},radiusKm:40};
const GEOCODE_CACHE='city-route-geocode-cache-v2';
let citiesPromise=null;

// Active city = the header picker, else the saved app state. Address lookups must never assume Warsaw.
async function activeCity(){
 citiesPromise=citiesPromise||fetch('./data/cities.json').then(r=>r.json()).catch(()=>[]);
 const list=Array.isArray(await citiesPromise)?await citiesPromise:[];
 let id=document.querySelector('#city-select')?.value;
 if(!id){try{id=JSON.parse(localStorage.getItem('city-route-v1')||'null')?.cityId;}catch{}}
 const c=list.find(x=>x.id===(id||'warsaw'));
 return c?.center?{id:c.id,name:c.name,country:c.country,countryCode:c.countryCode||'PL',locale:c.locale||'pl-PL',center:{lat:Number(c.center.lat),lng:Number(c.center.lng)},radiusKm:Number(c.radiusKm)||40}:WARSAW;
}
const cityQuery=city=>new URLSearchParams({city:city.id,name:city.name,country:city.countryCode||'PL',lat:String(city.center.lat),lng:String(city.center.lng),r:String(city.radiusKm)}).toString();

function decorateWhereInput(){
 const input=mapsInput(),label=input?.closest('label');if(!input||!label||label.dataset.addressReady==='1')return;
 for(const node of label.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent='albo wpisz adres, wklej link z Google Maps lub współrzędne';break;}}
 input.placeholder='Np. ulica i numer · link Maps · 52.23, 21.01';
 label.dataset.addressReady='1';
 const note=document.createElement('small');note.className='fine address-geocoder-note';note.innerHTML='Adres wyszukujemy dopiero po kliknięciu „Zapisz miejsce”. Geokodowanie adresu: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>.';label.append(note);
}

function status(text,kind='',provider=''){
 const form=placeForm();if(!form)return;
 let box=form.querySelector('.maps-import-status');
 if(!box){box=document.createElement('p');box.className='fine maps-import-status';const where=mapsInput()?.closest('label');(where||form).append(box);}
 box.classList.toggle('ok',kind==='ok');box.classList.toggle('error',kind==='error');box.replaceChildren(document.createTextNode(text));
 if(provider==='nominatim-osm'){
  box.append(document.createTextNode(' · '));const a=document.createElement('a');a.href='https://www.openstreetmap.org/copyright';a.target='_blank';a.rel='noopener noreferrer';a.textContent='© OpenStreetMap contributors';box.append(a);
 }
}

async function preview(url){
 const r=await fetch('/api/place-preview?url='+encodeURIComponent(url)+'&'+cityQuery(await activeCity()));
 const data=await r.json().catch(()=>({status:'unavailable'}));
 if(!r.ok||data.status!=='ok')throw new Error(data.status||'unavailable');
 return data;
}

function kmFromCenter(city,lat,lng){
 const c=city.center,rad=x=>x*Math.PI/180,R=6371,dLat=rad(lat-c.lat),dLng=rad(lng-c.lng);
 const a=Math.sin(dLat/2)**2+Math.cos(rad(c.lat))*Math.cos(rad(lat))*Math.sin(dLng/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}

function cacheRead(query){
 try{
  const all=JSON.parse(localStorage.getItem(GEOCODE_CACHE)||'{}'),item=all[query.toLowerCase()];
  if(item&&Date.now()-item.savedAt<7*864e5)return item.value;
 }catch{}
 return null;
}

function cacheWrite(query,value){
 try{
  const all=JSON.parse(localStorage.getItem(GEOCODE_CACHE)||'{}');
  all[query.toLowerCase()]={savedAt:Date.now(),value};
  const entries=Object.entries(all).sort((a,b)=>b[1].savedAt-a[1].savedAt).slice(0,40);
  localStorage.setItem(GEOCODE_CACHE,JSON.stringify(Object.fromEntries(entries)));
 }catch{}
}

async function throttleDirectSearch(){
 const waitMs=Math.max(0,1050-(Date.now()-lastDirectSearchAt));
 if(waitMs)await wait(waitMs);
 lastDirectSearchAt=Date.now();
}

const fold=s=>String(s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'');
function queryWithCity(query,city){
 const localName=city.id==='lisbon'?'Lisboa':city.name;
 const country=city.countryCode==='PT'?'Portugal':(city.country||'Polska');
 const hasName=[localName,city.name].some(name=>name&&fold(query).includes(fold(name)));
 return hasName?query:[query,localName,country].filter(Boolean).join(', ');
}
function viewbox(city){
 const dLat=city.radiusKm/111,dLng=city.radiusKm/(111*Math.cos(city.center.lat*Math.PI/180)),c=city.center;
 return [c.lng-dLng,c.lat+dLat,c.lng+dLng,c.lat-dLat].map(n=>n.toFixed(2)).join(',');
}

// Nominatim is called only on an explicit save, at most once per second, never as type-ahead.
async function nominatimOnce(query,city){
 await throttleDirectSearch();
 const u=new URL('https://nominatim.openstreetmap.org/search');
 u.searchParams.set('q',queryWithCity(query,city));
 u.searchParams.set('format','jsonv2');
 u.searchParams.set('limit','5');
 u.searchParams.set('countrycodes',String(city.countryCode||'PL').toLowerCase());
 u.searchParams.set('addressdetails','1');
 u.searchParams.set('accept-language',String(city.locale||'pl-PL').split('-')[0]);
 u.searchParams.set('viewbox',viewbox(city));
 const r=await fetch(u.href,{headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('geocoder-http-'+r.status);
 const rows=await r.json();
 for(const row of Array.isArray(rows)?rows:[]){
  const lat=Number(row.lat),lng=Number(row.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng)||kmFromCenter(city,lat,lng)>city.radiusKm)continue;
  return {status:'ok',provider:'nominatim-osm',location:{lat,lng},name:String(row.name||row.display_name?.split(',')[0]||''),address:String(row.display_name||''),types:[row.type,row.class].filter(Boolean)};
 }
 return null;
}

async function directAddressSearch(query,city){
 const cacheKey=`${city.id}|${query}`,cached=cacheRead(cacheKey);if(cached)return cached;
 const variants=[query];
 const parts=query.split(',').map(x=>x.trim()).filter(Boolean);
 if(parts.length>1&&/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]\s*\d/.test(parts.slice(1).join(' ')))variants.push(parts.slice(1).join(', '));
 for(const variant of [...new Set(variants)]){
  const found=await nominatimOnce(variant,city);if(found){cacheWrite(cacheKey,found);return found;}
 }
 throw new Error('not-found');
}

async function searchAddress(query,city){
 // Dynamic Worker APIs are unavailable on the current static hosting target.
 // Keep this attempt for a future Worker deployment, then fall back to a browser-safe, user-triggered lookup.
 try{
  const r=await fetch('/api/place-search?q='+encodeURIComponent(query)+'&'+cityQuery(city),{headers:{accept:'application/json'}});
  const type=r.headers.get('content-type')||'';
  if(type.includes('application/json')){
   const data=await r.json();if(r.ok&&data.status==='ok'&&data.location)return data;
  }
 }catch{}
 return directAddressSearch(query,city);
}

async function resolveAddress(query){
 const city=await activeCity();
 status(`Szukam tego adresu: ${city.name}…`);
 const data=await searchAddress(query,city),input=mapsInput(),name=nameInput();
 if(!input)throw new Error('form-gone');
 input.value=`${Number(data.location.lat).toFixed(6)}, ${Number(data.location.lng).toFixed(6)}`;
 input.dataset.originalAddress=query;
 if(data.name&&name&&!name.value.trim())name.value=data.name;
 const label=data.name||data.address||query,provider=data.provider==='google'?'Google Places':'OpenStreetMap';
 status(`Znaleziono: ${label} · ${provider}`,'ok',data.provider);
 return data;
}

// Google photos are never copied into the user's own photo field: Places content may be shown with attribution,
// not re-saved as City Route media. The quick composer (place-composer.js) shows a display-only preview instead.
async function enrich(url){
 if(!isMaps(url))return null;
 status('Odczytuję miejsce z Google Maps…');
 const data=await preview(url),name=nameInput();
 if(data.name&&name&&!name.value.trim())name.value=data.name;
 const bits=[];if(data.name)bits.push(`rozpoznano: ${data.name}`);
 status(bits.length?bits.join(' · '):'Lokalizacja rozpoznana.','ok');lastPreview=url;return data;
}

let timer;
document.addEventListener('input',e=>{
 if(!e.target.matches('#place-form input[name="where"]'))return;
 decorateWhereInput();
 const form=placeForm();if(form){delete form.dataset.placeResolved;delete form.dataset.mapsEnriched;}
 clearTimeout(timer);const value=e.target.value.trim();
 if(!isMaps(value))return;
 timer=setTimeout(()=>{if(value!==lastPreview)enrich(value).catch(()=>status('Link zapisany — pełne dane sprawdzimy przy zapisie.'));},650);
});

document.addEventListener('submit',async e=>{
 const form=e.target;if(form.id!=='place-form'||enriching)return;
 decorateWhereInput();
 if(form.dataset.placeResolved==='1'||form.dataset.mapsEnriched==='1')return;
 const input=form.querySelector('input[name="where"]'),value=input?.value.trim();
 if(isAddress(value)){
  e.preventDefault();e.stopImmediatePropagation();enriching=true;
  let ok=false;
  try{await resolveAddress(value);form.dataset.placeResolved='1';ok=true;}
  catch{status('Nie znalazłem tego adresu. Wpisz ulicę i numer z miastem albo użyj swojej lokalizacji.','error');}
  enriching=false;
  const current=placeForm();if(ok&&current){current.dataset.placeResolved='1';current.requestSubmit();}
  return;
 }
 if(!isMaps(value))return;
 e.preventDefault();e.stopImmediatePropagation();enriching=true;form.dataset.mapsEnriched='1';
 try{await enrich(value);}catch{status('Nie udało się automatycznie odczytać linku Maps. Wklej pełny link ze współrzędnymi albo wpisz zwykły adres.','error');}
 enriching=false;const current=placeForm();if(current){current.dataset.mapsEnriched='1';current.requestSubmit();}
},true);

// PLAN-UI-MOBILE-006: progressive disclosure for the mobile route planner.
const PLANNER_UI_STYLE_ID='planner-mobile-ui-006';
const plannerChoice=(form,name)=>form.querySelector(`input[name="${name}"]:checked`)?.nextElementSibling?.textContent?.trim()||'';

function plannerAdvancedSummary(form){
 const transport=plannerChoice(form,'transport');
 const start=plannerChoice(form,'start');
 const budget=plannerChoice(form,'budget');
 const food=plannerChoice(form,'food');
 const tourist=plannerChoice(form,'tourist');
 const offers=plannerChoice(form,'offers');
 const parts=[transport,start==='Stąd, gdzie jestem'?'Start tutaj':start==='Obojętnie'?'Start dowolny':start,budget];
 if(food&&food!=='Nie')parts.push(food);
 if(tourist&&tourist!=='Pół na pół')parts.push(tourist);
 if(offers==='Mogą być')parts.push('Oferty partnerów');
 return parts.filter(Boolean).join(' · ');
}

function ensurePlannerStyles(){
 if(document.getElementById(PLANNER_UI_STYLE_ID))return;
 const style=document.createElement('style');style.id=PLANNER_UI_STYLE_ID;style.textContent=`
 .planner-head-compact{margin-bottom:12px}.planner-head-compact h1{margin-bottom:5px}.planner-head-compact .lead{max-width:430px}.planner-head-compact .inline{display:inline-flex;margin-top:7px;font-size:13px}
 #build-form.planner-simple{gap:12px;max-width:640px}.planner-primary{display:grid;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}
 #build-form.planner-simple .planner-primary legend{font-size:15px;margin-bottom:8px}.planner-advanced{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden}
 .planner-advanced>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:9px 14px;cursor:pointer;list-style:none}.planner-advanced>summary::-webkit-details-marker{display:none}
 .planner-advanced>summary>span:first-child{display:grid;gap:1px;min-width:0}.planner-advanced>summary strong{font-size:14px}.planner-advanced>summary small{color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}.planner-chevron{font-size:18px;color:var(--muted);transition:transform .15s}.planner-advanced[open] .planner-chevron{transform:rotate(180deg)}
 .planner-advanced-body{display:grid;gap:14px;padding:2px 14px 14px;border-top:1px solid var(--line-2)}.planner-advanced-body fieldset{margin-top:12px!important}.planner-advanced-body .fine{margin:0}
 .planner-manual{margin-top:4px;background:transparent;border-style:dashed;color:var(--ink-2);justify-content:space-between;text-align:left}.planner-manual-copy{display:grid;gap:1px;flex:1}.planner-manual-copy strong{font-size:14px}.planner-manual-copy small{font-size:11px;color:var(--muted);font-weight:500}
 @media(max-width:520px){
  .planner-head-compact .kicker{font-size:11px}.planner-head-compact h1{font-size:27px}.planner-head-compact .lead{font-size:14px;line-height:1.4}
  #build-form.planner-simple{gap:10px}.planner-primary{padding:13px 13px 12px;gap:12px;border-radius:16px}
  .planner-primary .choice{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;margin-right:-13px;padding:1px 13px 4px 0;scrollbar-width:none}.planner-primary .choice::-webkit-scrollbar{display:none}.planner-primary .choice label{flex:none;scroll-snap-align:start}.planner-primary .choice span{min-height:40px;padding:7px 12px;font-size:13px}
  .planner-advanced>summary{min-height:55px;padding:8px 13px}.planner-advanced-body{padding:0 13px 13px;gap:12px}.planner-advanced-body .choice{gap:6px}.planner-advanced-body .choice span{min-height:40px;padding:7px 11px;font-size:13px}
  .planner-manual{min-height:50px;padding:8px 12px}.planner-manual-copy strong{font-size:13px}
 }
 `;document.head.append(style);
}

function updatePlannerSummary(form){
 const target=form?.querySelector('[data-planner-summary]');if(target)target.textContent=plannerAdvancedSummary(form);
}

function simplifyPlanner(){
 const form=document.querySelector('#build-form.planner');if(!form||form.dataset.mobileSimple==='1')return;
 const field=name=>form.querySelector(`input[name="${name}"]`)?.closest('fieldset');
 const time=field('time'),interests=field('interests');if(!time||!interests)return;
 ensurePlannerStyles();form.dataset.mobileSimple='1';form.classList.add('planner-simple');
 const head=document.querySelector('#main .page-head');if(head){head.classList.add('planner-head-compact');const h=head.querySelector('h1'),lead=head.querySelector('.lead'),ready=head.querySelector('a.inline');if(h)h.textContent='Ułóż trasę po swojemu.';if(lead)lead.textContent='Wybierz czas i klimat. Resztę możesz dopasować, jeśli chcesz.';if(ready)ready.innerHTML='Gotowe trasy'+iconMarkup('chevron-right','link-arrow');}
 const manual=form.previousElementSibling?.matches?.('a[href="#my-route"]')?form.previousElementSibling:null;
 if(manual){manual.classList.add('planner-manual');manual.replaceChildren();const copy=document.createElement('span');copy.className='planner-manual-copy';const strong=document.createElement('strong');strong.textContent='Wolę ułożyć trasę ręcznie';const small=document.createElement('small');small.textContent='Dodawaj i przesuwaj miejsca';copy.append(strong,small);const arrow=iconNode('chevron-right');manual.append(copy,arrow);form.insertAdjacentElement('afterend',manual);}
 const primary=document.createElement('section');primary.className='planner-primary';primary.setAttribute('aria-label','Najważniejsze ustawienia trasy');form.insertBefore(primary,form.firstChild);primary.append(time,interests);
 const details=document.createElement('details');details.className='planner-advanced';const summary=document.createElement('summary');summary.innerHTML='<span><strong>Dopasuj szczegóły</strong><small data-planner-summary></small></span><span class="planner-chevron" aria-hidden="true">'+iconMarkup('chevron-down')+'</span>';const body=document.createElement('div');body.className='planner-advanced-body';details.append(summary,body);
 for(const name of ['transport','coffee','start']){const fs=field(name);if(fs)body.append(fs);}
 const oldMore=form.querySelector('details.more');if(oldMore){for(const child of [...oldMore.children])if(child.tagName!=='SUMMARY')body.append(child);oldMore.remove();}
 const submit=form.querySelector('button.primary.big');form.insertBefore(details,submit||null);updatePlannerSummary(form);
}

document.addEventListener('change',e=>{const form=e.target.closest?.('#build-form.planner-simple');if(form)updatePlannerSummary(form);});

const observer=new MutationObserver(()=>{decorateWhereInput();simplifyPlanner();});
observer.observe(document.querySelector('#main')||document.documentElement,{subtree:true,childList:true});
decorateWhereInput();
simplifyPlanner();

// START-ORIGIN-AUTOCOMPLETE: suggestions are explicit coordinates in the selected city.
// Debounced requests use only free OSM/Photon. No Google autocomplete billing is triggered.
const originCache=new Map(),originEntries=new WeakMap();
let originTimer=null,originController=null,originRequest=0,originActiveIndex=-1;

const originNormalise=s=>String(s||'').replace(/\s+/g,' ').trim();
const originFold=s=>originNormalise(s).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const originInput=form=>form?.querySelector('#planner-origin-input');
const originList=form=>form?.querySelector('#planner-origin-options');
const originStatus=form=>form?.querySelector('.planner-origin-status');
const originIsCustom=form=>!!form?.querySelector('input[name="start"][value="custom"]:checked');
const originValid=(p,city)=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&
 kmFromCenter(city,Number(p.lat),Number(p.lng))<=city.radiusKm;
function originCancel(){
 originRequest++;
 clearTimeout(originTimer);originTimer=null;
 if(originController){originController.abort();originController=null;}
}
function originHideOptions(form){
 const list=originList(form),input=originInput(form);
 if(list){list.hidden=true;list.replaceChildren();}
 if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
 originActiveIndex=-1;originEntries.delete(form);
}
function originMessage(form,message){
 const node=originStatus(form);if(node)node.textContent=message;
}
function originReset(form,message='Wpisz co najmniej 3 znaki i wybierz miejsce z listy poniżej.'){
 if(!form)return;
 for(const key of ['originLat','originLng','originQuery','originCity','originConfirmed'])delete form.dataset[key];
 const chosen=form.querySelector('.planner-origin-selected');if(chosen)chosen.hidden=true;
 originHideOptions(form);originMessage(form,message);
}
function syncPlannerOrigin(form){
 const box=form?.querySelector('.planner-origin-fields');
 if(!box)return;
 const custom=originIsCustom(form);
 box.hidden=!custom;
 const input=originInput(form);if(input)input.disabled=!custom;
 if(!custom){originCancel();originReset(form);}
}
async function originLocalCatalogue(city){
 if(!originCache.has(city.id)){
  const paths=city.id==='warsaw'?['./data/places.json','./data/cities/warsaw/places.json']:
   ['./data/cities/'+city.id+'/places.json'];
  const loading=Promise.all(paths.map(path=>fetch(path).then(r=>r.ok?r.json():[]).catch(()=>[])))
   .then(parts=>parts.flat().filter(p=>originValid(p,city)))
   .catch(()=>[]);
  originCache.set(city.id,loading);
 }
 return originCache.get(city.id);
}
async function originLocalSuggestions(query,city){
 const catalogue=await originLocalCatalogue(city),needle=originFold(query);
 return catalogue.filter(p=>originFold(p.name).includes(needle)||originFold(p.area).includes(needle))
  .sort((a,b)=>Number(originFold(a.name).startsWith(needle))-Number(originFold(b.name).startsWith(needle))||
    String(a.name).localeCompare(String(b.name))).reverse().slice(0,7)
  .map(p=>({name:String(p.name),address:[p.area,city.name].filter(Boolean).join(', '),
    lat:Number(p.lat),lng:Number(p.lng),source:'city-catalogue'}));
}
async function originRemoteSuggestions(query,city,signal){
 // The Worker uses its cached Photon lookup, with Google forcibly disabled by source=osm.
 const api='/api/place-suggest?source=osm&q='+encodeURIComponent(query)+'&'+cityQuery(city);
 try{
  const response=await fetch(api,{signal,headers:{accept:'application/json'}});
  if(response.ok&&(response.headers.get('content-type')||'').includes('application/json')){
   const data=await response.json();
   if(data.status==='ok'||data.status==='not-found')return (data.suggestions||[]).map(p=>({
    name:String(p.name||p.address||''),address:String(p.address||''),lat:Number(p.location?.lat),lng:Number(p.location?.lng),source:'photon-osm'
   })).filter(p=>originValid(p,city));
  }
 }catch(error){if(signal.aborted)throw error;}
 // Some static deployments do not expose Worker routes. Fallback is public Photon,
 // never an unthrottled autocomplete request to Nominatim or Google Places.
 await throttleDirectSearch();
 if(signal.aborted)return [];
 const endpoint=new URL('https://photon.komoot.io/api/');
 const lat=city.center.lat,lng=city.center.lng,dl=city.radiusKm/111,
  dn=city.radiusKm/(111*Math.cos(lat*Math.PI/180));
 endpoint.searchParams.set('q',query);
 endpoint.searchParams.set('lat',String(lat));endpoint.searchParams.set('lon',String(lng));
 endpoint.searchParams.set('bbox',[lng-dn,lat-dl,lng+dn,lat+dl].map(x=>x.toFixed(5)).join(','));
 endpoint.searchParams.set('limit','8');endpoint.searchParams.set('lang','default');
 const r=await fetch(endpoint.href,{signal,headers:{accept:'application/json'}});
 if(!r.ok)throw Error('photon-'+r.status);
 const data=await r.json();
 return (Array.isArray(data.features)?data.features:[]).map(feature=>{
  const p=feature.properties||{},coords=feature.geometry?.coordinates||[],
   street=[p.street,p.housenumber].filter(Boolean).join(' '),
   name=p.name||street||p.city||'';
  return {name:String(name),address:[street!==name?street:'',p.district||p.locality||'',p.city||city.name].filter(Boolean).join(', '),
   lat:Number(coords[1]),lng:Number(coords[0]),source:'photon-osm'};
 }).filter(p=>p.name&&originValid(p,city));
}
function originMergeResults(first,second,city){
 const seen=new Set(),output=[];
 for(const entry of [...first,...second]){
  if(!originValid(entry,city))continue;
  const key=originFold(entry.name)+'|'+Number(entry.lat).toFixed(3)+'|'+Number(entry.lng).toFixed(3);
  if(seen.has(key))continue;
  seen.add(key);output.push(entry);
  if(output.length>=6)break;
 }
 return output;
}
function originRenderOptions(form,results){
 if(!form?.isConnected)return;
 const list=originList(form),input=originInput(form);
 if(!list||!input)return;
 originEntries.set(form,results);originActiveIndex=-1;
 list.replaceChildren();
 results.forEach((place,index)=>{
  const button=document.createElement('button');button.type='button';button.className='planner-origin-option';
  button.setAttribute('role','option');button.id='planner-origin-option-'+index;
  button.dataset.originIndex=String(index);button.setAttribute('aria-selected','false');
  const icon=document.createElement('span');icon.className='planner-origin-option-pin';icon.setAttribute('aria-hidden','true');icon.innerHTML=iconMarkup('map-pin');
  const copy=document.createElement('span');copy.className='planner-origin-option-copy';
  const title=document.createElement('strong');title.textContent=place.name;
  const sub=document.createElement('small');sub.textContent=place.address||'W wybranym mieście';
  copy.append(title,sub);button.append(icon,copy);list.append(button);
 });
 list.hidden=!results.length;input.setAttribute('aria-expanded',String(!!results.length));
 input.removeAttribute('aria-activedescendant');
}
function originMoveFocus(form,delta){
 const entries=originEntries.get(form)||[],input=originInput(form);
 if(!entries.length||originList(form)?.hidden)return;
 originActiveIndex=(originActiveIndex+delta+entries.length)%entries.length;
 for(const button of originList(form).querySelectorAll('[data-origin-index]')){
  const active=Number(button.dataset.originIndex)===originActiveIndex;
  button.setAttribute('aria-selected',String(active));
  if(active){input.setAttribute('aria-activedescendant',button.id);button.scrollIntoView({block:'nearest'});}
 }
}
function originChoose(form,index){
 const place=(originEntries.get(form)||[])[index],input=originInput(form);
 if(!place||!input||!originIsCustom(form))return;
 originCancel();
 input.value=place.name;
 Object.assign(form.dataset,{
  originLat:String(place.lat),originLng:String(place.lng),originQuery:originNormalise(input.value),
  originCity:form.querySelector('#city-select')?.value||document.querySelector('#city-select')?.value||'',
  originConfirmed:'1'
 });
 const selected=form.querySelector('.planner-origin-selected');
 if(selected){
  selected.querySelector('.planner-origin-selected-name').textContent=place.name;
  selected.querySelector('.planner-origin-selected-address').textContent=place.address;
  selected.hidden=false;
 }
 originHideOptions(form);
 originMessage(form,'Punkt startowy wybrany. Możesz ułożyć trasę albo zmienić miejsce.');
}
async function originSearch(form,query,token,controller){
 const input=originInput(form);
 if(!form.isConnected||!input)return;
 const city=await activeCity();
 if(token!==originRequest||!form.isConnected)return;
 const stillCurrent=()=>token===originRequest&&form.isConnected&&originIsCustom(form)&&
   originNormalise(input.value)===query&&(document.querySelector('#city-select')?.value||city.id)===city.id;
 const localPromise=originLocalSuggestions(query,city);
 const remotePromise=originRemoteSuggestions(query,city,controller.signal);
 let local=[];
 try{local=await localPromise;}catch{}
 if(!stillCurrent())return;
 originRenderOptions(form,originMergeResults(local,[],city));
 if(local.length)originMessage(form,'Wybierz miejsce z podpowiedzi lub wpisz dokładniejszą nazwę.');
 try{
  const remote=await remotePromise;
  if(!stillCurrent())return;
  const merged=originMergeResults(local,remote,city);
  originRenderOptions(form,merged);
  originMessage(form,merged.length?'Wybierz konkretny punkt z listy poniżej.':
   'Nie znaleziono miejsca. Doprecyzuj nazwę lub adres, np. ulica i numer.');
 }catch{
  if(!stillCurrent())return;
  originMessage(form,local.length?'Wybierz jedno z miejsc z katalogu miasta.':
   'Nie udało się pobrać podpowiedzi. Sprawdź połączenie lub wpisz pełniejszy adres.');
 }
}
document.addEventListener('change',e=>{
 if(e.target?.name==='start'&&e.target.closest('#build-form'))syncPlannerOrigin(e.target.closest('#build-form'));
});
document.addEventListener('input',e=>{
 if(e.target?.id!=='planner-origin-input')return;
 const form=e.target.closest('#build-form');
 originCancel();originReset(form);
 const query=originNormalise(e.target.value);
 if(!originIsCustom(form)||query.length<3)return;
 originMessage(form,'Szukamy miejsc pasujących do adresu…');
 const token=originRequest,controller=new AbortController();originController=controller;
 originTimer=setTimeout(()=>{void originSearch(form,query,token,controller);},500);
});
document.addEventListener('keydown',e=>{
 if(e.target?.id!=='planner-origin-input')return;
 const form=e.target.closest('#build-form'),options=originEntries.get(form)||[];
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  if(!options.length)return;
  e.preventDefault();originMoveFocus(form,e.key==='ArrowDown'?1:-1);
 }
 if(e.key==='Escape'){e.preventDefault();originHideOptions(form);}
 if(e.key==='Enter'){
  e.preventDefault();
  if(options.length)originChoose(form,originActiveIndex>=0?originActiveIndex:0);
  else originMessage(form,'Wybierz punkt z listy podpowiedzi, aby zatwierdzić dokładną lokalizację.');
 }
});
document.addEventListener('click',e=>{
 const choice=e.target.closest?.('[data-origin-index]');
 if(choice){
  const form=choice.closest('#build-form');originChoose(form,Number(choice.dataset.originIndex));return;
 }
 const change=e.target.closest?.('[data-origin-change]');
 if(change){
  const form=change.closest('#build-form'),input=originInput(form);
  originCancel();originReset(form);
  if(input){input.focus();input.select();}
  return;
 }
 const form=document.querySelector('#build-form'),box=form?.querySelector('.planner-origin-fields');
 if(box&&!box.contains(e.target))originHideOptions(form);
});
