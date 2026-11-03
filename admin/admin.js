// Founder panel for catalogue requests (REQ-ADMIN-004). Isolated page: reuses the app's Supabase session from
// the same origin but none of app.js. Every action is re-checked by the server against app_admins.
import {supabase} from '../supabase-client.js';
import {createAdminRequestsClient,requestsToCsv,LIFECYCLE} from './admin-client.js';

const api=createAdminRequestsClient({client:supabase});
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS_PL={open:'Czeka',planned:'W planach',added:'Dodane',declined:'Nie dodamy'};
const KIND_PL={place:'Miejsce',category_gap:'Brak kategorii'};
const date=v=>v?new Date(v).toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}):'—';
const announce=t=>{$('#admin-status').textContent=t;};
let cities=[],categories=[],rows=[],filters={citySlug:'warsaw',kind:'',category:'',status:'active',sort:'popular'};

const select=(name,label,options,value)=>`<label>${label}<select data-filter="${name}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const catLabel=id=>categories.find(c=>c.id===id)?.label||id||'—';

function controls(){
  return `<form class="admin-filters" data-filters>
    ${select('citySlug','Miasto',cities.map(c=>[c.id,c.name]),filters.citySlug)}
    ${select('status','Status',[['active','Aktywne (czeka + w planach)'],['open','Czeka'],['planned','W planach'],['added','Dodane'],['declined','Nie dodamy'],['all','Wszystkie']],filters.status)}
    ${select('kind','Rodzaj',[['','Wszystkie'],['place','Konkretne miejsca'],['category_gap','Brakujące kategorie']],filters.kind)}
    ${select('category','Kategoria',[['','Wszystkie'],...categories.map(c=>[c.id,c.label])],filters.category)}
    ${select('sort','Sortuj',[['popular','Najwięcej wsparć'],['recent','Najwięcej w 30 dni'],['newest','Najnowsze']],filters.sort)}
    <button type="button" data-action="csv">Eksport CSV</button>
  </form>`;
}

function row(r,rank){
  return `<article class="admin-row" data-id="${esc(r.id)}">
    <div class="admin-rank" aria-label="Miejsce ${rank}">${rank}</div>
    <div class="admin-main">
      <h3>${esc(r.title)}</h3>
      <p class="muted">${esc(KIND_PL[r.kind]||r.kind)} · ${esc(catLabel(r.categoryId))} · utworzono ${esc(date(r.createdAt))}</p>
      ${r.note?`<p class="admin-note">${esc(r.note)}</p>`:''}
      ${r.sourceUrl?`<p class="admin-link"><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">${esc(r.sourceUrl)}</a></p>`:''}
    </div>
    <div class="admin-count"><strong>${r.supports}</strong><span>wsparć</span><small>${r.supports30d} w 30 dni · ostatnie ${esc(date(r.lastSupportedAt))}</small></div>
    <form class="admin-actions" data-status-form="${esc(r.id)}">
      <label>Status<select name="status">${LIFECYCLE.map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${STATUS_PL[s]}</option>`).join('')}</select></label>
      <label>ID dodanego miejsca<input name="place" value="${esc(r.resolvedPlaceId||'')}" placeholder="np. wawel-castle" autocomplete="off"></label>
      <button type="submit">Zapisz</button>
    </form>
  </article>`;
}

function renderList(){
  const host=$('[data-list]');if(!host)return;
  host.innerHTML=rows.length?rows.map((r,i)=>row(r,i+1)).join(''):'<div class="empty"><p>Brak próśb dla tych filtrów.</p></div>';
  $('[data-count]').textContent=`${rows.length} ${rows.length===1?'prośba':'próśb'}`;
}

async function load(){
  $('[data-list]').innerHTML='<p class="loading">Wczytuję…</p>';
  try{rows=await api.loadRequests({...filters,kind:filters.kind||null,category:filters.category||null});renderList();announce(`Wczytano ${rows.length} próśb.`);}
  catch(error){$('[data-list]').innerHTML=`<div class="empty"><p>Nie udało się wczytać próśb (${esc(error.code||'błąd')}).</p></div>`;}
}

function shell(){
  $('#admin').innerHTML=`<section class="page-head"><p class="kicker">Panel foundera</p><h1>Czego brakuje użytkownikom?</h1>
    <p class="lead">Prośby o miejsca i brakujące kategorie, uszeregowane według liczby unikalnych użytkowników. Bez danych o tym, kto prosił.</p></section>
    ${controls()}<p class="muted admin-meta" data-count></p><div class="admin-list" data-list></div>`;
}

function gate(html){$('#admin').innerHTML=`<section class="page-head"><p class="kicker">Panel foundera</p>${html}</section>`;}

async function start(){
  const [c,t]=await Promise.all([fetch('../data/cities.json').then(r=>r.json()),fetch('../data/taxonomy.json').then(r=>r.json())]);
  cities=c.filter(x=>['launch','next'].includes(x.status));filters.citySlug=cities[0]?.id||'warsaw';
  categories=t.groups.flatMap(g=>g.types.map(x=>({id:x.id,label:x.labelPl||x.id})));
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return gate('<h1>Zaloguj się</h1><p class="lead">Zaloguj się w aplikacji City Route, a potem wróć na tę stronę.</p><a class="button primary" href="../#profile">Przejdź do logowania</a>');
  if(!(await api.isAdmin()))return gate('<h1>Brak dostępu</h1><p class="lead">To konto nie jest na liście administratorów City Route.</p><a class="button" href="../#routes">Wróć do aplikacji</a>');
  shell();await load();
}

document.addEventListener('change',e=>{const f=e.target.closest?.('[data-filter]');if(f){filters[f.dataset.filter]=f.value;load();}});
document.addEventListener('click',e=>{
  if(!e.target.closest?.('[data-action="csv"]'))return;
  const blob=new Blob(['﻿'+requestsToCsv(rows)],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`city-route-prosby-${filters.citySlug}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
document.addEventListener('submit',async e=>{
  const form=e.target.closest?.('[data-status-form]');if(!form)return;e.preventDefault();
  const button=form.querySelector('button');button.disabled=true;
  const status=form.elements.status.value,place=form.elements.place.value;
  try{await api.setStatus(form.dataset.statusForm,status,place);announce(`Zapisano status: ${STATUS_PL[status]}.`);await load();}
  catch(error){announce(error.code==='place-required'?'Status „Dodane” wymaga ID miejsca z katalogu.':error.code==='unknown-place'?'Nie ma takiego opublikowanego miejsca w tym mieście.':`Nie udało się zapisać (${error.code||'błąd'}).`);alert($('#admin-status').textContent);button.disabled=false;}
});
supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')location.reload();});
start().catch(error=>{console.error(error);gate('<h1>Coś poszło nie tak</h1><p class="lead">Odśwież stronę albo spróbuj później.</p>');});
