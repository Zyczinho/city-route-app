// PHOTO-PROVIDER-STATUS-161: avoid dozens of HTTP 404 Google thumbnails when paid photos are off.
const KEY='city-route-photo-providers-v1',TTL_MS=120000;
let off=false,scanScheduled=false;
try{
 const cached=JSON.parse(sessionStorage.getItem(KEY)||'null');
 if(cached&&Date.now()-cached.at<TTL_MS&&cached.googleThumbnails===false){off=true;globalThis.__cityRouteGoogleThumbs=false;}
}catch{}
function convertUnavailable(){
 scanScheduled=false;
 if(!off)return;
 document.querySelectorAll('img[data-thumb-for]').forEach(img=>{
  if(img.dataset.failed==='1')return;
  // Single delegated error handler replaces the img with a licensed Wikimedia Commons candidate tile.
  img.dispatchEvent(new Event('error'));
 });
}
function scheduleScan(){if(!off||scanScheduled)return;scanScheduled=true;queueMicrotask(convertUnavailable);}
async function checkPhotoProviders(){
 try{
  const response=await fetch('/api/photo-capabilities',{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)return;
  const caps=await response.json();
  if(typeof caps.googleThumbnails!=='boolean')return;
  globalThis.__cityRouteGoogleThumbs=caps.googleThumbnails;
  off=!caps.googleThumbnails;
  try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),googleThumbnails:caps.googleThumbnails}));}catch{}
  scheduleScan();
 }catch{/* Keep browser image fallback on offline and preview builds. */}
}
const root=document.querySelector('#main')||document.body;
new MutationObserver(scheduleScan).observe(root,{subtree:true,childList:true});
const sheet=document.querySelector('#place-dialog');if(sheet)new MutationObserver(scheduleScan).observe(sheet,{subtree:true,childList:true});
void checkPhotoProviders();scheduleScan();
