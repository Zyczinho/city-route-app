// Variant D: five intent-based tabs; all legacy deep links stay accessible.
// GitHub issue #146 / founder-approved navigation direction 2026-11-09.
const nav=document.querySelector('#navigation');
const headerRight=document.querySelector('.top .right');
const toast=document.querySelector('#toast');
const desiredNav=['#plan','#routes','#places','#routes/community','#profile'];
let navSyncing=false;

function ensureHeaderBooking(){
 if(!headerRight)return null;
 let link=headerRight.querySelector('[data-header-book]');
 if(!link){
  link=document.createElement('a');
  link.href='#book';link.className='header-book';link.dataset.headerBook='';
  link.setAttribute('aria-label','Zarezerwuj');
  link.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/ticket-percent.svg)" aria-hidden="true"></span><span class="header-book-label">Zarezerwuj</span>';
  const profile=headerRight.querySelector('#me');headerRight.insertBefore(link,profile||null);
 }
 return link;
}

function ensureCommunityTab(){
 if(!nav)return null;
 let link=nav.querySelector('a[href="#routes/community"]');
 if(!link){
  link=document.createElement('a');link.href='#routes/community';link.dataset.communityTab='';
  link.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/users.svg)" aria-hidden="true"></span><span>Społeczność</span>';
  link.setAttribute('aria-label','Społeczność');
  nav.append(link);
 }
 return link;
}

function ensureRouteBar(){
 if(!nav)return null;
 let bar=document.getElementById('active-route-bar');
 if(!bar){
  bar=document.createElement('a');bar.id='active-route-bar';bar.href='#my-route';
  bar.className='variant-d-active-route';bar.hidden=true;
  bar.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/navigation.svg)" aria-hidden="true"></span><span class="variant-d-route-label"></span><span class="i" style="--i:url(./assets/icons/ui/chevron-right.svg)" aria-hidden="true"></span>';
  nav.before(bar);
 }
 return bar;
}

function syncRouteBar(){
 const bar=ensureRouteBar();if(!bar)return;
 const count=Math.max(0,Number(document.body.dataset.routeStops)||0);
 const live=document.body.dataset.routeLive==='true';
 const finished=document.body.dataset.routeFinished==='true';
 const active=location.hash==='#my-route'||location.hash.startsWith('#my-route/');
 const show=(count>0||live||finished)&&!active;
 bar.hidden=!show;
 document.body.classList.toggle('has-variant-d-route-bar',show);
 if(!show)return;
 const label=bar.querySelector('.variant-d-route-label');
 label.textContent=live?'Trasa w toku · otwórz':finished?'Trasa ukończona · zobacz':`Moja trasa · ${count} ${count===1?'przystanek':[2,3,4].includes(count%10)&&![12,13,14].includes(count%100)?'przystanki':'przystanków'}`;
}

function syncActive(){
 const hash=location.hash||'#plan';
 let active='#plan';
 if(hash.startsWith('#routes/community')||hash.startsWith('#community-route/')||hash.startsWith('#social-profile/'))active='#routes/community';
 else if(hash.startsWith('#routes')||hash.startsWith('#route/')&&!hash.startsWith('#route/generated'))active='#routes';
 else if(hash.startsWith('#places')||hash==='#events'||hash.startsWith('#add-place')||hash==='#book')active='#places';
 else if(hash==='#profile'||hash.startsWith('#collections')||hash==='#sources'||hash==='#about'||hash.startsWith('#social-saved'))active='#profile';
 for(const link of nav?.querySelectorAll('a')||[]){
  const chosen=link.getAttribute('href')===active;
  link.classList.toggle('active',chosen);
  if(chosen)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 }
 const book=ensureHeaderBooking();
 book?.classList.toggle('active',hash==='#book');
 if(hash==='#book')book?.setAttribute('aria-current','page');else book?.removeAttribute('aria-current');
}

function enforceBottomNav(){
 if(!nav||navSyncing)return;
 navSyncing=true;
 try{
  ensureCommunityTab();
  const ordered=desiredNav.map(href=>nav.querySelector(`a[href="${href}"]`)).filter(Boolean);
  // Navigation is re-rendered by app.js, and we deliberately drop obsolete tabs,
  // never deleting their hash routes or guide/help functionality.
  if(ordered.length===desiredNav.length){
   const current=[...nav.children];
   if(current.length!==ordered.length||ordered.some((node,i)=>current[i]!==node))nav.replaceChildren(...ordered);
  }
  syncActive();syncRouteBar();
 }finally{navSyncing=false;}
}

function makeAddToastActionable(){
 if(!toast||toast.querySelector('[data-toast-my-route]'))return;
 if(!/^Dodano jako \d+\. przystanek/.test(toast.textContent||''))return;
 const a=document.createElement('a');a.href='#my-route';a.dataset.toastMyRoute='';
 a.textContent='Zobacz trasę';toast.append(' · ',a);
}

function syncNavigation(){enforceBottomNav();syncActive();syncRouteBar();}
syncNavigation();makeAddToastActionable();
window.addEventListener('cityroute:route-nav',syncNavigation);
window.addEventListener('hashchange',()=>{syncNavigation();setTimeout(syncNavigation,120);});
if(nav)new MutationObserver(enforceBottomNav).observe(nav,{childList:true});
if(toast)new MutationObserver(makeAddToastActionable).observe(toast,{childList:true,characterData:true,subtree:true});
