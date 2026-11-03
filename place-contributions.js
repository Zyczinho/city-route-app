// Shared place workflow. Adds on top of the existing local-first composer.
// No private location leaves this device unless the user selected "Zaproponuj społeczności".
import {supabase} from './supabase-client.js';
import {createPlaceContributionsClient,contributionError} from './place-contributions-client.js';

const KEY='city-route-v1',api=createPlaceContributionsClient({client:supabase}),inFlight=new Set();
const $=s=>document.querySelector(s);
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}};
const stateFor=id=>read()?.userPlaces?.find(p=>p.id===id);
const announce=message=>{const t=$('#toast');if(t){t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500);}};
const patch=(id,value)=>window.dispatchEvent(new CustomEvent('cityroute:submission-updated',{detail:{placeId:id,patch:value}}));
const statusNames={pending:'Czeka na moderację',approved:'Zaakceptowane',merged:'Połączone z istniejącym miejscem',rejected:'Odrzucone',error:'Wymaga ponowienia',needs_login:'Zaloguj się, aby wysłać'};

async function syncMine(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.user)return [];
 let mine=[];try{mine=await api.mine();}catch{return [];}
 for(const p of read()?.userPlaces||[]){
  const s=p.submissionId?mine.find(r=>r.id===p.submissionId):null;
  if(s&&s.status!==p.submissionStatus)patch(p.id,{submissionStatus:s.status,resolvedPlaceId:s.resolvedPlaceId});
 }
 return mine;
}

async function submitLocal(placeId,{silent=false}={}){
 if(inFlight.has(placeId))return;
 const place=stateFor(placeId);if(!place||place.visibility!=='public')return;
 if(['approved','merged','rejected'].includes(place.submissionStatus)){if(!silent)announce(statusNames[place.submissionStatus]);return;}
 inFlight.add(placeId);
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user){patch(placeId,{submissionStatus:'needs_login'});if(!silent)announce('Miejsce zapisane prywatnie. Zaloguj się, aby zgłosić je społeczności.');return;}
  patch(placeId,{submissionStatus:'submitting'});
  let submissionId=place.submissionId;
  if(!submissionId){
   try{submissionId=await api.submit(place);}
   catch(error){
    const e=contributionError(error);
    if(e.code==='duplicate-pending'){
      const existing=(await api.mine()).find(s=>s.cityId===place.cityId&&s.name.toLowerCase()===place.name.toLowerCase()&&s.status==='pending');
      if(existing)submissionId=existing.id;
      else throw e;
    }else throw e;
   }
  }
  patch(placeId,{submissionId,submissionStatus:'pending'});
  let photoWarning='';
  if(place.image?.startsWith('data:')&&place.imageRightsConfirmed&&!place.photoUploaded){
   try{await api.uploadOwnPhoto(session.user.id,submissionId,place.image,true);patch(placeId,{photoUploaded:true});}
   catch(error){photoWarning=' Zdjęcia nie udało się przesłać; miejsce nadal czeka na moderację.';console.warn('City Route photo contribution:',contributionError(error).code);}
  }
  announce('Miejsce zgłoszone. Zobaczą je inni po zatwierdzeniu.'+photoWarning);
 }catch(error){
  const e=contributionError(error);
  patch(placeId,{submissionStatus:'error',submissionError:e.code});
  const msg=e.code==='duplicate-place'?'Takie miejsce już znajduje się w katalogu.':e.code==='rate-limited'?'Osiągnięto limit 10 propozycji na dobę.':e.code==='outside-city'?'Miejsce jest poza granicami wybranego miasta.':e.code==='network'?'Nie udało się teraz połączyć z bazą. Miejsce nadal jest zapisane na urządzeniu.':e.code==='duplicate-pending'?'Takie miejsce już czeka na zatwierdzenie.':'Nie udało się wysłać propozycji ('+e.code+').';
  announce(msg);
 }finally{inFlight.delete(placeId);}
}

window.addEventListener('cityroute:place-created',e=>{const placeId=e.detail?.placeId;if(placeId)submitLocal(placeId,{silent:false});});

document.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-community-submit]');
 if(!button)return;
 e.preventDefault();
 submitLocal(button.dataset.communitySubmit);
});

async function showMySubmissions(){
 if(location.hash!=='#profile')return;
 const {data:{session}}=await supabase.auth.getSession();
 const host=$('#main');if(!host)return;
 let section=host.querySelector('[data-contributions-section]');
 if(!section){section=document.createElement('section');section.dataset.contributionsSection='1';section.className='community-contributions';host.append(section);}
 if(!session?.user){
  section.innerHTML='<h2>Moje polecenia</h2><p class="fine">Zaloguj się, żeby wysyłać miejsca do wspólnej bazy i sprawdzać ich status.</p>';
  return;
 }
 const items=await syncMine();
 if(location.hash!=='#profile')return;
 section.innerHTML='<h2>Moje zgłoszenia miejsc</h2>'+
 (items.length?'<ul>'+items.map(p=>'<li><strong>'+safe(p.name)+'</strong> · '+safe(statusNames[p.status]||p.status)+(p.resolvedPlaceId?' · <span class="fine">Widoczne w katalogu po odświeżeniu</span>':'')+'</li>').join('')+'</ul>':'<p class="fine">Nie masz jeszcze zgłoszonych miejsc. Dodaj je w zakładce Miejsca.</p>');
}
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

window.addEventListener('hashchange',()=>{if(location.hash==='#profile')setTimeout(showMySubmissions,500);});
supabase.auth.onAuthStateChange((event,session)=>{
 if(session?.user&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'))setTimeout(()=>syncMine(),400);
 if(location.hash==='#profile')setTimeout(showMySubmissions,600);
});
if(location.hash==='#profile')setTimeout(showMySubmissions,600);
