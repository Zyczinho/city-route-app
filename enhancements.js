const wait=ms=>new Promise(r=>setTimeout(r,ms));
let enriching=false,lastPreview='';

const mapsInput=()=>document.querySelector('#place-form input[name="where"]');
const placeForm=()=>document.querySelector('#place-form');
const nameInput=()=>document.querySelector('#place-form input[name="name"]');
const photoInput=()=>document.querySelector('#place-form input[type="file"][name="photo"]');
const isMaps=v=>/^https:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(v||'').trim());

function status(text,kind=''){
 const form=placeForm();if(!form)return;
 let box=form.querySelector('.maps-import-status');
 if(!box){box=document.createElement('p');box.className='fine maps-import-status';const where=mapsInput()?.closest('label');(where||form).append(box);}
 box.classList.toggle('ok',kind==='ok');box.textContent=text;
}

async function preview(url){
 const r=await fetch('/api/place-preview?url='+encodeURIComponent(url));
 const data=await r.json().catch(()=>({status:'unavailable'}));
 if(!r.ok||data.status!=='ok')throw new Error(data.status||'unavailable');
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
 status(bits.length?bits.join(' · '):'Lokalizacja rozpoznana.', 'ok');lastPreview=url;return data;
}

let timer;
document.addEventListener('input',e=>{
 if(e.target.matches('#place-form input[name="where"]')){clearTimeout(timer);const url=e.target.value.trim();if(!isMaps(url))return;timer=setTimeout(()=>{if(url!==lastPreview)enrich(url).catch(()=>status('Link zapisany — pełne dane sprawdzimy przy zapisie.'));},650);}
});

document.addEventListener('submit',async e=>{
 const form=e.target;if(form.id!=='place-form'||form.dataset.mapsEnriched==='1'||enriching)return;
 const input=form.querySelector('input[name="where"]'),url=input?.value.trim();if(!isMaps(url))return;
 e.preventDefault();e.stopImmediatePropagation();enriching=true;form.dataset.mapsEnriched='1';
 try{await enrich(url,{photo:true});}catch{status('Nie udało się pobrać pełnych danych z Maps. Spróbujemy zapisać lokalizację standardową metodą.');}
 enriching=false;const current=placeForm();if(current){current.dataset.mapsEnriched='1';current.requestSubmit();}
},true);
