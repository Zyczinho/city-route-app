const wait=ms=>new Promise(r=>setTimeout(r,ms));
let enriching=false,lastPreview='',lastDirectSearchAt=0;

const mapsInput=()=>document.querySelector('#place-form input[name="where"]');
const placeForm=()=>document.querySelector('#place-form');
const nameInput=()=>document.querySelector('#place-form input[name="name"]');
const photoInput=()=>document.querySelector('#place-form input[type="file"][name="photo"]');
const isMaps=v=>/^https:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(v||'').trim());
const isCoords=v=>/^\s*[-+]?\d{1,2}(?:[.,]\d+)?\s*[,;]\s*[-+]?\d{1,3}(?:[.,]\d+)?\s*$/.test(String(v||''));
const isAddress=v=>{const s=String(v||'').trim();return s.length>=3&&!/^https?:\/\//i.test(s)&&!isCoords(s);};
const WARSAW={lat:52.2297,lng:21.0122};
const GEOCODE_CACHE='city-route-geocode-cache-v1';

function decorateWhereInput(){
 const input=mapsInput(),label=input?.closest('label');if(!input||!label||label.dataset.addressReady==='1')return;
 for(const node of label.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent='albo wpisz adres, wklej link z Google Maps lub współrzędne';break;}}
 input.placeholder='Np. Francuska 3A, Warszawa · link Maps · 52.23, 21.01';
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
 const r=await fetch('/api/place-preview?url='+encodeURIComponent(url));
 const data=await r.json().catch(()=>({status:'unavailable'}));
 if(!r.ok||data.status!=='ok')throw new Error(data.status||'unavailable');
 return data;
}

function kmFromWarsaw(lat,lng){
 const rad=x=>x*Math.PI/180,R=6371,dLat=rad(lat-WARSAW.lat),dLng=rad(lng-WARSAW.lng);
 const a=Math.sin(dLat/2)**2+Math.cos(rad(WARSAW.lat))*Math.cos(rad(lat))*Math.sin(dLng/2)**2;
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

function queryWithWarsaw(query){return /warszaw|warsaw/i.test(query)?query:`${query}, Warszawa, Polska`;}

async function nominatimOnce(query){
 await throttleDirectSearch();
 const u=new URL('https://nominatim.openstreetmap.org/search');
 u.searchParams.set('q',queryWithWarsaw(query));
 u.searchParams.set('format','jsonv2');
 u.searchParams.set('limit','5');
 u.searchParams.set('countrycodes','pl');
 u.searchParams.set('addressdetails','1');
 u.searchParams.set('accept-language','pl');
 u.searchParams.set('viewbox','20.35,52.55,21.55,51.90');
 const r=await fetch(u.href,{headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('geocoder-http-'+r.status);
 const rows=await r.json();
 for(const row of Array.isArray(rows)?rows:[]){
  const lat=Number(row.lat),lng=Number(row.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng)||kmFromWarsaw(lat,lng)>40)continue;
  return {status:'ok',provider:'nominatim-osm',location:{lat,lng},name:String(row.name||row.display_name?.split(',')[0]||''),address:String(row.display_name||''),types:[row.type,row.class].filter(Boolean)};
 }
 return null;
}

async function directAddressSearch(query){
 const cached=cacheRead(query);if(cached)return cached;
 const variants=[query];
 const parts=query.split(',').map(x=>x.trim()).filter(Boolean);
 if(parts.length>1&&/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]\s*\d/.test(parts.slice(1).join(' ')))variants.push(parts.slice(1).join(', '));
 for(const variant of [...new Set(variants)]){
  const found=await nominatimOnce(variant);if(found){cacheWrite(query,found);return found;}
 }
 throw new Error('not-found');
}

async function searchAddress(query){
 // Dynamic Worker APIs are unavailable on the current static hosting target.
 // Keep this attempt for a future Worker deployment, then fall back to a browser-safe, user-triggered lookup.
 try{
  const r=await fetch('/api/place-search?q='+encodeURIComponent(query),{headers:{accept:'application/json'}});
  const type=r.headers.get('content-type')||'';
  if(type.includes('application/json')){
   const data=await r.json();if(r.ok&&data.status==='ok'&&data.location)return data;
  }
 }catch{}
 return directAddressSearch(query);
}

async function resolveAddress(query){
 status('Szukam tego adresu w Warszawie…');
 const data=await searchAddress(query),input=mapsInput(),name=nameInput();
 if(!input)throw new Error('form-gone');
 input.value=`${Number(data.location.lat).toFixed(6)}, ${Number(data.location.lng).toFixed(6)}`;
 input.dataset.originalAddress=query;
 if(data.name&&name&&!name.value.trim())name.value=data.name;
 const label=data.name||data.address||query,provider=data.provider==='google'?'Google Places':'OpenStreetMap';
 status(`Znaleziono: ${label} · ${provider}`,'ok',data.provider);
 return data;
}

async function attachPhoto(url){
 const input=photoInput();if(!input||input.files?.length)return false;
 const r=await fetch('/api/place-photo?url='+encodeURIComponent(url));if(!r.ok)return false;
 const blob=await r.blob();if(!blob.type.startsWith('image/'))return false;
 const file=new File([blob],'google-place.jpg',{type:blob.type||'image/jpeg'}),dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 for(let i=0;i<30;i++){await wait(100);const f=placeForm();if(f?.textContent.includes('Zdjęcie dodane'))return true;}
 return true;
}

async function enrich(url,{photo=false}={}){
 if(!isMaps(url))return null;
 status('Odczytuję miejsce z Google Maps…');
 const data=await preview(url),name=nameInput();
 if(data.name&&name&&!name.value.trim())name.value=data.name;
 if(photo&&data.photo?.available)await attachPhoto(url);
 const bits=[];if(data.name)bits.push(`rozpoznano: ${data.name}`);if(data.photo?.available)bits.push('zdjęcie dostępne');else if(data.photoEnabled===false)bits.push('zdjęcie wymaga podłączenia Google Places');
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
  catch{status('Nie znalazłem tego adresu. Wpisz ulicę i numer, np. „Francuska 3A, Warszawa”, albo użyj swojej lokalizacji.','error');}
  enriching=false;
  const current=placeForm();if(ok&&current){current.dataset.placeResolved='1';current.requestSubmit();}
  return;
 }
 if(!isMaps(value))return;
 e.preventDefault();e.stopImmediatePropagation();enriching=true;form.dataset.mapsEnriched='1';
 try{await enrich(value,{photo:true});}catch{status('Nie udało się automatycznie odczytać linku Maps. Wklej pełny link ze współrzędnymi albo wpisz zwykły adres.','error');}
 enriching=false;const current=placeForm();if(current){current.dataset.mapsEnriched='1';current.requestSubmit();}
},true);

const observer=new MutationObserver(()=>decorateWhereInput());
observer.observe(document.querySelector('#main')||document.documentElement,{subtree:true,childList:true});
decorateWhereInput();
