import {readFile,writeFile} from 'node:fs/promises';

const replace=(text,from,to,label)=>{
  if(!text.includes(from))throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(from,to);
};

let app=await readFile('app.js','utf8');
app=replace(app,
"import {createRestRpcClient,loadCatalogueWithFallback} from './catalogue-client.js';\n",
"import {createRestRpcClient,loadCatalogueWithFallback} from './catalogue-client.js';\nimport {loadNearbyPlaces} from './nearby-client.js';\nimport {createMapView} from './map-view.js';\n",
'import map modules');
app=replace(app,
"let cities=[],taxonomy=null,activeCity=null,places=[],quests=[],routes=[],all={},cat='all',rcat='all',query='',cuisine='all',sort='default',pending=null,generated=null,editing=false,keepQuery=false,here=null,draft=null,bookTab=null,speaking=false,evScope='global',evWhen='week',evKind='all';const evCache={};\n",
"let cities=[],taxonomy=null,activeCity=null,places=[],quests=[],routes=[],all={},cat='all',rcat='all',query='',cuisine='all',sort='default',pending=null,generated=null,editing=false,keepQuery=false,here=null,draft=null,bookTab=null,speaking=false,evScope='global',evWhen='week',evKind='all';const evCache={};\nlet mapView=null,renderedPlaceList=[];\n",
'map runtime state');
app=replace(app,
" if(sort==='rating')list.sort((a,b)=>smoothedRating(b.ratings)-smoothedRating(a.ratings));if(sort==='count')list.sort((a,b)=>c(b).total-c(a).total);\n const cuisines=[...new Set(places.flatMap(p=>p.cuisine||[]))].sort((a,b)=>a.localeCompare(b,'pl'));\n return `${exploreSwitch('places')}<section class=\"page-head\"><p class=\"kicker\">Miejsca</p><h1>Co chcesz zobaczyć?</h1><p class=\"lead\">${catalog().length} ${plural(catalog().length,'miejsce','miejsca','miejsc')} do zobaczenia i zjedzenia, z ocenami z Google Maps i Tripadvisor w jednym wyniku. Noclegi i bilety są w zakładce Zarezerwuj.</p></section>${searchBox('Szukaj: zamek, kebab, park, Praga…')}${chips([...PLACE_CATS,['sidequests','Side questy','flag']],cat,'cat',true)}${cat==='sidequests'?'<p class=\"note\">Krótkie zadania przy konkretnych miejscach. Pomysły City Route — rekomendacje społeczności pojawią się później.</p>':''}<a class=\"add-place\" href=\"#add-place\">",
" if(sort==='rating')list.sort((a,b)=>smoothedRating(b.ratings)-smoothedRating(a.ratings));if(sort==='count')list.sort((a,b)=>c(b).total-c(a).total);\n renderedPlaceList=[...list];\n const cuisines=[...new Set(places.flatMap(p=>p.cuisine||[]))].sort((a,b)=>a.localeCompare(b,'pl'));\n return `${exploreSwitch('places')}<section class=\"page-head\"><p class=\"kicker\">Miejsca</p><h1>Co chcesz zobaczyć?</h1><p class=\"lead\">${catalog().length} ${plural(catalog().length,'miejsce','miejsca','miejsc')} do zobaczenia i zjedzenia, z ocenami z Google Maps i Tripadvisor w jednym wyniku. Noclegi i bilety są w zakładce Zarezerwuj.</p></section>${searchBox('Szukaj: zamek, kebab, park, Praga…')}${chips([...PLACE_CATS,['sidequests','Side questy','flag']],cat,'cat',true)}${cat==='sidequests'?'<p class=\"note\">Krótkie zadania przy konkretnych miejscach. Pomysły City Route — rekomendacje społeczności pojawią się później.</p>':''}${cat!=='sidequests'?'<div id=\"places-map\" class=\"places-map-shell\" aria-label=\"Mapa miejsc\"></div>':''}<a class=\"add-place\" href=\"#add-place\">",
'places map host');
const mount=`\nasync function mountPlacesMap(){\n const host=$('#places-map');if(!host)return;\n const base=[...renderedPlaceList],baseById=new Map(base.map(p=>[String(p.id),p]));\n const client=createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});\n let view;\n const syncNearby=async center=>{\n  if(mapView!==view)return;\n  if(!center){view.setPlaces(base);return;}\n  try{\n   const categoryIds=[...new Set(base.map(p=>p.categoryId).filter(Boolean))];\n   const rows=await loadNearbyPlaces(client,{city:city(),lat:center.lat,lng:center.lng,radiusM:500,maxResults:200,categoryIds});\n   if(mapView!==view)return;\n   const merged=rows.map(row=>{const full=baseById.get(String(row.id));return full?{...full,distanceM:row.distanceMeters}:null;}).filter(Boolean);\n   view.setPlaces(merged);\n  }catch{if(mapView===view)view.setPlaces(base);}\n };\n view=createMapView({\n  container:host,places:base,city:city(),\n  onAddToRoute:p=>{if(!state.basket.includes(p.id)){state.basket.push(p.id);log('add_to_route',{place_id:p.id,source:'map'});nav();toast('Dodano do Mojej trasy');}},\n  onDetails:p=>openPlace(p.id),\n  onNearbyChange:syncNearby,\n  isInRoute:p=>state.basket.includes(p.id)\n });\n mapView=view;\n}\n`;
app=replace(app,"\nfunction openPlace(id){",mount+"\nfunction openPlace(id){",'mount map function');
app=replace(app,
" $('#main').innerHTML=html;document.body.classList.toggle('is-live',isLive());}\n",
" mapView?.destroy();mapView=null;$('#main').innerHTML=html;document.body.classList.toggle('is-live',isLive());if(tab==='places')mountPlacesMap();}\n",
'render map lifecycle');
await writeFile('app.js',app);

let map=await readFile('map-view.js','utf8');
map=replace(map,
"  const {container,onSelect,onAddToRoute,onDetails,onViewportChange,isInRoute=()=>false}=opts;\n",
"  const {container,onSelect,onAddToRoute,onDetails,onViewportChange,onNearbyChange,isInRoute=()=>false}=opts;\n",
'nearby callback destructure');
map=replace(map,
"    setNearby(c){nearbyOn=!!c;nearbyCenter=c||null;nearbyBtn.setAttribute('aria-pressed',String(nearbyOn));render();\n      if(nearbyOn&&map)map.setView([c.lat,c.lng],16);},\n",
"    setNearby(c){nearbyOn=!!c;nearbyCenter=c||null;nearbyBtn.setAttribute('aria-pressed',String(nearbyOn));render();\n      if(nearbyOn&&map)map.setView([c.lat,c.lng],16);onNearbyChange?.(c||null);},\n",
'nearby callback invoke');
await writeFile('map-view.js',map);

let css=await readFile('map.css','utf8');
if(!css.includes('.places-map-shell'))css+='\n.places-map-shell{margin:12px 0 18px}\n';
await writeFile('map.css',css);

let index=await readFile('index.html','utf8');
index=replace(index,'<link rel="stylesheet" href="./styles.css"><link rel="stylesheet" href="./auth.css">','<link rel="stylesheet" href="./styles.css"><link rel="stylesheet" href="./map.css"><link rel="stylesheet" href="./auth.css">','map stylesheet');
await writeFile('index.html',index);

let build=await readFile('scripts/build.mjs','utf8');
build=replace(build,"'catalogue-client.js','enhancements.js'","'catalogue-client.js','nearby-client.js','map-view.js','map.css','enhancements.js'",'build assets');
await writeFile('scripts/build.mjs',build);

let sw=await readFile('service-worker.js','utf8');
sw=replace(sw,"const CACHE='city-route-v24';","const CACHE='city-route-v25';",'cache version');
sw=replace(sw,"'./catalogue-client.js', './supabase-config.js'","'./catalogue-client.js', './nearby-client.js', './map-view.js', './map.css', './supabase-config.js'",'cache map modules');
await writeFile('service-worker.js',sw);

let docs=await readFile('MAP_VIEW.md','utf8');
docs=replace(docs,"  onViewportChange: ({center, zoom, bounds}) => {},\n  isInRoute: place => false","  onViewportChange: ({center, zoom, bounds}) => {},\n  onNearbyChange: centerOrNull => {}, // optional hook for server-backed Nearby\n  isInRoute: place => false",'map docs callback');
await writeFile('MAP_VIEW.md',docs);

const test=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\n\nconst read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');\n\ntest('places runtime mounts map and server-backed Nearby with graceful fallback',async()=>{\n const app=await read('app.js');\n assert.match(app,/createMapView/);\n assert.match(app,/loadNearbyPlaces/);\n assert.match(app,/id=\\\"places-map\\\"/);\n assert.match(app,/distanceM:row\\.distanceMeters/);\n assert.match(app,/catch\\{if\\(mapView===view\\)view\\.setPlaces\\(base\\)/);\n assert.match(app,/mapView\\?\\.destroy\\(\\)/);\n});\n\ntest('map integration ships in build and service worker cache',async()=>{\n const [index,build,sw]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('service-worker.js')]);\n assert.match(index,/map\\.css/);\n for(const file of ['nearby-client.js','map-view.js','map.css']){assert.match(build,new RegExp(file.replace('.', '\\\\.')));assert.match(sw,new RegExp(file.replace('.', '\\\\.')));}\n assert.match(sw,/city-route-v25/);\n});\n\ntest('map view exposes nearby hook for PostGIS integration',async()=>{\n const map=await read('map-view.js');\n assert.match(map,/onNearbyChange/);\n assert.match(map,/onNearbyChange\\?\\.\\(c\\|\\|null\\)/);\n});\n`;
await writeFile('tests/map-integration.test.js',test);
console.log('Map integration patch applied.');
