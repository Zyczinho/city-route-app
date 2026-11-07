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

function shareFallback(url,title){
 const dlg=document.createElement("dialog");dlg.className="social-dialog route-share-dialog";
 const form=document.createElement("form");form.method="dialog";
 const heading=document.createElement("h2");heading.textContent="Udostępnij trasę";
 const note=document.createElement("p");note.textContent=title;
 const field=document.createElement("input");field.type="url";field.readOnly=true;field.value=url;field.setAttribute("aria-label","Link do trasy");
 const actions=document.createElement("div");actions.className="route-share-choices";
 const copy=document.createElement("button");copy.type="button";copy.textContent="Kopiuj link";
 const whats=document.createElement("a");whats.className="button primary";whats.href="https://wa.me/?text="+encodeURIComponent("Sprawdź trasę "+title+" w City Route: "+url);whats.target="_blank";whats.rel="noopener noreferrer";whats.textContent="WhatsApp";
 const system=document.createElement("button");system.type="button";system.textContent="Udostępnij przez aplikację";system.hidden=typeof navigator.share!=="function";
 system.addEventListener("click",async()=>{try{await navigator.share({title,text:"Odkryj trasę w City Route",url});dlg.close();}catch(error){if(error?.name!=="AbortError")status.textContent="Wybierz komunikator lub skopiuj link."; }});
 const openWithCopy=(label,href)=>{const a=document.createElement("a");a.className="button";a.textContent=label+" (skopiuj i wklej)";a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.addEventListener("click",()=>{
  field.focus();field.select();if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(url).catch(()=>{});
  status.textContent="Link zaznaczony. Wklej go w rozmowie w "+label+".";
 });return a;};
 const messenger=openWithCopy("Messenger","https://www.messenger.com/");
 const instagram=openWithCopy("Instagram","https://www.instagram.com/direct/inbox/");
 const close=document.createElement("button");close.type="submit";close.textContent="Zamknij";
 const status=document.createElement("p");status.setAttribute("role","status");status.className="fine";
 copy.addEventListener("click",async()=>{try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
  else{field.focus();field.select();if(!document.execCommand("copy"))throw Error("clipboard");}
  status.textContent="Link skopiowany.";
 }catch{field.focus();field.select();status.textContent="Zaznaczony link możesz skopiować ręcznie."; }});
 actions.append(system,whats,messenger,instagram,copy,close);form.append(heading,note,field,actions,status);dlg.append(form);
 dlg.addEventListener("close",()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
}

async function useRouteShare(button){
 const kind=button.dataset.routeShare,id=button.dataset.routeRef,city=button.dataset.routeCity;
 const title=String(button.dataset.routeTitle||"Trasa City Route").slice(0,140),url=routeShareUrl(kind,id,city,location.origin);
 if(!url){alert("Najpierw opublikuj trasę, aby udostępnić ją innym.");return;}
 // Always show explicit sharing destinations. The system sheet is still available inside the dialog.
 shareFallback(url,title);
}

function installRouteShare(){
 if(typeof document==="undefined")return;
 document.addEventListener("click",event=>{
  const button=event.target.closest?.("[data-route-share]");if(!button)return;
  event.preventDefault();event.stopPropagation();void useRouteShare(button);
 },true);
}
installRouteShare();
