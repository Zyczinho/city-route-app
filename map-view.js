import {iconMarkup} from './ui-icons.js';
// Interactive map for City Route places. Self-contained: the app passes places, the active city and callbacks;
// Leaflet + OpenStreetMap tiles load lazily here and any failure degrades to an accessible list of the same places.
import {distance} from './core.js';

export const NEARBY_RADIUS_M=500;
export const LEAFLET={
  version:'1.9.4',
  js:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  jsIntegrity:'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  css:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  cssIntegrity:'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
};
const TILES='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TILE_ERRORS_BEFORE_FALLBACK=8;

const GROUPS={
  sightseeing:['landmark','museum','gallery','architecture','religious_site','viewpoint','neighborhood','hidden_gem'],
  nature:['park','garden','waterfront','beach','walk'],
  food:['restaurant','cafe','breakfast','street_food','food_hall','bakery','dessert'],
  nightlife:['bar','pub','cocktail_bar','wine_bar','club','live_music'],
  stay:['hotel','hostel','apartment','guesthouse']
};
const GROUP_OF=Object.fromEntries(Object.entries(GROUPS).flatMap(([g,ids])=>ids.map(id=>[id,g])));
export const categoryGroup=categoryId=>GROUP_OF[categoryId]||'other';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coord=v=>v!=null&&v!==''&&Number.isFinite(Number(v));
const valid=p=>!!p&&coord(p.lat)&&coord(p.lng);
const fmtDistance=m=>m<1000?`${Math.round(m/10)*10} m`:`${(m/1000).toFixed(1).replace('.',',')} km`;

// Places within radius of center, nearest first, each with distanceM.
export function nearbyPlaces(places,center,radiusM=NEARBY_RADIUS_M){
  if(!valid(center))return [];
  return places.filter(valid).map(p=>({...p,distanceM:distance(center,p)*1000}))
    .filter(p=>p.distanceM<=radiusM).sort((a,b)=>a.distanceM-b.distanceM||String(a.id).localeCompare(String(b.id)));
}

// filter: {showPlaces?:boolean, categories?:string[], groups?:string[], nearby?:{lat,lng,radiusM?}};
// showPlaces:false leaves the map free of POIs until the visitor explicitly selects a category.
// Empty category/group arrays keep their previous "all" meaning for existing callers.
export function filterPlaces(places,filter={}){
  if(filter.showPlaces===false)return [];
  const cats=new Set(filter.categories||[]),groups=new Set(filter.groups||[]);
  let out=places.filter(valid).filter(p=>(!cats.size||cats.has(p.categoryId))&&(!groups.size||groups.has(categoryGroup(p.categoryId))));
  if(filter.nearby)out=nearbyPlaces(out,filter.nearby,filter.nearby.radiusM||NEARBY_RADIUS_M);
  return out;
}

export const placeLabel=p=>[p.name,p.area,p.distanceM!=null?fmtDistance(p.distanceM):null].filter(Boolean).join(', ');

export function boundsOf(places){
  const ps=places.filter(valid);if(!ps.length)return null;
  return [[Math.min(...ps.map(p=>+p.lat)),Math.min(...ps.map(p=>+p.lng))],[Math.max(...ps.map(p=>+p.lat)),Math.max(...ps.map(p=>+p.lng))]];
}

export function cardHtml(p,{inRoute=false}={}){
  return `<div class="cr-map-card-head"><p class="kicker">${esc([p.area,p.distanceM!=null?fmtDistance(p.distanceM):''].filter(Boolean).join(' · '))}</p>`+
    `<h3 id="cr-map-card-title">${esc(p.name)}</h3></div>`+
    (p.description?`<p class="cr-map-card-text">${esc(p.description)}</p>`:'')+
    `<div class="cr-map-card-actions"><button type="button" class="primary" data-map-action="add" data-id="${esc(p.id)}"${inRoute?' disabled':''}>${inRoute?'W trasie':'Dodaj do trasy'}</button>`+
    `<button type="button" data-map-action="details" data-id="${esc(p.id)}">Szczegóły</button>`+
    `<button type="button" class="cr-map-card-close" data-map-action="close" aria-label="Zamknij">${iconMarkup('x')}</button></div>`;
}

export function listHtml(places,selectedId=null){
  if(!places.length)return '<p class="muted cr-map-empty">Brak miejsc dla wybranych filtrów.</p>';
  return `<ul class="cr-map-list">${places.map(p=>`<li><button type="button" class="cr-map-list-item${p.id===selectedId?' is-selected':''}" data-map-action="select" data-id="${esc(p.id)}" aria-pressed="${p.id===selectedId}">`+
    `<span class="cr-dot cr-dot--${categoryGroup(p.categoryId)}" aria-hidden="true"></span><span>${esc(placeLabel(p))}</span></button></li>`).join('')}</ul>`;
}

// Injects Leaflet once per document; resolves window.L or rejects on error/timeout.
export function loadLeaflet({win=globalThis.window,doc=globalThis.document,timeoutMs=8000}={}){
  if(win?.L)return Promise.resolve(win.L);
  if(!doc?.createElement)return Promise.reject(new Error('map-no-dom'));
  if(win.__crLeaflet)return win.__crLeaflet;
  win.__crLeaflet=new Promise((resolve,reject)=>{
    const css=doc.createElement('link');Object.assign(css,{rel:'stylesheet',href:LEAFLET.css,integrity:LEAFLET.cssIntegrity,crossOrigin:''});
    const js=doc.createElement('script');Object.assign(js,{src:LEAFLET.js,integrity:LEAFLET.jsIntegrity,crossOrigin:'',async:true});
    const timer=setTimeout(()=>fail(new Error('map-load-timeout')),timeoutMs);
    const fail=e=>{clearTimeout(timer);win.__crLeaflet=null;reject(e);};
    js.onload=()=>{clearTimeout(timer);win.L?resolve(win.L):fail(new Error('map-load-empty'));};
    js.onerror=()=>fail(new Error('map-load-failed'));
    doc.head.append(css,js);
  });
  return win.__crLeaflet;
}

// Route Builder draft stops in route order. Copies only what the map needs; the input is never touched.
// `number` always follows route order, so a stop without coordinates keeps its number and is just not drawn.
export function routeStopsModel(stops){
  return (Array.isArray(stops)?stops:[]).filter(p=>p&&p.id!=null).map((p,i)=>Object.freeze({
    id:String(p.id),name:String(p.name??p.id),area:p.area||'',number:i+1,
    lat:valid(p)?+p.lat:null,lng:valid(p)?+p.lng:null,placed:valid(p)
  }));
}

export function routeListHtml(stops,selectedId=null){
  if(!stops.length)return '';
  return `<div class="cr-map-route-list"><p class="kicker">Twoja trasa · ${stops.length}</p><ol>${stops.map(s=>`<li><button type="button" class="cr-map-list-item${s.id===String(selectedId)?' is-selected':''}" data-map-action="select" data-id="${esc(s.id)}" aria-pressed="${s.id===String(selectedId)}">`+
    `<span class="cr-stop-num" aria-hidden="true">${s.number}</span><span>${esc(s.name)}${s.placed?'':' · bez lokalizacji'}</span></button></li>`).join('')}</ol></div>`;
}

/**
 * createMapView({container, places, city, onSelect, onAddToRoute, onDetails, onViewportChange, isInRoute, filter, leaflet, doc})
 * city: {name, center:{lat,lng}, defaultZoom}. leaflet: () => Promise<L> (defaults to loadLeaflet).
 * Returns a controller; `ready` resolves to 'map' or 'list' (fallback).
 */
export function createMapView(opts){
  const {container,onSelect,onAddToRoute,onDetails,onViewportChange,onNearbyChange,isInRoute=()=>false}=opts;
  const doc=opts.doc||globalThis.document;
  const coarsePointer=opts.coarsePointer??Boolean((globalThis.window?.innerWidth||Infinity)<760||globalThis.window?.matchMedia?.('(pointer: coarse)')?.matches||(globalThis.window?.navigator?.maxTouchPoints||0)>0);
  let places=opts.places||[],city=opts.city,filter=opts.filter||{},selectedId=null,nearbyOn=false,nearbyCenter=null;
  let L=null,map=null,layer=null,circle=null,resizer=null,markers=new Map(),mode='loading',tileErrors=0,destroyed=false;
  let routeStops=[],routeSource=new Map(),routeLayer=null,stopMarkers=new Map();

  const el=(tag,cls,attrs={})=>{const n=doc.createElement(tag);if(cls)n.className=cls;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
  container.classList.add('cr-map');
  const toolbar=el('div','cr-map-toolbar',{role:'toolbar','aria-label':'Mapa'});
  const nearbyBtn=el('button','cr-map-nearby',{type:'button','aria-pressed':'false','data-map-action':'nearby'});nearbyBtn.textContent=`W pobliżu · ${NEARBY_RADIUS_M} m`;
  const viewBtn=el('button','cr-map-toggle',{type:'button','data-map-action':'toggle'});viewBtn.textContent='Lista';
  const status=el('p','sr-only',{role:'status','aria-live':'polite'});
  toolbar.append(nearbyBtn,viewBtn);
  const canvas=el('div','cr-map-canvas',{'aria-label':`Mapa miejsc${city?.name?': '+city.name:''}`});
  const list=el('div','cr-map-fallback');list.hidden=true;
  const card=el('div','cr-map-card',{role:'dialog','aria-modal':'false','aria-labelledby':'cr-map-card-title'});card.hidden=true;
  container.append(toolbar,canvas,list,card,status);

  const visible=()=>filterPlaces(places,nearbyOn&&nearbyCenter?{...filter,nearby:{...nearbyCenter,radiusM:NEARBY_RADIUS_M}}:filter);
  const announce=t=>{status.textContent=t;};
  const byId=id=>visible().find(p=>String(p.id)===String(id))||places.find(p=>String(p.id)===String(id))||routeSource.get(String(id));
  const isStop=id=>routeStops.some(s=>s.id===String(id));

  function renderList(){list.innerHTML=routeListHtml(routeStops,selectedId)+(filter.showPlaces===false?'<p class="muted cr-map-empty">Wybierz kategorię, aby zobaczyć miejsca na mapie.</p>':listHtml(visible(),selectedId));}
  // Draft stops: numbered markers above place pins and a straight line between consecutive located stops.
  function renderRoute(){
    if(!map)return;
    routeLayer.clearLayers();stopMarkers=new Map();
    const placed=routeStops.filter(s=>s.placed);
    if(placed.length>1)L.polyline(placed.map(s=>[s.lat,s.lng]),{className:'cr-route-line',interactive:false}).addTo(routeLayer);
    for(const s of placed){
      const label=`${s.number}. ${s.name}`;
      const icon=L.divIcon({className:`cr-stop${s.id===String(selectedId)?' is-selected':''}`,html:`<span>${s.number}</span>`,iconSize:[34,34],iconAnchor:[17,17]});
      const m=L.marker([s.lat,s.lng],{icon,keyboard:true,title:label,alt:label,zIndexOffset:1000}).on('click',()=>select(s.id));
      m.addTo(routeLayer);stopMarkers.set(s.id,m);
    }
  }
  function renderMarkers(){
    if(!map)return;
    layer.clearLayers();markers=new Map();
    for(const p of visible()){
      if(isStop(p.id))continue;// the numbered stop marker stands in for this place
      const label=placeLabel(p);
      const icon=L.divIcon({className:`cr-pin cr-pin--${categoryGroup(p.categoryId)}${p.id===selectedId?' is-selected':''}`,html:'',iconSize:[26,26],iconAnchor:[13,13]});
      const m=L.marker([+p.lat,+p.lng],{icon,keyboard:true,title:label,alt:label,riseOnHover:true}).on('click',()=>select(p.id));
      m.addTo(layer);markers.set(String(p.id),m);
    }
    if(circle){circle.remove();circle=null;}
    if(nearbyOn&&nearbyCenter)circle=L.circle([nearbyCenter.lat,nearbyCenter.lng],{radius:NEARBY_RADIUS_M,className:'cr-map-radius',interactive:false}).addTo(map);
  }
  function render(){container.classList.toggle('has-route',routeStops.length>0);renderList();renderMarkers();renderRoute();announce(`${visible().length} miejsc na mapie`);}

  function showCard(p){
    if(!p){card.hidden=true;return;}
    card.innerHTML=cardHtml(p,{inRoute:!!isInRoute(p)});card.hidden=false;
    card.querySelector?.('[data-map-action="add"]')?.focus?.();
  }
  function select(id,{silent=false}={}){
    const p=id==null?null:byId(id);
    selectedId=p?p.id:null;
    for(const [mid,m] of [...markers,...stopMarkers])m.getElement?.()?.classList.toggle('is-selected',mid===String(selectedId));
    if(p&&map)map.panTo([+p.lat,+p.lng]);
    renderList();showCard(p);
    if(!silent)onSelect?.(p||null);
    return p||null;
  }
  // Touch maps are draggable immediately; page scrolling stays available in side gutters.
  function setMode(next){
    mode=next;const list_=next==='list';
    list.hidden=!list_;canvas.hidden=list_;viewBtn.textContent=list_?'Mapa':'Lista';viewBtn.disabled=!map;
    container.dataset.mapMode=next;
    if(!list_)map?.invalidateSize?.();// Leaflet measures its container; it was hidden until now
  }
  function center(){if(map){const c=map.getCenter();return {lat:c.lat,lng:c.lng};}return city?.center||null;}

  function onClick(e){
    const t=e.target?.closest?.('[data-map-action]');if(!t)return;
    const id=t.getAttribute('data-id'),a=t.getAttribute('data-map-action');
    if(a==='select')select(id);
    else if(a==='close'){select(null);}
    else if(a==='add'){const p=byId(id);if(p){onAddToRoute?.(p);showCard(p);announce(`${p.name} dodane do trasy`);}}
    else if(a==='details'){const p=byId(id);if(p)onDetails?.(p);}
    else if(a==='nearby')api.setNearby(nearbyOn?null:center());
    else if(a==='toggle'&&map)setMode(mode==='list'?'map':'list');
  }
  function onKey(e){if(e.key==='Escape'&&!card.hidden){select(null);canvas.focus?.();}}
  container.addEventListener('click',onClick);container.addEventListener('keydown',onKey);

  const api={
    get mode(){return mode;},
    get selectedId(){return selectedId;},
    visiblePlaces:visible,
    setPlaces(next){places=next||[];if(selectedId&&!byId(selectedId))select(null,{silent:true});render();},
    // Drafts, Nearby and selection all belong to the previous city.
    setCity(next){city=next;nearbyOn=false;nearbyCenter=null;routeStops=[];routeSource=new Map();nearbyBtn.setAttribute('aria-pressed','false');select(null,{silent:true});
      if(map&&city?.center)map.setView([city.center.lat,city.center.lng],city.defaultZoom||13);render();},
    setFilter(next){filter=next||{};render();},
    setNearby(c){nearbyOn=!!c;nearbyCenter=c||null;nearbyBtn.setAttribute('aria-pressed',String(nearbyOn));render();
      if(nearbyOn&&map)map.setView([c.lat,c.lng],16);onNearbyChange?.(c||null);},
    select:id=>select(id,{silent:true}),
    // Draft stops in route order; [] clears. {fit:true} zooms to show them (never automatic, so it can't fight the user).
    setRouteStops(stops,{fit=false}={}){
      routeStops=routeStopsModel(stops);
      routeSource=new Map((Array.isArray(stops)?stops:[]).filter(p=>p&&p.id!=null).map(p=>[String(p.id),p]));
      render();
      if(fit&&map){const b=boundsOf(routeStops.filter(s=>s.placed));if(b)map.fitBounds(b,{padding:[40,40],maxZoom:16});}
      announce(routeStops.length?`Trasa: ${routeStops.length} ${routeStops.length===1?'przystanek':routeStops.length<5?'przystanki':'przystanków'}`:'Trasa wyczyszczona');
    },
    get routeStops(){return routeStops;},
    destroy(){destroyed=true;resizer?.disconnect();container.removeEventListener('click',onClick);container.removeEventListener('keydown',onKey);map?.remove();container.replaceChildren?.();}
  };

  setMode('list');render();
  api.ready=(opts.leaflet||loadLeaflet)().then(lib=>{
    if(destroyed)return mode;
    L=lib;const c=city?.center||{lat:52.2297,lng:21.0122};
    map=L.map(canvas,{zoomControl:true,keyboard:true,dragging:true,touchZoom:true,scrollWheelZoom:!coarsePointer}).setView([c.lat,c.lng],city?.defaultZoom||13);
    L.tileLayer(TILES,{maxZoom:19,attribution:ATTRIBUTION}).on('tileerror',()=>{if(++tileErrors===TILE_ERRORS_BEFORE_FALLBACK){setMode('list');announce('Mapa jest niedostępna, pokazujemy listę miejsc.');}}).addTo(map);
    layer=L.layerGroup().addTo(map);routeLayer=L.layerGroup().addTo(map);
    map.on('moveend',()=>onViewportChange?.({center:center(),zoom:map.getZoom(),bounds:map.getBounds?.()}));
    if(typeof ResizeObserver==='function'){resizer=new ResizeObserver(()=>map.invalidateSize());resizer.observe(canvas);}
    setMode('map');render();
    return mode;
  }).catch(()=>{setMode('list');announce('Mapa jest niedostępna, pokazujemy listę miejsc.');return mode;});
  return api;
}
