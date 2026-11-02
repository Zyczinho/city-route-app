const wait=ms=>new Promise(r=>setTimeout(r,ms));
let enriching=false,lastPreview='';

const mapsInput=()=>document.querySelector('#place-form input[name="where"]');
const placeForm=()=>document.querySelector('#place-form');
const nameInput=()=>document.querySelector('#place-form input[name="name"]');
const photoInput=()=>document.querySelector('#place-form input[type="file"][name="photo"]');
const isMaps=v=>/^https:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(v||'').trim());
const isCoords=v=>/^\s*[-+]?\d{1,2}(?:[.,]\d+)?\s*[,;]\s*[-+]?\d{1,3}(?:[.,]\d+)?\s*$/.test(String(v||''));
const isAddress=v=>{const s=String(v||'').trim();return s.length>=3&&!/^https?:\/\//i.test(s)&&!isCoords(s);};

function decorateWhereInput(){
 const input=mapsInput(),label=input?.closest('label');if(!input||!label||label.dataset.addressReady==='1')return;
 for(const node of label.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent='albo wpisz adres, wklej link z Google Maps lub współrzędne';break;}}
 input.placeholder='Np. Francuska 3A, Warszawa · link Maps · 52.23, 21.01';
 label.dataset.addressReady='1';
 const note=document.createElement('small');note.className='fine address-geocoder-note';note.innerHTML='Adres wyszukujemy dopiero po kliknięciu „Zapisz miejsce”. Fallback MVP: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> / Photon.';label.append(note);
}

function status(text,kind='',provider=''){
 const form=placeForm();if(!form)return;
 let box=form.querySelector('.maps-import-status');
 if(!box){box=document.createElement('p');box.className='fine maps-import-status';const where=mapsInput()?.closest('label');(where||form).append(box);}
 box.classList.toggle('ok',kind==='ok');box.classList.toggle('error',kind==='error');box.replaceChildren(document.createTextNode(text));
 if(provider==='photon-osm'){
  box.append(document.createTextNode(' · '));const a=document.createElement('a');a.href='https://www.openstreetmap.org/copyright';a.target='_blank';a.rel='noopener noreferrer';a.textContent='© OpenStreetMap contributors';box.append(a);
 }
}

async function preview(url){
 const r=await fetch('/api/place-preview?url='+encodeURIComponent(url));
 const data=await r.json().catch(()=>({status:'unavailable'}));
 if(!r.ok||data.status!=='ok')throw new Error(data.status||'unavailable');
 return data;
}

async function searchAddress(query){
 const r=await fetch('/api/place-search?q='+encodeURIComponent(query));
 const data=await r.json().catch(()=>({status:'unavailable'}));
 if(!r.ok||data.status!=='ok'||!data.location)throw new Error(data.status||'unavailable');
 return data;
}

async function resolveAddress(query){
 status('Szukam tego adresu w Warszawie…');
 const data=await searchAddress(query),input=mapsInput(),name=nameInput();
 if(!input)throw new Error('form-gone');
 input.value=`${Number(data.location.lat).toFixed(6)}, ${Number(data.location.lng).toFixed(6)}`;
 input.dataset.originalAddress=query;
 if(data.name&&name&&!name.value.trim())name.value=data.name;
 const label=data.name||data.address||query,provider=data.provider==='google'?'Google Places':'Photon / OpenStreetMap';
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
  catch{status('Nie znalazłem tego adresu. Dopisz nazwę lokalu i ulicę, np. „Tuk Tuk, Francuska 3A, Warszawa”, albo wklej link Google Maps.','error');}
  enriching=false;
  const current=placeForm();if(ok&&current){current.dataset.placeResolved='1';current.requestSubmit();}
  return;
 }
 if(!isMaps(value))return;
 e.preventDefault();e.stopImmediatePropagation();enriching=true;form.dataset.mapsEnriched='1';
 try{await enrich(value,{photo:true});}catch{status('Nie udało się pobrać pełnych danych z Maps. Spróbujemy zapisać lokalizację standardową metodą.');}
 enriching=false;const current=placeForm();if(current){current.dataset.mapsEnriched='1';current.requestSubmit();}
},true);

const observer=new MutationObserver(()=>decorateWhereInput());
observer.observe(document.querySelector('#main')||document.documentElement,{subtree:true,childList:true});
decorateWhereInput();
