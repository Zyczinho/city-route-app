import {iconMarkup} from './ui-icons.js';
// COMMUNITY-HUB-023: lightweight in-section navigation, reusing existing social, group and chat modules.
// No extra data fetches and no duplicate message state.
const root=()=>document.querySelector('#main');
const links=[
 ['#routes/community','Trasy'],
 ['#routes/community/groups','Grupy'],
 ['#routes/community/chats','Czaty'],
 ['#routes/community/friends','Znajomi'],
 ['#social-saved-places','Zapisane']
];
// Five consistent, accessible Lucide tabs; the text remains visible at narrow widths.
const tabIcons=Object.freeze({
 '#routes/community':'route',
 '#routes/community/groups':'users',
 '#routes/community/chats':'message-circle',
 '#routes/community/friends':'user-round',
 '#social-saved-places':'bookmark'
});
const communityView=()=>{
 const hash=location.hash;
 if(hash==='#social-saved')return null; // The personal route archive belongs under Profil.
 if(hash==='#social-saved-places')return 'saved-places';
 if(hash.startsWith('#profile/community'))return 'groups';
 if(hash.startsWith('#routes/community')){
  if(hash.startsWith('#routes/community/notifications'))return 'notifications';
  if(hash.startsWith('#routes/community/chats')||hash.startsWith('#routes/community/chat/')||hash.startsWith('#routes/community/dm/'))return 'chats';
  if(hash.startsWith('#routes/community/friends'))return 'friends';
  if(hash.startsWith('#routes/community/groups')||hash.startsWith('#routes/community/group/'))return 'groups';
  return 'routes';
 }
 if(hash.startsWith('#community-route/')||hash.startsWith('#social-profile/'))return 'routes';
 return null;
};
const hrefForView={routes:'#routes/community',groups:'#routes/community/groups',chats:'#routes/community/chats',friends:'#routes/community/friends',saved:'#social-saved-places','saved-places':'#social-saved-places'};
let queued=false;

function updateNav(){
 const view=communityView(),main=root();
 if(!view||!main)return;
 let header=main.querySelector(':scope > [data-community-tabs]');
 if(!header){
  header=document.createElement('header');
  header.className='community-hub-header';
  header.dataset.communityTabs='1';
  header.innerHTML='<div class="community-hub-title"><h1>Społeczność</h1><p>Trasy, ludzie i wspólne odkrywanie miasta.</p></div><nav class="community-hub-links" aria-label="Sekcje społeczności">'+links.map(([href,label])=>'<a href="'+href+'">'+iconMarkup(tabIcons[href],'community-tab-icon')+'<span>'+label+'</span></a>').join('')+'</nav><nav class="community-saved-switch" data-saved-switch aria-label="Zapisane: wybierz rodzaj" hidden><a href="#social-saved">Trasy</a><a href="#social-saved-places">Miejsca</a></nav>';
  main.prepend(header);
 }
 for(const a of header.querySelectorAll('nav a')){
  const active=a.getAttribute('href')===hrefForView[view];
  a.classList.toggle('active',active);
  if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 }
 const saved=view==='saved'||view==='saved-places';
 const switcher=header.querySelector('[data-saved-switch]');
 if(switcher){
  switcher.hidden=!saved;
  for(const a of switcher.querySelectorAll('a')){
   const active=a.getAttribute('href')===(view==='saved-places'?'#social-saved-places':'#social-saved');
   a.classList.toggle('active',active);
   if(active&&saved)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
 }
 const feedTitle=main.querySelector('[data-social-feed] .section-head h2');
 if(view==='routes'&&feedTitle?.textContent==='Społeczność')feedTitle.textContent='Trasy odkrywców';
 // The older Saved routes screen marks the Routes tab active directly; correct it
 // after its asynchronous render so all four subviews share one main-nav parent.
 if(view==='saved'||view==='saved-places'){
  const community=document.querySelector('#navigation a[href="#routes/community"]');
  const routes=document.querySelector('#navigation a[href="#routes"]');
  routes?.classList.remove('active');routes?.removeAttribute('aria-current');
  community?.classList.add('active');community?.setAttribute('aria-current','page');
 }
}
function schedule(){
 if(queued)return;
 queued=true;
 queueMicrotask(()=>{queued=false;updateNav();});
}
window.addEventListener('hashchange',schedule);
new MutationObserver(schedule).observe(root()||document.documentElement,{subtree:true,childList:true});
schedule();
