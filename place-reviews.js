// Separate, unverified City Route review signal. External Google/Tripadvisor ratings
// remain untouched. The RPC is unavailable until hosted migration 016 is approved.
import {supabase} from './supabase-client.js';
import {iconMarkup} from './ui-icons.js';
import {createPlaceReviewsClient} from './place-reviews-client.js';
const api=createPlaceReviewsClient(supabase),root=()=>document.querySelector('#main');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const city=()=>document.querySelector('#city-select')?.value||JSON.parse(localStorage.getItem('city-route-v1')||'{}').cityId||'warsaw';
let scores=new Map(),loadedCity=null,loading=false,requestedCity=null,sortCityRoute=false,scheduled=false;
const fmt=n=>Number(n).toLocaleString('pl-PL',{maximumFractionDigits:2});
// Keep SVG nodes separate from text. MutationObserver then sees real rating updates only.
function labeledIcon(host,name,label){
 let text=host.querySelector('[data-ui-icon-label]');
 if(!text){
  host.replaceChildren();
  host.insertAdjacentHTML('afterbegin',iconMarkup(name));
  text=document.createElement('span');
  text.dataset.uiIconLabel='1';
  host.append(text);
 }
 if(text.textContent!==label)text.textContent=label;
}


async function loadScores(force=false){
 const key=city();if(loading||(!force&&loadedCity===key))return;
 loading=true;requestedCity=key;
 try{
  const data=await api.scores(key);
  if(requestedCity!==key)return;
  scores=data;loadedCity=key;
 }catch{scores=new Map();loadedCity=key;}
 finally{loading=false;update();}
}
function sortPlaces(){
 const host=root(),list=host?.querySelector('.place-list');if(!list||!sortCityRoute)return;
 const current=[...list.children],key=el=>el.querySelector('[data-action="place"]')?.dataset.id||'';
 const ordered=[...current].sort((a,b)=>{
  const ca=scores.get(key(a)),cb=scores.get(key(b));
  return (cb?.sortScore??-1)-(ca?.sortScore??-1)||(cb?.reviewCount??0)-(ca?.reviewCount??0);
 });
 if(ordered.some((el,i)=>el!==current[i]))ordered.forEach(el=>list.append(el));
}
function update(){
 const host=root();if(!host)return;
 const onPlaces=location.hash.split('/')[0]==='#places';
 const select=onPlaces?host.querySelector('#sort'):null;
 if(select&&scores.size){
  if(!select.querySelector('[data-cityroute-sort]')){
   const option=document.createElement('option');option.value='cityroute';option.textContent='Oceny City Route';option.dataset.cityrouteSort='1';select.append(option);
  }
  if(sortCityRoute)select.value='cityroute';
  sortPlaces();
 }
 for(const badge of document.querySelectorAll('[data-cityroute-ref]')){
  const metric=scores.get(badge.dataset.cityrouteRef);
  const txt=metric&&metric.reviewCount>0&&Number.isFinite(metric.average)
   ?'City Route '+fmt(metric.average)+'/5 · '+fmt(metric.reviewCount)+' ocen'
   :'City Route · Brak ocen';
  badge.classList.toggle('has-score',!!metric&&metric.reviewCount>0&&Number.isFinite(metric.average));
  labeledIcon(badge,'star',txt);
 }
 const dialog=document.querySelector('#place-dialog[open]'),ratingHost=dialog?.querySelector('.city-route-own-rating'),p=dialog?.querySelector('#place-review-form')?.dataset.id;
 if(ratingHost&&p){
  let global=ratingHost.querySelector('[data-cityroute-global]');
  const metric=scores.get(p);
  const text=metric?`Średnia społeczności: ${fmt(metric.average)} · ${fmt(metric.reviewCount)} ocen`:'Brak publicznych ocen City Route';
  if(!global){global=document.createElement('span');global.dataset.cityrouteGlobal='1';ratingHost.append(global);}
  labeledIcon(global,'star',text);
 }
 if(loadedCity!==city()&&!loading)loadScores();
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;update();});}
document.addEventListener('change',event=>{
 if(event.target.id==='sort'){sortCityRoute=event.target.value==='cityroute';setTimeout(update,0);}
},true);
window.addEventListener('cityroute:place-reviewed',async event=>{
 const d=event.detail||{},rating=Number(d.rating);
 if(!Number.isInteger(rating)||rating<1||rating>5||!d.placeId||!d.cityId)return;
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.user)return; // Local review remains available without sign-in.
 try{await api.rate(d.cityId,d.placeId,rating);await loadScores(true);}catch{/* Unavailable/unapproved local place: keep local rating. */}
});
window.addEventListener('hashchange',()=>{sortCityRoute=false;schedule();});
new MutationObserver(schedule).observe(root()||document.documentElement,{subtree:true,childList:true});
schedule();
