// NAV-MYROUTE-001 — founder-approved A+B mobile navigation polish.
const nav=document.querySelector('#navigation');
const headerRight=document.querySelector('.top .right');
const toast=document.querySelector('#toast');

function ensureHeaderBooking(){
 if(!headerRight||headerRight.querySelector('[data-header-book]'))return;
 const link=document.createElement('a');
 link.href='#book';link.className='header-book';link.dataset.headerBook='';link.setAttribute('aria-label','Zarezerwuj');
 link.innerHTML='<span class="i" style="--i:url(./assets/icons/ui/ticket-percent.svg)" aria-hidden="true"></span><span>Zarezerwuj</span>';
 const profile=headerRight.querySelector('#me');headerRight.insertBefore(link,profile||null);
}

function enforceBottomNav(){
 if(!nav)return;
 const ids=['plan','routes','my-route','places'];
 for(const id of ids){const a=nav.querySelector(`a[href="#${id}"]`);if(a)nav.append(a);}
 nav.querySelector('a[href="#book"]')?.remove();
 const mine=nav.querySelector('a[href="#my-route"]');if(mine)mine.classList.add('my-route-primary');
}

function makeAddToastActionable(){
 if(!toast||toast.querySelector('[data-toast-my-route]'))return;
 const text=toast.textContent||'';
 if(!/^Dodano jako \d+\. przystanek/.test(text))return;
 const a=document.createElement('a');a.href='#my-route';a.dataset.toastMyRoute='';a.textContent='Zobacz trasę';
 toast.append(' · ',a);
}

ensureHeaderBooking();enforceBottomNav();makeAddToastActionable();
if(nav)new MutationObserver(enforceBottomNav).observe(nav,{childList:true});
if(toast)new MutationObserver(makeAddToastActionable).observe(toast,{childList:true,characterData:true,subtree:true});
