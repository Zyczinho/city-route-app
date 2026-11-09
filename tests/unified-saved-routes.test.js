import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {combineSavedRoutes,createSocialRoutesClient} from '../social-routes-client.js';

test('the profile archive combines own, archived, editorial and community saves in one city',()=>{
 const local=[
  {id:'mine-1',cityId:'lisbon',name:'Mój spacer',stops:['a'],createdAt:'2026-11-08T10:00:00Z',archivedAt:'2026-11-09T10:00:00Z'},
  {id:'mine-2',cityId:'lisbon',name:'Lizbona pierwszy raz',stops:['b'],sourceRouteId:'lisbon-classics',sourceKind:'editorial',createdAt:'2026-11-09T11:00:00Z'},
  {id:'mine-3',cityId:'warsaw',name:'Warszawa',stops:['c']}
 ];
 const cloud=[
  {id:'lisbon-classics',routeId:'uuid-ed',cityId:'lisbon',name:'Lizbona pierwszy raz',type:'editorial',savedAt:'2026-11-09T12:00:00Z'},
  {id:'uuid-comm',routeId:'uuid-comm',cityId:'lisbon',name:'Trasa znajomego',type:'community',savedAt:'2026-11-09T13:00:00Z'},
  {id:'warsaw-other',routeId:'uuid-waw',cityId:'warsaw',name:'Inne miasto',type:'editorial'}
 ];
 const saved=combineSavedRoutes({localRoutes:local,remoteRoutes:cloud,cityId:'lisbon'});
 assert.equal(saved.length,3,'the same editorial source must not appear twice');
 assert.deepEqual(saved.map(x=>x.kind),['community','editorial-local','mine']);
 assert.equal(saved[2].archived,true,'archived own routes remain accessible');
 assert.equal(saved[1].sourceRouteId,'lisbon-classics','source attribution preserved');
 assert.equal(saved[1].href,'#route/mine-2');
 assert.equal(saved[0].href,'#community-route/uuid-comm');
 assert.equal(saved[0].sourceRef,'uuid-comm','community unsave RPC requires UUID');
 assert.ok(saved.every(x=>x.cityId==='lisbon'));
});

test('guests retain their local saved routes without an account or network',()=>{
 const result=combineSavedRoutes({cityId:'lisbon',localRoutes:[{id:'mine-offline',cityId:'lisbon',stops:['one'],name:'Offline'}]});
 assert.equal(result.length,1);
 assert.equal(result[0].kind,'mine');
 assert.equal(result[0].href,'#route/mine-offline');
 assert.deepEqual(combineSavedRoutes({cityId:'lisbon',localRoutes:null,remoteRoutes:null}),[]);
});

test('editorial detail has a dedicated save action, not the old edit-as-my-route action',async()=>{
 const [app,ui,hub]=await Promise.all(['app.js','social-routes-enhancements.js','community-hub.js'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
 assert.match(app,/data-action="save-editorial"/);
 assert.match(app,/sourceRouteId:id,sourceKind:'editorial'/);
 assert.match(app,/function editorialSaveButton/);
 assert.match(app,/Zapisane trasy<\/strong>/);
 assert.doesNotMatch(app,/Zapisane trasy innych/);
 assert.match(app,/else if\(tab==='social-saved'\)html=savedRoutesView\(\)/,'core router must own a nonblank local archive');
 assert.match(app,/data-saved-routes-cards/);
 assert.match(ui,/combineSavedRoutes\(\{localRoutes,remoteRoutes:saved,cityId:activeCity\}\)/);
 assert.match(ui,/Trasy zapisane na koncie zobaczysz po zalogowaniu/);
 assert.match(hub,/if\(hash==='#social-saved'\)return null/,'personal route archive must remain under Profile navigation');
 assert.doesNotMatch(ui,/root\.innerHTML='<p class="loading" data-social-saved-loading>/,'server cannot blank the core archive');
 assert.match(ui,/root\.dataset\.savedAccount===viewer/,'auth rerender must be idempotent');
 assert.match(app,/data-action="remove-saved-local"/,'device saves must be removable directly from the list');
 assert.match(app,/state\.myRoutes=state\.myRoutes\.filter\(r=>r!==saved\)/,'remove only the current city/device snapshot');
 assert.match(ui,/data-saved-unsave/,'cloud saves need a separate unsave action');
 assert.match(ui,/await api\.unsaveRoute\(ref,selectedCity\)/,'account bookmark must be removed via unsave_route RPC');
 assert.doesNotMatch(ui,/data-saved-unsave[^\n]+deleteOwnedRoute/,'never delete published route during unsave');
});

test('remote trash uses unsave_route for both community UUID and editorial slug, never source deletion',async()=>{
 const calls=[];
 const api=createSocialRoutesClient({client:{rpc:async(name,args)=>{calls.push({name,args});return {data:'ok'};}}});
 await api.unsaveRoute('uuid-comm','lisbon');
 await api.unsaveRoute('lisbon-classics','lisbon');
 assert.deepEqual(calls,[
  {name:'unsave_route',args:{p_city_slug:'lisbon',p_ref:'uuid-comm'}},
  {name:'unsave_route',args:{p_city_slug:'lisbon',p_ref:'lisbon-classics'}}
 ]);
 const remote=combineSavedRoutes({cityId:'lisbon',remoteRoutes:[{id:'lisbon-classics',routeId:'uuid-ed',cityId:'lisbon',type:'editorial',name:'Classics'}]});
 assert.equal(remote[0].sourceRef,'lisbon-classics','remote editorial unsave must use public slug rather than database UUID');
});
