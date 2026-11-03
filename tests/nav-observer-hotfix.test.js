
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const code=await readFile(new URL('../nav-enhancements.js',import.meta.url),'utf8');
const order=['#plan','#routes','#my-route','#routes/community','#places'];
function fakeBoot(){
 const queue=[],listeners={};
 const nav={children:[],observers:[],querySelector(selector){
  const href=selector.match(/^a\[href="([^"]+)"\]$/)?.[1];
  return this.children.find(el=>el.href===href)||null;
 },append(el){
  el.parent?.removeChild(el);
  el.parent=this;this.children.push(el);this.signal();
 },removeChild(el){
  const i=this.children.indexOf(el);
  if(i!==-1){this.children.splice(i,1);el.parent=null;this.signal();}
 },signal(){for(const cb of this.observers)queue.push(cb);}};
 const link=href=>({href,parent:null,dataset:{},className:'',
  classList:{add(){},remove(){},toggle(){}},
  setAttribute(){},removeAttribute(){},
  remove(){this.parent?.removeChild(this);}});
 const core=['#plan','#routes','#places','#my-route','#book'];
 for(const h of core){const el=link(h);el.parent=nav;nav.children.push(el);}
 class Observer{constructor(cb){this.cb=cb;}observe(el){el.observers.push(this.cb);}}
 vm.runInNewContext(code,{document:{querySelector:s=>s==='#navigation'?nav:null,createElement:()=>link('')},
  window:{addEventListener:(type,cb)=>listeners[type]=cb},location:{hash:'#plan'},
  MutationObserver:Observer,setTimeout:fn=>fn()});
 function drain(){
  let calls=0;while(queue.length){
   assert.ok(++calls<35,'nav observer mutated itself endlessly');
   queue.shift()();
  }return calls;
 }
 return {nav,core,link,drain,queue,listeners};
}
test('navigation observer settles after boot, rerender and hashchange',()=>{
 const x=fakeBoot();
 assert.deepEqual(x.nav.children.map(el=>el.href),order);
 x.drain();
 assert.equal(x.drain(),0);
 for(const el of [...x.nav.children])el.remove();
 for(const href of x.core)x.nav.append(x.link(href));
 x.drain();
 assert.deepEqual(x.nav.children.map(el=>el.href),order);
 x.listeners.hashchange();
 assert.equal(x.drain(),0);
});
