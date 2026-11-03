const STORAGE_KEY='city-route-v1';
const select=document.querySelector('#city-select');
const toast=document.querySelector('#toast');

function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{};}catch{return {};}}
function writeState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function notify(message){if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);}

if(select){
 try{
  const response=await fetch('./data/cities.json');
  if(!response.ok)throw new Error('cities');
  const cities=await response.json();
  const available=cities.filter(city=>['launch','next'].includes(city.status));
  const state=readState();
  const currentId=state.cityId||'warsaw';
  select.innerHTML=available.map(city=>`<option value="${city.id}">${city.name}${city.status==='next'?' · beta':''}</option>`).join('');
  if(available.some(city=>city.id===currentId))select.value=currentId;
  const current=available.find(city=>city.id===select.value)||available[0];
  if(current){
   document.title=`City Route · ${current.name}`;
   const meta=document.querySelector('meta[name="description"]');
   if(meta)meta.content=`Gotowe i własne trasy po ${current.name}. Miejsca, noclegi i odkrywanie miasta w jednym miejscu.`;
  }
  select.addEventListener('change',()=>{
   const nextId=select.value;
   const currentState=readState();
   const oldId=currentState.cityId||currentId;
   if(nextId===oldId)return;
   if(currentState.session&&!currentState.session.finished){
    select.value=oldId;
    notify('Najpierw zakończ aktywną trasę, potem zmień miasto.');
    return;
   }
   currentState.cityBaskets=currentState.cityBaskets&&typeof currentState.cityBaskets==='object'?currentState.cityBaskets:{};
   currentState.cityBaskets[oldId]=Array.isArray(currentState.basket)?currentState.basket:[];
   currentState.cityId=nextId;
   currentState.basket=Array.isArray(currentState.cityBaskets[nextId])?currentState.cityBaskets[nextId]:[];
   currentState.session=null;
   writeState(currentState);
   location.hash='#plan';
   location.reload();
  });
 }catch(error){
  select.hidden=true;
  console.error('city-selector',error);
 }
}
