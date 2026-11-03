import {readFile,writeFile} from 'node:fs/promises';

const appPath='app.js';
let app=await readFile(appPath,'utf8');

const replace=(from,to,label)=>{
 if(!app.includes(from))throw new Error(`Missing ${label}`);
 app=app.replace(from,to);
};

replace(
"const fresh=()=>({version:1,tester:{id:uuid(),nickname:'Explorer'},basket:[],events:[],session:null});",
"const fresh=()=>({version:1,tester:{id:uuid(),nickname:'Explorer'},basket:[],basketsByCity:{},events:[],session:null});",
'fresh state');

replace(
"state.cityId=state.cityId||DEFAULT_CITY_ID;",
"state.cityId=state.cityId||DEFAULT_CITY_ID;state.basketsByCity=state.basketsByCity&&typeof state.basketsByCity==='object'?state.basketsByCity:{};if(!state.basketsByCity[DEFAULT_CITY_ID]&&state.basket.length)state.basketsByCity[DEFAULT_CITY_ID]=[...state.basket];state.basket=[...(state.basketsByCity[state.cityId]||[])];",
'city state');

replace(
"function nav(){$('#me').innerHTML=avatar('sm');",
"function cityPicker(){const available=cities.filter(c=>['launch','next'].includes(c.status));return `<label class=\"city-select\"><span class=\"sr-only\">Wybierz miasto</span><span class=\"i\" style=\"--i:url(./assets/icons/ui/map-pin.svg)\" aria-hidden=\"true\"></span><select id=\"city-select\" aria-label=\"Wybierz miasto\" ${isLive()?'disabled':''}>${available.map(c=>`<option value=\"${esc(c.id)}\" ${c.id===city().id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`;}\nasync function switchCity(nextId){if(nextId===city().id)return;if(isLive())return toast('Najpierw zakończ aktywną trasę.');const next=cityById(cities,nextId);if(!next)return toast('To miasto nie jest jeszcze dostępne.');state.basketsByCity[city().id]=[...state.basket];state.cityId=next.id;activeCity=next;state.basket=[...(state.basketsByCity[next.id]||[])];generated=null;query='';cat='all';rcat='all';cuisine='all';const client=createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});const fallback=await loadCityFallback(next);const data=await loadCatalogueWithFallback({client,city:next,fallback});places=data.places;routes=data.routes;quests=next.id===DEFAULT_CITY_ID?forCity(withCityId(await fetchJson('./data/sidequests.json'),DEFAULT_CITY_ID),next.id):[];all=Object.fromEntries([...places,...quests,...forCity(state.userPlaces,next.id)].map(p=>[p.id,p]));state.basket=state.basket.filter(id=>all[id]);state.basketsByCity[next.id]=[...state.basket];document.documentElement.dataset.catalogueSource=data.source;document.title=`City Route · ${next.name}`;persist();location.hash='#plan';render();toast(`Przełączono na ${next.name}.`);}\nfunction nav(){$('#me').innerHTML=avatar('sm');",
'city picker');

replace(
"function connection(){$('#connection').textContent=!storageOK?'Zapis lokalny niedostępny. Wyeksportuj dane przed zamknięciem.':navigator.onLine?'':'Offline · zapisane trasy działają. Mapy i strony źródeł wymagają internetu.';}",
"async function fetchJson(path){const r=await fetch(path);if(!r.ok)throw Error(path);return r.json();}\nasync function loadCityFallback(targetCity){if(targetCity.id===DEFAULT_CITY_ID){const [p,r]=await Promise.all([fetchJson('./data/places.json'),fetchJson('./data/routes.json')]);return {places:forCity(withCityId(p,DEFAULT_CITY_ID),targetCity.id),routes:forCity(withCityId(r,DEFAULT_CITY_ID),targetCity.id)};}try{const [p,r]=await Promise.all([fetchJson(`./data/cities/${targetCity.id}/places.json`),fetchJson(`./data/cities/${targetCity.id}/routes.json`)]);return {places:withCityId(p,targetCity.id),routes:withCityId(r,targetCity.id)};}catch{return {places:[],routes:[]};}}\nfunction connection(){$('#connection').textContent=!storageOK?'Zapis lokalny niedostępny. Wyeksportuj dane przed zamknięciem.':navigator.onLine?'':'Offline · zapisane trasy działają. Mapy i strony źródeł wymagają internetu.';}",
'fallback helpers');

replace(
" [cities,taxonomy,staticPlaces,quests,staticRoutes]=await Promise.all(['cities','taxonomy','places','sidequests','routes'].map(async n=>{const r=await fetch(`./data/${n}.json`);if(!r.ok)throw Error(n);return r.json();}));",
" [cities,taxonomy,staticPlaces,quests,staticRoutes]=await Promise.all(['cities','taxonomy','places','sidequests','routes'].map(n=>fetchJson(`./data/${n}.json`)));",
'bootstrap fetch');

replace(
" const jsonCatalogue={places:forCity(withCityId(staticPlaces,DEFAULT_CITY_ID),activeCity.id),routes:forCity(withCityId(staticRoutes,DEFAULT_CITY_ID),activeCity.id)};",
" const jsonCatalogue=activeCity.id===DEFAULT_CITY_ID?{places:forCity(withCityId(staticPlaces,DEFAULT_CITY_ID),activeCity.id),routes:forCity(withCityId(staticRoutes,DEFAULT_CITY_ID),activeCity.id)}:await loadCityFallback(activeCity);",
'bootstrap fallback');

replace(
" all=Object.fromEntries([...places,...quests,...forCity(state.userPlaces,activeCity.id)].map(p=>[p.id,p]));state.basket=state.basket.filter(id=>all[id]);state.myRoutes=state.myRoutes.filter(r=>r.stops.every(id=>all[id]));",
" all=Object.fromEntries([...places,...quests,...forCity(state.userPlaces,activeCity.id)].map(p=>[p.id,p]));state.basket=[...(state.basketsByCity[activeCity.id]||state.basket||[])].filter(id=>all[id]);state.basketsByCity[activeCity.id]=[...state.basket];state.myRoutes=state.myRoutes.filter(r=>r.cityId!==activeCity.id||r.stops.every(id=>all[id]));",
'bootstrap basket');

replace(
" persist();render();connection();if('serviceWorker'in navigator)",
" document.title=`City Route · ${activeCity.name}`;persist();render();connection();if('serviceWorker'in navigator)",
'title');

replace(
"window.addEventListener('hashchange',()=>{",
"document.addEventListener('change',e=>{if(e.target?.id==='city-select'){switchCity(e.target.value).catch(error=>{console.error(error);toast('Nie udało się przełączyć miasta.');render();});}});\nwindow.addEventListener('hashchange',()=>{",
'city change listener');

// keep per-city basket in sync on every persistence.
replace(
"const persist=()=>{try{localStorage.setItem(key,JSON.stringify(state));}",
"const persist=()=>{try{if(state?.cityId){state.basketsByCity=state.basketsByCity||{};state.basketsByCity[state.cityId]=[...(state.basket||[])];}localStorage.setItem(key,JSON.stringify(state));}",
'persist basket');

// render selector into existing header city slot.
replace(
"function render(){nav();",
"function render(){const cityHost=document.querySelector('.city-host');if(cityHost)cityHost.innerHTML=cityPicker();nav();",
'render header');

await writeFile(appPath,app);

let html=await readFile('index.html','utf8');
html=html.replace('<span class="city"><span class="i" style="--i:url(./assets/icons/ui/map-pin.svg)" aria-hidden="true"></span>Warszawa</span>','<span class="city-host"><span class="city"><span class="i" style="--i:url(./assets/icons/ui/map-pin.svg)" aria-hidden="true"></span>Warszawa</span></span>');
html=html.replace('<title>City Route · Warszawa</title>','<title>City Route</title>');
html=html.replace('<p class="loading">Wczytujemy Warszawę…</p>','<p class="loading">Wczytujemy miasto…</p>');
await writeFile('index.html',html);

let css=await readFile('styles.css','utf8');
css += `\n.city-select{display:inline-flex;align-items:center;gap:5px;color:var(--muted)}.city-select .i{width:15px;height:15px}.city-select select{max-width:132px;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;padding:6px 20px 6px 0;cursor:pointer}.city-select select:disabled{cursor:default;opacity:.7}\n`;
await writeFile('styles.css',css);

let sw=await readFile('service-worker.js','utf8');
sw=sw.replace("const CACHE='city-route-v23';","const CACHE='city-route-v24';");
for(const file of ['./data/cities/krakow/places.json','./data/cities/krakow/routes.json']){
 if(!sw.includes(file))sw=sw.replace("'./data/rankings.json'",`'./data/rankings.json', '${file}'`);
}
await writeFile('service-worker.js',sw);

console.log('Applied multi-city selector cutover patch.');
