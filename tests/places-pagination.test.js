import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PLACES_PAGE_SIZE,paginatePlaces,paginationWindow} from '../places-pagination.js';

const places=Array.from({length:258},(_,id)=>({id:'place-'+(id+1)}));

test('only the first 30 places render on initial load',()=>{
 const p=paginatePlaces(places,1);
 assert.equal(PLACES_PAGE_SIZE,30);
 assert.equal(p.items.length,30);
 assert.equal(p.items[0].id,'place-1');
 assert.equal(p.items.at(-1).id,'place-30');
 assert.deepEqual([p.page,p.pages,p.start,p.end,p.total],[1,9,1,30,258]);
});

test('every item appears once across pages; no duplicates, no skipped entries',()=>{
 const seen=[];
 for(let page=1;page<=9;page++){
  const slice=paginatePlaces(places,page);
  assert.ok(slice.items.length<=30);
  seen.push(...slice.items.map(x=>x.id));
 }
 assert.deepEqual(seen,places.map(x=>x.id));
 assert.deepEqual([paginatePlaces(places,9).start,paginatePlaces(places,9).end],[241,258]);
});

test('page clamping handles filters, empty state and malformed page numbers',()=>{
 assert.deepEqual(paginatePlaces([],99).items,[]);
 assert.deepEqual([paginatePlaces([],99).page,paginatePlaces([],99).pages],[1,1]);
 assert.deepEqual([paginatePlaces(places,999).page,paginatePlaces(places,-5).page],[9,1]);
 for(const value of [NaN,Infinity,'foo',0,1.2])assert.equal(paginatePlaces(places,value).page,1);
 const filtered=places.slice(0,11);
 assert.equal(paginatePlaces(filtered,8).page,1,'filter shrinks page count');
 assert.equal(paginatePlaces(filtered,8).items.length,11);
});
test('pagination shows compact, accessible numbered window, including first/last',()=>{
 assert.deepEqual(paginationWindow(1,9),[1,2,'…',9]);
 assert.deepEqual(paginationWindow(5,9),[1,'…',4,5,6,'…',9]);
 assert.deepEqual(paginationWindow(9,9),[1,'…',8,9]);
 assert.deepEqual(paginationWindow(1,2),[1,2]);
});
test('Places app only renders paged cards but keeps full filter result for existing map',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 for(const snippet of ['const paged=paginatePlaces(list,placesPage)','renderedPlaceList=[...list]',
  ','function showPlacesPage(nextPage)','const paged=paginatePlaces(renderedPlaceList,nextPage)',
  'observeApprovedPlaceEnrichment();','data-action="places-page"','placesPage=1','data-places-range'])
   assert.ok(app.includes(snippet),'Missing '+snippet);
 assert.ok(!app.includes('),"unbounded list image rendering is forbidden");
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const path of ['places-pagination.js','places-pagination.css']){
  assert.ok(build.includes(path),path+' missing from dist build');
  assert.ok(sw.includes(path),path+' missing from PWA');
 }
 assert.match(html,/places-pagination\.css\?v=1/);
});
+'{paged.items.map(placeRow).join','function showPlacesPage(nextPage)','const paged=paginatePlaces(renderedPlaceList,nextPage)',
  'observeApprovedPlaceEnrichment();','data-action="places-page"','placesPage=1','data-places-range'])
   assert.ok(app.includes(snippet),'Missing '+snippet);
 assert.ok(!app.includes('\${list.map(placeRow).join'),"unbounded list image rendering is forbidden");
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const path of ['places-pagination.js','places-pagination.css']){
  assert.ok(build.includes(path),path+' missing from dist build');
  assert.ok(sw.includes(path),path+' missing from PWA');
 }
 assert.match(html,/places-pagination\.css\?v=1/);
});
+'{list.map(placeRow).join'),"unbounded list image rendering is forbidden");
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const path of ['places-pagination.js','places-pagination.css']){
  assert.ok(build.includes(path),path+' missing from dist build');
  assert.ok(sw.includes(path),path+' missing from PWA');
 }
 assert.match(html,/places-pagination\.css\?v=1/);
});
+'{paged.items.map(placeRow).join','function showPlacesPage(nextPage)','const paged=paginatePlaces(renderedPlaceList,nextPage)',
  'observeApprovedPlaceEnrichment();','data-action="places-page"','placesPage=1','data-places-range'])
   assert.ok(app.includes(snippet),'Missing '+snippet);
 assert.ok(!app.includes('\${list.map(placeRow).join'),"unbounded list image rendering is forbidden");
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const path of ['places-pagination.js','places-pagination.css']){
  assert.ok(build.includes(path),path+' missing from dist build');
  assert.ok(sw.includes(path),path+' missing from PWA');
 }
 assert.match(html,/places-pagination\.css\?v=1/);
});
