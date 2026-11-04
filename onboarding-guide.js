// ONBOARDING-MENU-050: a permanent guide explaining why, where, and how.
// Kept separate from app.js so it can grow without changing the router.
import {GUIDE_GROUPS,GUIDE_TOPIC_COUNT} from './onboarding-content.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const QUICK=[
 ['🧭','Ułóż trasę','Plan spaceru na Twój czas','#plan'],
 ['🗺️','Trasy','Gotowe spacery i inspiracje','#routes'],
 ['📍','Miejsca','Odkrywaj i zapisuj lokalizacje','#places'],
 ['🚶','Moja trasa','Twoje przystanki i nawigacja','#my-route'],
 ['👥','Społeczność','Odkrycia innych i znajomi','#routes/community'],
 ['🎟️','Zarezerwuj','Noclegi, bilety i stoliki','#book']
];
const textList=(items,tag)=>'<'+tag+'>'+items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</'+tag+'>';
const topic=(item)=>{
 const [name,where,why,steps,href,limit]=item;
 return '<article class="guide-feature" data-guide-topic>'+
  '<h3>'+esc(name)+'</h3>'+
  '<div class="guide-location"><strong>GDZIE TO JEST?</strong><span>'+esc(where)+'</span></div>'+
  '<p class="guide-feature-why">'+esc(why)+'</p>'+
  textList(steps,'ol')+
  (limit?'<p class="guide-limit"><strong>Ważne na etapie beta:</strong> '+esc(limit)+'</p>':'')+
  '<a class="guide-go" href="'+esc(href)+'">Przejdź do funkcji <span aria-hidden="true">→</span></a>'+
  '</article>';
};
const section=(group,index)=>
 '<details class="guide-group"'+(index===0?' open':'')+'>'+
 '<summary><span class="guide-group-emoji" aria-hidden="true">'+group.emoji+'</span>'+
 '<span>'+esc(group.title)+'<small>'+group.items.length+' funkcji</small></span>'+
 '<span class="guide-chevron" aria-hidden="true">⌄</span></summary>'+
 '<div class="guide-group-content">'+group.items.map(topic).join('')+'</div></details>';
export {GUIDE_TOPIC_COUNT};
export function guideView(){
 return '<section class="page-head guide-header">'+
  '<p class="kicker">City Route · pomoc zawsze pod ręką</p>'+
  '<h1>Poradnik City Route</h1>'+
  '<p class="lead">Dowiedz się <strong>po co</strong> jest dana funkcja, <strong>gdzie</strong> ją znaleźć i <strong>jak</strong> z niej skorzystać. Bez technicznego języka.</p></section>'+
  '<section class="guide-why" aria-label="Do czego służy City Route">'+
  '<h2>Po co jest City Route?</h2>'+
  '<p>To Twój przewodnik po mieście. Możesz <strong>znaleźć miejsce</strong>, <strong>ułożyć spacer</strong>, <strong>sprawdzić propozycje innych</strong> i <strong>zachować pomysły na później</strong> — we własnym mieście lub w podróży.</p>'+
  '<div class="guide-first-steps"><div><b>1</b><span>Wybierz miasto</span></div><div><b>2</b><span>Znajdź miejsca lub trasę</span></div><div><b>3</b><span>Dodaj przystanki i ruszaj</span></div></div></section>'+
  '<h2 class="h-sm">Gdzie mam kliknąć?</h2>'+
  '<nav class="menu start-guide-menu" aria-label="Najważniejsze funkcje City Route">'+
  QUICK.map(([emoji,name,desc,href])=>
   '<a class="help-row" href="'+href+'"><span class="guide-quick-emoji" aria-hidden="true">'+emoji+'</span><span><strong>'+name+'</strong><small>'+desc+'</small></span><span class="guide-arrow" aria-hidden="true">›</span></a>').join('')+
  '</nav>'+
  '<section class="guide-directory" aria-label="Instrukcje wszystkich funkcji">'+
  '<div class="guide-directory-heading"><div><p class="kicker">INSTRUKCJE KROK PO KROKU</p><h2>Wszystkie ważne funkcje</h2><p>Otwórz kategorię lub wyszukaj funkcję.</p></div><span class="guide-count">'+GUIDE_TOPIC_COUNT+' tematów</span></div>'+
  '<label class="guide-search-label" for="guide-search">Czego szukasz?</label>'+
  '<input id="guide-search" class="guide-search-input" type="search" placeholder="np. zapisz miejsce, znajomi, budżet…" autocomplete="off" aria-controls="guide-topics">'+
  '<p class="guide-search-result" role="status" aria-live="polite" data-guide-count hidden></p>'+
  '<div id="guide-topics" class="guide-topics">'+GUIDE_GROUPS.map(section).join('')+'</div></section>'+
  '<section class="guide-not-yet"><h2>Co jeszcze rozwijamy?</h2>'+
  '<p>City Route jest wersją beta. Pełna synchronizacja aktywności między urządzeniami, plany wielodniowe, godziny otwarcia wszystkich miejsc, obserwowanie twórców oraz wydarzenia organizowane przez odkrywców są nadal w przygotowaniu.</p>'+
  '<p>Widzisz błąd albo czegoś brakuje? Warto zgłosić go podczas testów — to pomaga nam ustalić priorytety.</p></section>';
}
export function filterGuide(root,query){
 if(!root)return 0;
 const val=String(query||'').trim().toLocaleLowerCase('pl-PL');
 let shown=0;
 root.querySelectorAll('.guide-group').forEach(group=>{
  let n=0;
  group.querySelectorAll('[data-guide-topic]').forEach(item=>{
   const match=!val||item.textContent.toLocaleLowerCase('pl-PL').includes(val);
   item.hidden=!match;
   if(match){n++;shown++;}
  });
  group.hidden=!!val&&n===0;
  if(val&&n)group.open=true;
 });
 const counter=root.querySelector('[data-guide-count]');
 if(counter){
  counter.hidden=!val;
  counter.textContent=shown?'Znaleziono: '+shown+' '+(shown===1?'temat':'tematów'):
   'Nie znaleziono tematu. Spróbuj innego słowa.';
 }
 return shown;
}
if(typeof document!=='undefined')document.addEventListener('input',e=>{
 if(e.target?.id!=='guide-search')return;
 filterGuide(document.getElementById('main'),e.target.value);
});