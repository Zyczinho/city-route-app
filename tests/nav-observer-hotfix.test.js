import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code=await readFile(new URL('../nav-enhancements.js',import.meta.url),'utf8');
const order=['#plan','#routes','#places','#routes/community','#profile'];

function fakeBoot(){
 const queue=[],listeners={};let routebar=null;
 const body={dataset:{routeStops:'0',routeLive:'false',routeFinished:'false'},classList:{toggle(){}}};
 const makeNode=href=>({
  href,parent:null,dataset:{},hidden:false,textContent:'',attributes:{},
  classList:{add(){},remove(){},toggle(){}},
  setAttribute(k,v){this.attributes[k]=v;},
  getAttribute(k){return k==='href'?this.href:this.attributes[k]??null;},
  removeAttribute(k){delete this.attributes[k];},
  querySelector(q){if(q==='.variant-d-route-label')return this.label||(this.label={textContent:''});return null;},
  remove(){this.parent?.removeChild(this);}
 });
 const nav={
  children:[],observers:[],
  querySelector(selector){
   const href=selector.match(/^a\[href="([^"]+)"\]$/)?.[1];
   return this.children.find(el=>el.href===href)||null;
  },
  querySelectorAll(){return this.children;},
  append(el){
   el.parent?.removeChild(el);el.parent=this;this.children.push(el);this.signal();
  },
  replaceChildren(...nodes){
   this.children.forEach(el=>{el.parent=null;});
   this.children=nodes;nodes.forEach(el=>{el.parent=this;});this.signal();
  },
  removeChild(el){
   const i=this.children.indexOf(el);
   if(i!==-1){this.children.splice(i,1);el.parent=null;this.signal();}
  },
  before(el){routebar=el;},
  signal(){for(const cb of this.observers)queue.push(cb);}
 };
 const core=['#plan','#routes','#places','#my-route','#book','#profile'];
 for(const href of core){const el=makeNode(href);el.parent=nav;nav.children.push(el);}
 class Observer{constructor(cb){this.cb=cb;}observe(el){el.observers.push(this.cb);}}
 const document={
  body,
  querySelector:s=>s==='#navigation'?nav:null,
  createElement:()=>makeNode(''),
  getElementById:id=>id==='active-route-bar'?routebar:null
 };
 vm.runInNewContext(code,{
  document,window:{addEventListener:(type,cb)=>listeners[type]=cb},
  location:{hash:'#plan'},MutationObserver:Observer,setTimeout:fn=>fn()
 });
 function drain(){
  let calls=0;
  while(queue.length){
   assert.ok(++calls<35,'nav observer must not endlessly mutate itself');
   queue.shift()();
  }
  return calls;
 }
 return {nav,core,makeNode,drain,queue,listeners,document,body,getRouteBar:()=>routebar};
}

test('navigation observer settles after boot, rerender and hashchange',()=>{
 const t=fakeBoot();
 assert.deepEqual(t.nav.children.map(el=>el.href),order);
 t.drain();assert.equal(t.drain(),0);
 for(const el of [...t.nav.children])el.remove();
 for(const href of t.core)t.nav.append(t.makeNode(href));
 t.drain();assert.deepEqual(t.nav.children.map(el=>el.href),order);
 t.listeners.hashchange();assert.equal(t.drain(),0);
});

test('routebar appears for a draft route and disappears on My Route itself',()=>{
 const t=fakeBoot();t.drain();
 assert.equal(t.getRouteBar()?.hidden,true);
 t.body.dataset.routeStops='3';
 t.listeners['cityroute:route-nav']();t.drain();
 assert.equal(t.getRouteBar()?.hidden,false);
 assert.match(t.getRouteBar().querySelector('.variant-d-route-label').textContent,/3 przystanki/);
 t.document.body.dataset.routeLive='true';
 t.listeners['cityroute:route-nav']();t.drain();
 assert.match(t.getRouteBar().querySelector('.variant-d-route-label').textContent,/w toku/);
});
