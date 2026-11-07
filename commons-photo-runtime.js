// PHOTO-COVERAGE-039: lazy free-photo fallback for exact nearby landmarks.
// A network result is never published as an application image without license + name checks.
// Paid Google/Tripadvisor photos remain handled independently by existing provider overlay.
import {findCommonsPhoto,commonsPhotoUrl} from './commons-photo-source.js';

const MAX_REQUESTS=48,MAX_PARALLEL=3,MAX_WAIT_MS=5500;
const cache=new Map(),queued=new Set(),tasks=[],observed=new WeakSet();
let active=0,total=0,scanScheduled=false;
const attr='[data-commons-photo]';
const keyFor=p=>[p.id,p.name,Number(p.lat).toFixed(5),Number(p.lng).toFixed(5)].join('|');
function readPlace(el){
 const p={id:el.dataset.commonsPhoto,name:el.dataset.commonsName,lat:Number(el.dataset.commonsLat),lng:Number(el.dataset.commonsLng)};
 return p.id&&p.name&&commonsPhotoUrl(p)?p:null;
}
function paint(el,photo){
 if(!el?.isConnected||!el.matches(attr)||!photo)return;
 const frame=document.createElement('span');frame.className='commons-photo';
 const image=document.createElement('img');
 image.src=photo.src;image.loading='lazy';image.decoding='async';
 image.alt='Zdjęcie: '+el.dataset.commonsName+'. Autor: '+photo.author+'. Licencja: '+photo.license;
 image.referrerPolicy='no-referrer';
 const caption=el.closest('button')?document.createElement('span'):document.createElement('a');
 caption.className='commons-photo-credit';
 caption.textContent=photo.license+' · '+photo.author;
 caption.title='Zdjęcie: '+photo.author+' · '+photo.license+' · Wikimedia Commons';
 if(caption instanceof HTMLAnchorElement){caption.href=photo.source;caption.target='_blank';caption.rel='noopener noreferrer';caption.setAttribute('aria-label','Źródło zdjęcia '+el.dataset.commonsName+': '+photo.author+', '+photo.license);}
 frame.append(image,caption);
 const original=el.cloneNode(true);
 image.addEventListener('error',()=>{if(frame.isConnected){const place=readPlace(original);if(place)cache.set(keyFor(place),null);frame.replaceWith(original);}}, {once:true});
 el.replaceWith(frame);
}
function paintMatches(key,photo){
 if(!photo)return;
 document.querySelectorAll(attr).forEach(el=>{
  const p=readPlace(el);if(p&&keyFor(p)===key)paint(el,photo);
 });
}
async function runTask({key,place}){
 const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),MAX_WAIT_MS);
 let result=null;
 try{result=await findCommonsPhoto(place,{signal:controller.signal});}catch{result=null;}
 finally{clearTimeout(stop);}
 cache.set(key,result);queued.delete(key);
 paintMatches(key,result);
}
function pump(){
 while(active<MAX_PARALLEL&&tasks.length&&total<MAX_REQUESTS){
  const work=tasks.shift();active++;total++;
  runTask(work).finally(()=>{active--;pump();});
 }
 if(total>=MAX_REQUESTS)tasks.length=0;
}
function discover(el){
 const place=readPlace(el);if(!place)return;
 const key=keyFor(place);
 if(cache.has(key)){paint(el,cache.get(key));return;}
 if(queued.has(key)||total>=MAX_REQUESTS)return;
 queued.add(key);tasks.push({key,place});pump();
}
const io='IntersectionObserver'in window?new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting){io.unobserve(entry.target);discover(entry.target);}
},{rootMargin:'160px',threshold:.01}):null;
function scan(){
 scanScheduled=false;
 document.querySelectorAll(attr).forEach(el=>{
  if(observed.has(el))return;
  observed.add(el);
  if(io)io.observe(el);else discover(el);
 });
}
function schedule(){
 if(scanScheduled)return;scanScheduled=true;
 setTimeout(scan,80);
}
const dom=new MutationObserver(schedule);
dom.observe(document.querySelector('#main')||document.body,{subtree:true,childList:true});
const dialog=document.querySelector('#place-dialog');
if(dialog)dom.observe(dialog,{subtree:true,childList:true});
window.addEventListener('hashchange',schedule);
schedule();
