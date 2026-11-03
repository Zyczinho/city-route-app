// NAV-MYROUTE-001 + UX-CLEANUP-007 — compact five-tab navigation.
const nav=document.querySelector('#navigation');
const headerRight=document.querySelector('.top .right');
const toast=document.querySelector('#toast');
const desiredNav=['#plan','#routes','#my-route','#routes/community','#places'];
let navSyncing=false;

function ensureHeaderBooking(){
 if(!headerRight)return null;
 let link=headerRight.querySelector('[data-header-book]');
 if(!link){
  link=document.createElement('a');
  link.href='#book';link.className='header-book';link.dataset.headerBook='';link.setAttribute('aria-label','Zarezerwuj');
  link.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/ticket-percent.svg)" aria-hidden="true"></span><span class="header-book-label">Zarezerwuj</span>';
  const profile=headerRight.querySelector('#me');headerRight.insertBefore(link,profile||null);
 }
 return link;
}

function ensureCommunityTab(){
 if(!nav)return null;
 let link=nav.querySelector('a[href="#routes/community"]');
 if(!link){
  link=document.createElement('a');link.href='#routes/community';link.dataset.communityTab='';link.setAttribute('aria-label','Społeczność');
  link.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/users.svg)" aria-hidden="true"></span><span>Społeczność</span>';
  nav.append(link);
 }
 return link;
}

function syncHeaderBooking(){
 const link=ensureHeaderBooking();if(!link)return;
 const active=(location.hash.split('/')[0]||'#plan')==='#book';
 link.classList.toggle('active',active);
 if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
}

function syncCommunityActive(){
 if(!nav)return;
 const hash=location.hash||'#plan';
 const active=hash.startsWith('#routes/community')||hash.startsWith('#community-route/')||hash.startsWith('#social-profile/');
 const community=ensureCommunityTab(),routes=nav.querySelector('a[href="#routes"]');
 if(active){routes?.classList.remove('active');routes?.removeAttribute('aria-current');community?.classList.add('active');community?.setAttribute('aria-current','page');}
 else{community?.classList.remove('active');community?.removeAttribute('aria-current');}
}

function enforceBottomNav(){
 if(!nav||navSyncing)return;
 navSyncing=true;
 try{
  const book=nav.querySelector('a[href="#book"]');book?.remove();
  ensureCommunityTab();
  for(const href of desiredNav){const a=nav.querySelector(`a[href="${href}"]`);if(a)nav.append(a);}
  nav.querySelector('a[href="#my-route"]')?.classList.add('my-route-primary');
  syncCommunityActive();
 }finally{navSyncing=false;}
}

function makeAddToastActionable(){
 if(!toast||toast.querySelector('[data-toast-my-route]'))return;
 const text=toast.textContent||'';
 if(!/^Dodano jako \d+\. przystanek/.test(text))return;
 const a=document.createElement('a');a.href='#my-route';a.dataset.toastMyRoute='';a.textContent='Zobacz trasę';
 toast.append(' · ',a);
}

function syncNavigation(){syncHeaderBooking();enforceBottomNav();syncCommunityActive();}
syncNavigation();makeAddToastActionable();
window.addEventListener('hashchange',()=>{syncNavigation();setTimeout(syncNavigation,120);});
if(nav)new MutationObserver(enforceBottomNav).observe(nav,{childList:true});
if(toast)new MutationObserver(makeAddToastActionable).observe(toast,{childList:true,characterData:true,subtree:true});
