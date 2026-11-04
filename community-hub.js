// COMMUNITY-HUB-023: lightweight in-section navigation, reusing existing social, group and chat modules.
// No extra data fetches and no duplicate message state.
const root=()=>document.querySelector('#main');
const links=[
 ['#routes/community','Trasy'],
 ['#routes/community/groups','Grupy'],
 ['#routes/community/chats','Czaty'],
 ['#social-saved','Zapisane']
];
const communityView=()=>{
 const hash=location.hash;
 if(hash==='#social-saved')return 'saved';
 if(hash.startsWith('#profile/community'))return 'groups';
 if(hash.startsWith('#routes/community')){
  if(hash.startsWith('#routes/community/chats')||hash.startsWith('#routes/community/chat/'))return 'chats';
  if(hash.startsWith('#routes/community/groups')||hash.startsWith('#routes/community/group/'))return 'groups';
  return 'routes';
 }
 if(hash.startsWith('#community-route/')||hash.startsWith('#social-profile/'))return 'routes';
 return null;
};
const hrefForView={routes:'#routes/community',groups:'#routes/community/groups',chats:'#routes/community/chats',saved:'#social-saved'};
let queued=false;

function updateNav(){
 const view=communityView(),main=root();
 if(!view||!main)return;
 let header=main.querySelector(':scope > [data-community-tabs]');
 if(!header){
  header=document.createElement('header');
  header.className='community-hub-header';
  header.dataset.communityTabs='1';
  header.innerHTML='<div class="community-hub-title"><h1>Społeczność</h1><p>Trasy, ludzie i wspólne odkrywanie miasta.</p></div><nav class="community-hub-links" aria-label="Sekcje społeczności">'+links.map(([href,label])=>'<a href="'+href+'">'+label+'</a>').join('')+'</nav>';
  main.prepend(header);
 }
 for(const a of header.querySelectorAll('nav a')){
  const active=a.getAttribute('href')===hrefForView[view];
  a.classList.toggle('active',active);
  if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 }
 const feedTitle=main.querySelector('[data-social-feed] .section-head h2');
 if(view==='routes'&&feedTitle?.textContent==='Społeczność')feedTitle.textContent='Trasy odkrywców';
 // The older Saved routes screen marks the Routes tab active directly; correct it
 // after its asynchronous render so all four subviews share one main-nav parent.
 if(view==='saved'){
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
