import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function routesView(){');
const end=app.indexOf('\n// Places tab',start);
assert.ok(start>=0&&end>start,'routesView source is available');

function renderRoutes(count,{query='',rcat='all'}={}){
 const routes=Array.from({length:count},(_,i)=>({
  id:'route-'+i,name:'Trasa '+(i+1),description:'Opis',
  stops:[],cats:i%2===0?['klasyka']:['lokalnie']
 }));
 const context={
  routes,query,rcat,ROUTE_CATS:[['all','Wszystkie'],['klasyka','Na pierwszy raz']],
  items:()=>[],catName:()=>'',matches:(value,needle)=>value.toLowerCase().includes(needle.toLowerCase()),
  routeCoverAssignments:()=>new Map(),catalog:()=>[],placeHay:()=>'',city:()=>({name:'Lizbona'}),
  esc:value=>String(value),resident:()=>false,liveBanner:()=>'',
  searchBox:()=>'<div data-route-search></div>',
  chips:()=>'<div data-route-filters></div>',
  routeCard:(r,featured)=>'<article data-featured="'+featured+'">'+r.name+'</article>',
  plural:()=>'',ic:()=>''
 };
 vm.runInNewContext(app.slice(start,end)+'\nresult=routesView();',context);
 return context.result;
}

test('three editorial routes render without search and category pills',()=>{
 const html=renderRoutes(3);
 assert.equal((html.match(/<article /g)||[]).length,3);
 assert.doesNotMatch(html,/data-route-search|data-route-filters/);
 assert.match(html,/3 · redakcja City Route/);
 assert.match(html,/data-featured="true"/);
});

test('hidden filters cannot accidentally exclude routes when old query or category remains',()=>{
 const html=renderRoutes(3,{query:'nieistniejąca',rcat:'inne'});
 assert.equal((html.match(/<article /g)||[]).length,3);
 assert.doesNotMatch(html,/data-route-search|data-route-filters/);
});

test('search and categories return automatically after catalogue exceeds six routes',()=>{
 const html=renderRoutes(7,{query:'Trasa 2',rcat:'all'});
 assert.match(html,/data-route-search/);
 assert.match(html,/data-route-filters/);
 assert.equal((html.match(/<article /g)||[]).length,1);
 assert.match(html,/Trasa 2/);
});

test('empty small catalogue displays a useful message instead of a blank search',()=>{
 const html=renderRoutes(0);
 assert.match(html,/Nie mamy jeszcze gotowych tras dla Lizbona/);
 assert.doesNotMatch(html,/data-route-search|data-route-filters/);
});
