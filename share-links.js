import {iconMarkup} from './ui-icons.js';
import {decodePlaceSnapshot,placeSnapshotUrl} from './place-share-model.js';
// SHARE-LINKS-116: stable HTTPS route paths; device-only drafts are not shareable.
export function routeShareUrl(kind,id,city,origin){
 const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
 const slug=/^[a-z0-9][a-z0-9_-]{0,119}$/i;
 if(typeof origin!=="string"||!/^https?:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(origin))return null;
 const base=origin.replace(/\/+$/,"");
 if(kind==="community"&&uuid.test(String(id)))return base+"/r/community/"+String(id).toLowerCase();
 if(kind==="editorial"&&slug.test(String(city))&&slug.test(String(id)))return base+"/r/editorial/"+String(city)+"/"+String(id);
 return null;
}

// Device-only drafts cannot have public City Route URLs, but their ordered stops can be shared as a Google Maps itinerary.
export function sharedMapsRouteUrl(raw){
 try{const u=new URL(raw);
  if(u.protocol!=='https:'||!['www.google.com','google.com','maps.google.com'].includes(u.hostname)||u.pathname!=='/maps/dir/'||u.searchParams.get('api')!=='1'||!u.searchParams.get('destination'))return null;
  return u.href;
 }catch{return null;}
}

export function placeShareUrl(id,city,origin){
 if(typeof origin!=='string'||!/^https?:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(origin))return null;
 if(!/^[a-z0-9][a-z0-9_.:-]{0,159}$/i.test(String(id))||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(String(city)))return null;
 return origin.replace(/\/+$/,'')+'/?shareCity='+encodeURIComponent(city)+'#places/'+encodeURIComponent(id);
}
function shareFallback(url,title,external=false,place=false,privatePlace=false){
 document.querySelector('dialog.route-share-dialog[open]')?.close();
 const dlg=document.createElement('dialog');dlg.className='social-dialog route-share-dialog';
 dlg.setAttribute('aria-labelledby','route-share-heading');
 const form=document.createElement('form');form.method='dialog';
 const head=document.createElement('div');head.className='route-share-head';
 const symbol=document.createElement('span');symbol.className='route-share-emblem';symbol.innerHTML=iconMarkup('route');
 const heading=document.createElement('h2');heading.id='route-share-heading';heading.textContent=place?'Udostępnij miejsce':external?'Udostępnij plan':'Udostępnij trasę';
 const lead=document.createElement('p');lead.textContent=privatePlace?'Udostępniasz tylko nazwę i pinezkę, bez notatek, zdjęć i ocen.':place?'Wyślij znajomym link do miejsca w City Route.':external?'Wyślij znajomym plan przystanków w Google Maps.':'Wyślij znajomym publiczną trasę City Route.';
 const headingText=document.createElement('div');headingText.append(heading,lead);head.append(symbol,headingText);
 const preview=document.createElement('div');preview.className='route-share-preview';
 const previewIcon=document.createElement('span');previewIcon.className='route-share-preview-icon';previewIcon.innerHTML=iconMarkup(external?'map':'route');
 const previewText=document.createElement('div');
 const previewLabel=document.createElement('strong');previewLabel.textContent=place?'Miejsce w City Route':external?'Plan w Google Maps':'Trasa w City Route';
 const previewTitle=document.createElement('span');previewTitle.textContent=title;
 const previewHost=document.createElement('small');previewHost.textContent=new URL(url).hostname;
 previewText.append(previewLabel,previewTitle,previewHost);preview.append(previewIcon,previewText);
 const status=document.createElement('p');status.className='route-share-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const actions=document.createElement('div');actions.className='route-share-choices';
 const button=(label,icon,className='')=>{const el=document.createElement('button');el.type='button';el.className='route-share-action '+className;
  el.innerHTML=iconMarkup(icon);const name=document.createElement('span');name.textContent=label;el.append(name);return el;};
 const copy=button('Kopiuj link','link','route-share-copy');
 const raw=document.createElement('details');raw.className='route-share-raw';
 const sum=document.createElement('summary');sum.textContent='Pokaż pełny adres';
 const field=document.createElement('input');field.type='url';field.readOnly=true;field.value=url;field.setAttribute('aria-label',place?'Pełny link do miejsca':'Pełny link do trasy');
 raw.append(sum,field);
 const copyLink=async()=>{
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
   else{raw.open=true;field.focus();field.select();if(!document.execCommand('copy'))throw Error('clipboard');}
   status.textContent='Link skopiowany. Możesz go wkleić w rozmowie.';copy.querySelector('span:last-child').textContent='Skopiowano';return true;
  }catch{
   raw.open=true;field.focus();field.select();status.textContent='Zaznaczony link możesz skopiować ręcznie.';return false;
  }
 };
 copy.addEventListener('click',()=>{void copyLink();});
 const native=button('Udostępnij przez aplikację','navigation','route-share-native');
 native.hidden=typeof navigator.share!=='function';
 native.addEventListener('click',async()=>{
  try{await navigator.share({title,text:place?'Odkryj miejsce w City Route':external?'Plan przystanków w Google Maps':'Odkryj trasę w City Route',url});dlg.close();}
  catch(error){if(error?.name!=='AbortError')status.textContent='Wybierz komunikator albo skopiuj link.';}
 });
 const whats=document.createElement('a');whats.className='route-share-action route-share-whatsapp';whats.target='_blank';whats.rel='noopener noreferrer';
 whats.href='https://wa.me/?text='+encodeURIComponent('Sprawdź '+(place?'miejsce ':external?'plan ':'trasę ')+title+(external?' w Google Maps':' w City Route')+': '+url);
 whats.innerHTML=iconMarkup('message-circle')+'<span>WhatsApp</span>';
 const externalAction=(label,icon,href)=>{
  const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.className='route-share-action route-share-secondary';
  a.innerHTML=iconMarkup(icon);const span=document.createElement('span');span.textContent=label;a.append(span);
  a.setAttribute('aria-label',label+' — skopiuj i wklej link');
  a.addEventListener('click',()=>{
   // Clipboard write is started inside the actual click, before navigating to the messenger.
   if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(url).catch(()=>{});
   raw.open=true;field.focus();field.select();status.textContent='Wklej link w rozmowie w '+label+'.';
  });return a;
 };
 const messenger=externalAction('Messenger','send','https://www.messenger.com/');
 const instagram=externalAction('Instagram','camera','https://www.instagram.com/direct/inbox/');
 const close=document.createElement('button');close.type='submit';close.className='route-share-close';
 close.innerHTML=iconMarkup('x')+'<span>Zamknij</span>';
 actions.append(native,whats,messenger,instagram,copy);
 form.append(head,preview,actions,status,raw,close);dlg.append(form);
 dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
}

async function useRouteShare(button){
 const kind=button.dataset.routeShare,id=button.dataset.routeRef,city=button.dataset.routeCity;
 const title=String(button.dataset.routeTitle||"Trasa City Route").slice(0,140),url=kind==="maps"?sharedMapsRouteUrl(button.dataset.routeUrl):routeShareUrl(kind,id,city,location.origin);
 if(!url){alert("Najpierw opublikuj trasę, aby udostępnić ją innym.");return;}
 // Always show explicit sharing destinations. The system sheet is still available inside the dialog.
 shareFallback(url,title,kind==="maps");
}

async function usePlaceShare(button){
 const id=button.dataset.placeShare,city=button.dataset.placeCity,title=String(button.dataset.placeTitle||'Miejsce City Route').slice(0,140);
 const token=button.dataset.placePayload||'',privatePlace=!!token,snapshot=privatePlace?decodePlaceSnapshot(token):null;
 const url=privatePlace&&snapshot?.cityId===city?placeSnapshotUrl(token,location.origin):privatePlace?null:placeShareUrl(id,city,location.origin);
 if(!url){alert('Nie można udostępnić miejsca bez nazwy i poprawnej lokalizacji.');return;}
 if(typeof navigator.share==='function'){
  try{await navigator.share({title,text:privatePlace?'Zobacz nazwę i lokalizację miejsca w City Route':'Odkryj miejsce w City Route',url});return;}
  catch(error){if(error?.name==='AbortError')return;}
 }
 shareFallback(url,title,false,true,privatePlace);
}

function installRouteShare(){
 if(typeof document==="undefined")return;
 document.addEventListener("click",event=>{
  const place=event.target.closest?.("[data-place-share]");if(place){event.preventDefault();event.stopPropagation();void usePlaceShare(place);return;}
  const button=event.target.closest?.("[data-route-share]");if(!button)return;
  event.preventDefault();event.stopPropagation();void useRouteShare(button);
 },true);
}
installRouteShare();
