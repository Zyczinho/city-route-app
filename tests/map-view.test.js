import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NEARBY_RADIUS_M,LEAFLET,categoryGroup,nearbyPlaces,filterPlaces,placeLabel,boundsOf,cardHtml,listHtml,loadLeaflet,createMapView} from '../map-view.js';

const places=[
  {id:'rynek',name:'Rynek Główny',lat:50.0615,lng:19.9373,categoryId:'landmark',area:'Stare Miasto',description:'Serce miasta.'},
  {id:'mariacki',name:'Bazylika Mariacka',lat:50.06165,lng:19.93945,categoryId:'religious_site',area:'Stare Miasto'},
  {id:'jama',name:'Jama <Michalika>',lat:50.0641,lng:19.9409,categoryId:'cafe',area:'Stare Miasto'},
  {id:'plac-nowy',name:'Plac Nowy',lat:50.0514,lng:19.9454,categoryId:'neighborhood',area:'Kazimierz'},
  {id:'broken',name:'No coords',lat:null,lng:null,categoryId:'bar'}
];
const city={id:'krakow',name:'Kraków',center:{lat:50.0647,lng:19.945},defaultZoom:13};

// Minimal DOM: enough for createElement/append/attributes/events/closest.
function fakeDoc(){
  const make=tag=>{
    const n={tagName:tag,children:[],attrs:{},dataset:{},hidden:false,textContent:'',innerHTML:'',listeners:{},
      classList:{set:new Set(),add(...c){c.forEach(x=>this.set.add(x));},toggle(c,on){on?this.set.add(c):this.set.delete(c);},contains(c){return this.set.has(c);}},
      setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
      append(...c){this.children.push(...c);},replaceChildren(){this.children=[];},
      addEventListener(t,f){(this.listeners[t]||=[]).push(f);},removeEventListener(t,f){this.listeners[t]=(this.listeners[t]||[]).filter(x=>x!==f);},
      closest(){return this.attrs['data-map-action']?this:null;},querySelector(){return null;}};
    return n;
  };
  return {createElement:make,head:make('head')};
}
const click=(container,attrs)=>{const target={attrs,getAttribute:k=>attrs[k]??null,closest(){return this;}};for(const f of container.listeners.click||[])f({target});};

function fakeLeaflet(){
  const calls={markers:[],views:[],circles:0,gestureChanges:[]};
  const gesture=name=>({enable(){calls.gestureChanges.push(name+':on');},disable(){calls.gestureChanges.push(name+':off');}});
  const evented=o=>Object.assign({handlers:{},on(t,f){this.handlers[t]=f;return this;},addTo(){return this;},remove(){}},o);
  const L={
    map:(_canvas,options)=>{calls.mapOptions=options;return calls.map=evented({dragging:gesture('dragging'),touchZoom:gesture('touchZoom'),setView(c,z){calls.views.push([c,z]);return this;},panTo(c){calls.pan=c;},getCenter:()=>({lat:50.06,lng:19.94}),getZoom:()=>14,remove(){calls.removed=true;}});},
    tileLayer:(url,o)=>{calls.tiles={url,o};return evented({});},
    layerGroup:()=>evented({clearLayers(){calls.markers=calls.markers.filter(m=>m.layer!==this);}}),
    divIcon:o=>o,
    marker:(ll,o)=>{const m=evented({ll,o,addTo(g){this.layer=g;calls.markers.push(this);return this;}});return m;},
    polyline:()=>evented({}),
    circle:(ll,o)=>{calls.circles++;calls.radius=o.radius;return evented({});}
  };
  return {L,calls};
}

test('map helpers group, filter and sort places',()=>{
  assert.equal(categoryGroup('cocktail_bar'),'nightlife');
  assert.equal(categoryGroup('unknown'),'other');
  const near=nearbyPlaces(places,{lat:50.0615,lng:19.9373});
  assert.deepEqual(near.map(p=>p.id),['rynek','mariacki','jama']);
  assert.ok(near.every(p=>p.distanceM<=NEARBY_RADIUS_M));
  assert.equal(near[0].distanceM,0);
  assert.deepEqual(filterPlaces(places,{groups:['food']}).map(p=>p.id),['jama']);
  assert.deepEqual(filterPlaces(places,{categories:['neighborhood']}).map(p=>p.id),['plac-nowy']);
  assert.equal(filterPlaces(places).length,4,'places without coordinates are skipped');
  assert.deepEqual(boundsOf(places),[[50.0514,19.9373],[50.0641,19.9454]]);
  assert.equal(boundsOf([]),null);
  assert.equal(placeLabel({...places[0],distanceM:240}),'Rynek Główny, Stare Miasto, 240 m');
});

test('card and list markup is escaped and accessible',()=>{
  const card=cardHtml(places[2]);
  assert.match(card,/Jama &lt;Michalika&gt;/);
  assert.match(card,/data-map-action="add"/);
  assert.match(card,/aria-label="Zamknij"/);
  assert.match(cardHtml(places[0],{inRoute:true}),/disabled>W trasie/);
  const list=listHtml(places.slice(0,2),'rynek');
  assert.match(list,/aria-pressed="true"/);
  assert.match(listHtml([]),/Brak miejsc/);
});

test('Leaflet is pinned with subresource integrity and fails cleanly without a DOM',async()=>{
  assert.match(LEAFLET.js,/leaflet@1\.9\.4/);
  assert.match(LEAFLET.jsIntegrity,/^sha256-/);
  assert.match(LEAFLET.cssIntegrity,/^sha256-/);
  await assert.rejects(loadLeaflet({win:{},doc:null}),/map-no-dom/);
  const L={};assert.equal(await loadLeaflet({win:{L},doc:null}),L);
});

test('map view falls back to an accessible list when the map cannot load',async()=>{
  const doc=fakeDoc(),container=doc.createElement('div');
  const view=createMapView({container,doc,places,city,leaflet:()=>Promise.reject(new Error('offline'))});
  assert.equal(await view.ready,'list');
  assert.equal(container.dataset.mapMode,'list');
  const [toolbar,canvas,list,card,status]=container.children;
  assert.equal(canvas.hidden,true);
  assert.equal(list.hidden,false);
  assert.match(list.innerHTML,/Rynek Główny/);
  assert.match(status.textContent,/niedostępna/);
  assert.equal(card.hidden,true);
  assert.equal(toolbar.getAttribute('role'),'toolbar');
});

test('map view renders markers, selects places and reports callbacks',async()=>{
  const doc=fakeDoc(),container=doc.createElement('div'),{L,calls}=fakeLeaflet();
  const seen={select:[],add:[],viewport:[]};const route=new Set();
  const view=createMapView({container,doc,places,city,leaflet:async()=>L,
    onSelect:p=>seen.select.push(p?.id??null),onAddToRoute:p=>{seen.add.push(p.id);route.add(p.id);},
    onViewportChange:v=>seen.viewport.push(v),isInRoute:p=>route.has(p.id)});
  assert.equal(await view.ready,'map');
  assert.deepEqual(calls.views[0],[[50.0647,19.945],13]);
  assert.match(calls.tiles.o.attribution,/OpenStreetMap/);
  assert.equal(calls.markers.length,4);
  assert.ok(calls.markers.every(m=>m.o.keyboard&&m.o.title&&m.o.alt),'markers are keyboard-focusable and labelled');

  calls.markers.find(m=>m.o.title.startsWith('Plac Nowy')).handlers.click();
  assert.deepEqual(seen.select,['plac-nowy']);
  assert.deepEqual(calls.pan,[50.0514,19.9454]);
  const card=container.children[3];
  assert.equal(card.hidden,false);
  assert.match(card.innerHTML,/Plac Nowy/);

  click(container,{'data-map-action':'add','data-id':'plac-nowy'});
  assert.deepEqual(seen.add,['plac-nowy']);
  assert.match(card.innerHTML,/W trasie/);

  for(const f of container.listeners.keydown)f({key:'Escape'});
  assert.equal(card.hidden,true);
  assert.equal(seen.select.at(-1),null);

  calls.map.handlers.moveend();
  assert.deepEqual(seen.viewport.at(-1),{center:{lat:50.06,lng:19.94},zoom:14,bounds:undefined});
  view.setFilter({groups:['food']});
  assert.equal(calls.markers.length,1);
  view.setFilter({});
  view.setNearby({lat:50.0615,lng:19.9373});
  assert.equal(calls.markers.length,3);
  assert.equal(calls.radius,NEARBY_RADIUS_M);
  assert.equal(container.children[0].children[0].getAttribute('aria-pressed'),'true');
  click(container,{'data-map-action':'nearby'});
  assert.equal(calls.markers.length,4,'nearby toggles off');

  click(container,{'data-map-action':'toggle'});
  assert.equal(view.mode,'list');
  click(container,{'data-map-action':'toggle'});
  assert.equal(view.mode,'map');

  view.setCity({name:'Warszawa',center:{lat:52.2297,lng:21.0122},defaultZoom:12});
  assert.deepEqual(calls.views.at(-1),[[52.2297,21.0122],12]);
  view.destroy();
  assert.equal(calls.removed,true);
  assert.equal((container.listeners.click||[]).length,0);
});

test('touch map does not trap page scrolling until user explicitly enables map gestures',async()=>{
  const doc=fakeDoc(),container=doc.createElement('div'),{L,calls}=fakeLeaflet();
  const view=createMapView({container,doc,places,city,coarsePointer:true,leaflet:async()=>L});
  assert.equal(await view.ready,'map');
  assert.equal(calls.mapOptions.dragging,false);
  assert.equal(calls.mapOptions.touchZoom,false);
  assert.equal(calls.mapOptions.scrollWheelZoom,false);
  assert.equal(container.classList.contains('is-scroll-mode'),true);
  const interaction=container.children[0].children[1];
  assert.equal(interaction.hidden,false);
  assert.equal(interaction.getAttribute('aria-pressed'),'false');
  assert.equal(interaction.textContent,'Przesuwaj mapę');
  click(container,{'data-map-action':'interaction'});
  assert.equal(container.classList.contains('is-scroll-mode'),false);
  assert.equal(interaction.textContent,'Przewijaj stronę');
  assert.equal(interaction.getAttribute('aria-pressed'),'true');
  assert.deepEqual(calls.gestureChanges.slice(-2),['dragging:on','touchZoom:on']);
  click(container,{'data-map-action':'interaction'});
  assert.equal(container.classList.contains('is-scroll-mode'),true);
  assert.deepEqual(calls.gestureChanges.slice(-2),['dragging:off','touchZoom:off']);
  click(container,{'data-map-action':'toggle'});
  assert.equal(interaction.hidden,true);
  click(container,{'data-map-action':'toggle'});
  assert.equal(interaction.hidden,false);
  view.destroy();
});

test('mobile map reserves screen edges and allows vertical touch scrolling',()=>{
  const css=readFileSync(new URL('../map.css',import.meta.url),'utf8');
  assert.match(css,/\.places-map-shell\{margin:12px 16px 20px\}/);
  assert.match(css,/height:clamp\(280px,45svh,410px\)/);
  assert.match(css,/\.cr-map\.is-scroll-mode \.leaflet-container\{touch-action:pan-y!important\}/);
});
