import test from 'node:test';
import assert from 'node:assert/strict';
import {routeStopsModel,routeListHtml,createMapView} from '../map-view.js';

const places=[
  {id:'rynek',name:'Rynek Główny',lat:50.0615,lng:19.9373,categoryId:'landmark',area:'Stare Miasto'},
  {id:'mariacki',name:'Bazylika Mariacka',lat:50.06165,lng:19.93945,categoryId:'religious_site'},
  {id:'jama',name:'Jama Michalika',lat:50.0641,lng:19.9409,categoryId:'cafe'},
  {id:'plac-nowy',name:'Plac Nowy',lat:50.0514,lng:19.9454,categoryId:'neighborhood'}
];
const city={name:'Kraków',center:{lat:50.0647,lng:19.945},defaultZoom:13};

function fakeDoc(){
  const make=tag=>({tagName:tag,children:[],attrs:{},dataset:{},hidden:false,textContent:'',innerHTML:'',listeners:{},
    classList:{set:new Set(),add(...c){c.forEach(x=>this.set.add(x));},toggle(c,on){on?this.set.add(c):this.set.delete(c);}},
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},append(...c){this.children.push(...c);},replaceChildren(){this.children=[];},
    addEventListener(t,f){(this.listeners[t]||=[]).push(f);},removeEventListener(t,f){this.listeners[t]=(this.listeners[t]||[]).filter(x=>x!==f);},querySelector(){return null;}});
  return {createElement:make,head:make('head')};
}
function fakeLeaflet(){
  const calls={layers:[]};
  const evented=o=>Object.assign({handlers:{},on(t,f){this.handlers[t]=f;return this;},addTo(g){g?.items?.push(this);return this;},remove(){}},o);
  const L={
    map:()=>calls.map=evented({setView(){return this;},panTo(c){calls.pan=c;},fitBounds(b,o){calls.fit=[b,o];},getCenter:()=>({lat:50.06,lng:19.94}),getZoom:()=>14,remove(){}}),
    tileLayer:()=>evented({}),
    layerGroup:()=>{const g=evented({items:[],clearLayers(){this.items=[];}});calls.layers.push(g);return g;},
    divIcon:o=>o,
    marker:(ll,o)=>evented({kind:'marker',ll,o}),
    polyline:(lls,o)=>evented({kind:'line',lls,o}),
    circle:()=>evented({kind:'circle'})
  };
  return {L,calls,places:()=>calls.layers[0].items,route:()=>calls.layers[1].items};
}
const mount=async(extra={})=>{
  const doc=fakeDoc(),container=doc.createElement('div'),f=fakeLeaflet(),seen=[];
  const view=createMapView({container,doc,places,city,leaflet:async()=>f.L,onSelect:p=>seen.push(p?.id??null),...extra});
  await view.ready;return {view,container,seen,...f};
};

test('routeStopsModel keeps route order, numbers and never touches the input',()=>{
  const input=[places[3],{id:'no-coords',name:'Bez punktu'},places[0],null,{name:'no id'}];
  const before=JSON.stringify(input);
  const stops=routeStopsModel(input);
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(stops.map(s=>[s.id,s.number,s.placed]),[['plac-nowy',1,true],['no-coords',2,false],['rynek',3,true]]);
  assert.ok(Object.isFrozen(stops[0]));
  assert.deepEqual(routeStopsModel(undefined),[]);
  assert.match(routeListHtml(stops,'rynek'),/aria-pressed="true"/);
  assert.match(routeListHtml(stops),/bez lokalizacji/);
  assert.equal(routeListHtml([]),'');
});

test('setRouteStops draws numbered markers in order and one line between located stops',async()=>{
  const {view,places:pins,route}=await mount();
  const input=[places[3],places[0],places[2]],frozen=Object.freeze([...input]);
  view.setRouteStops(frozen);
  const markers=route().filter(x=>x.kind==='marker'),line=route().find(x=>x.kind==='line');
  assert.deepEqual(markers.map(m=>m.o.title),['1. Plac Nowy','2. Rynek Główny','3. Jama Michalika']);
  assert.deepEqual(markers.map(m=>m.o.icon.html),['<span>1</span>','<span>2</span>','<span>3</span>']);
  assert.ok(markers.every(m=>m.o.keyboard&&m.o.alt&&m.o.zIndexOffset>0),'stops are focusable, labelled and above place pins');
  assert.deepEqual(line.lls,[[50.0514,19.9454],[50.0615,19.9373],[50.0641,19.9409]]);
  assert.equal(line.o.interactive,false);
  assert.deepEqual(input.map(p=>p.id),['plac-nowy','rynek','jama'],'input order untouched');
  assert.deepEqual(pins().map(m=>m.o.title.split(',')[0]),['Bazylika Mariacka'],'a stop replaces its own place pin, others stay');
  assert.deepEqual(view.routeStops.map(s=>s.id),['plac-nowy','rynek','jama']);
});

test('one located stop draws no line; [] clears and restores place pins',async()=>{
  const {view,places:pins,route,container}=await mount();
  view.setRouteStops([places[0],{id:'ghost',name:'Ghost'}]);
  assert.equal(route().filter(x=>x.kind==='line').length,0);
  assert.equal(route().filter(x=>x.kind==='marker').length,1);
  view.setRouteStops([]);
  assert.equal(route().length,0);
  assert.equal(pins().length,4);
  assert.equal(container.children.at(-1).textContent,'Trasa wyczyszczona');
});

test('stops coexist with filters, Nearby, selection and the place card',async()=>{
  const {view,places:pins,route,seen,container,calls}=await mount({isInRoute:p=>['rynek','plac-nowy'].includes(p.id)});
  view.setRouteStops([places[0],places[3]]);
  view.setFilter({groups:['food']});
  assert.equal(route().filter(x=>x.kind==='marker').length,2,'filters never hide the draft');
  assert.deepEqual(pins().map(m=>m.o.title.split(',')[0]),['Jama Michalika']);
  view.setNearby({lat:50.0615,lng:19.9373});
  assert.equal(route().filter(x=>x.kind==='marker').length,2,'Nearby never hides the draft');
  view.setNearby(null);view.setFilter({});
  route().find(m=>m.o?.title==='2. Plac Nowy').handlers.click();
  assert.deepEqual(seen,['plac-nowy']);
  assert.deepEqual(calls.pan,[50.0514,19.9454]);
  const card=container.children[3];
  assert.equal(card.hidden,false);
  assert.match(card.innerHTML,/W trasie/);
  view.setRouteStops([places[3],places[0]]);
  assert.equal(view.selectedId,'plac-nowy','selection survives a reorder');
});

test('list fallback shows the ordered draft above the places; city switch clears the draft',async()=>{
  const doc=fakeDoc(),container=doc.createElement('div');
  const view=createMapView({container,doc,places,city,leaflet:()=>Promise.reject(new Error('offline'))});
  assert.equal(await view.ready,'list');
  view.setRouteStops([places[2],places[0]]);
  const html=container.children[2].innerHTML;
  assert.ok(html.indexOf('Twoja trasa · 2')<html.indexOf('cr-map-list"'),'draft first');
  assert.ok(html.indexOf('Jama Michalika')<html.indexOf('Rynek Główny'));
  view.setCity({name:'Warszawa',center:{lat:52.23,lng:21.01}});
  assert.deepEqual(view.routeStops,[]);
  assert.doesNotMatch(container.children[2].innerHTML,/Twoja trasa/);
});

test('fit is opt-in and zooms to located stops only',async()=>{
  const {view,calls}=await mount();
  view.setRouteStops([places[0],places[3]]);
  assert.equal(calls.fit,undefined);
  view.setRouteStops([places[0],{id:'x',name:'x'},places[3]],{fit:true});
  assert.deepEqual(calls.fit[0],[[50.0514,19.9373],[50.0615,19.9454]]);
  assert.equal(calls.fit[1].maxZoom,16);
});
