// Admin-only review of proposed locations. Server RPC checks app_admins for every action.
import {supabase,SUPABASE_URL} from '../supabase-client.js';
import {createPlaceContributionsClient,BUCKET,contributionError} from '../place-contributions-client.js';
const api=createPlaceContributionsClient({client:supabase});
const $=s=>document.querySelector(s),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
const names={pending:'Czekają',approved:'Zatwierdzone',rejected:'Odrzucone',merged:'Połączone'};
let city='warsaw',filter='pending',rows=[];
const status=s=>{$('#admin-status').textContent=s;};
const mapLink=r=>'https://www.google.com/maps?q='+encodeURIComponent(r.lat+','+r.lng);
const photoUrl=path=>path&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(path)?SUPABASE_URL+'/storage/v1/object/public/'+BUCKET+'/'+path:null;
function render(){
 $('#admin').innerHTML='<section class="page-head"><h1>Zgłoszenia miejsc</h1><p class="lead">Propozycje są prywatne do chwili zatwierdzenia. Odmów albo połącz duplikaty z istniejącymi miejscami.</p><p><a href="./index.html">Panel próśb</a></p></section>'+
 '<div class="admin-filters"><label>Miasto <select data-filter="city">'+[['warsaw','Warszawa'],['krakow','Kraków']].map(([v,t])=>'<option value="'+v+'" '+(v===city?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Status <select data-filter="status">'+[['pending','Czekające'],['approved','Zatwierdzone'],['rejected','Odrzucone'],['merged','Połączone'],['all','Wszystkie']].map(([v,t])=>'<option value="'+v+'" '+(v===filter?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'+
 '<p class="fine">'+rows.length+' wyników</p><div class="admin-list">'+(rows.length?rows.map(renderRow).join(''):'<p class="note">Brak zgłoszeń dla tych filtrów.</p>')+'</div>';
}
function renderRow(r){
 const image=photoUrl(r.image_path);
 return '<article class="admin-row" data-id="'+safe(r.id)+'"><div class="admin-main">'+
  '<h3>'+safe(r.name)+'</h3><p class="fine">'+safe(r.category_id)+' · '+safe(names[r.status]||r.status)+' · '+safe(new Date(r.created_at).toLocaleDateString('pl-PL'))+'</p>'+
  '<p>'+safe(r.description||'Bez opisu')+'</p><p><a href="'+safe(mapLink(r))+'" target="_blank" rel="noopener noreferrer">Otwórz współrzędne na mapie</a></p>'+
  (r.source_url?'<p><a href="'+safe(r.source_url)+'" target="_blank" rel="noopener noreferrer nofollow">Link źródłowy</a></p>':'')+
  (image?'<img src="'+safe(image)+'" alt="Zdjęcie zgłoszone przez autora" loading="lazy" style="width:180px;max-height:140px;object-fit:cover;border-radius:12px">':'')+
  (r.resolved_place_id?'<p class="fine">ID w katalogu: '+safe(r.resolved_place_id)+'</p>':'')+'</div>'+
  (r.status==='pending'?'<form class="admin-actions" data-review="'+safe(r.id)+'"><label>Decyzja<select name="action"><option value="approve">Zatwierdź</option><option value="merge">Połącz z istniejącym</option><option value="reject">Odrzuć</option></select></label>'+
  '<label>ID istniejącego miejsca (tylko dla połączenia)<input name="existing" placeholder="np. old-town"></label><button type="submit">Wykonaj</button></form>':'')+
  '</article>';
}
async function load(){
 const main=$('#admin');if(!main)return;
 try{rows=await api.reviewQueue(city,filter);render();status('Wczytano '+rows.length+' zgłoszeń.');}
 catch(err){const e=contributionError(err);main.innerHTML='<section class="page-head"><h1>Błąd bazy</h1><p class="note">Sprawdź, czy zastosowano migrację 014 ('+safe(e.code)+').</p></section>';}
}
async function start(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.user){$('#admin').innerHTML='<section class="page-head"><h1>Wymagane logowanie</h1><a href="../#profile">Przejdź do profilu</a></section>';return;}
 const {data,error}=await supabase.rpc('is_app_admin');
 if(error||data!==true){$('#admin').innerHTML='<section class="page-head"><h1>Brak uprawnień</h1><a href="../#places">Wróć do aplikacji</a></section>';return;}
 await load();
}
document.addEventListener('change',e=>{
 const x=e.target.closest?.('[data-filter]');if(!x)return;
 if(x.dataset.filter==='city')city=x.value;else filter=x.value;
 load();
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest?.('[data-review]');if(!form)return;
 e.preventDefault();
 const action=form.elements.action.value,existing=form.elements.existing.value.trim();
 if(action==='merge'&&!existing){status('Połączenie wymaga ID opublikowanego miejsca.');return;}
 if(!confirm('Potwierdzasz decyzję: '+action+'?'))return;
 const b=form.querySelector('button');b.disabled=true;
 try{
  const result=await api.review(form.dataset.review,action,existing||null);
  status('Decyzja zapisana. Wynik: '+result+'. Opublikowane miejsca będą widoczne po odświeżeniu katalogu.');
  await load();
 }catch(error){status('Błąd moderacji: '+contributionError(error).code);b.disabled=false;}
});
start().catch(error=>{console.error(error);$('#admin').textContent='Nie udało się uruchomić panelu.';});
