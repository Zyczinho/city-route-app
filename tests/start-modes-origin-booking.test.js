import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canViewRouteExterior} from '../route-preferences.js';
import {openingFor,scheduleRoute} from '../opening-hours.js';
import {planRoutesV2} from '../route-planner-v2.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const p=(id,categoryId,more={})=>({id,name:id,kind:'place',cityId:'warsaw',categoryId,
 lat:52.23,lng:21.01,minutes:25,cost:0,foodStyle:'none',tags:[],cats:[],ratings:[],...more});
test('viewing mode is automatic (Start V3) and exact start is wired into Start',()=>{
 const app=read('app.js'),enh=read('enhancements.js'),style=read('ux-cleanup.css');
 assert.doesNotMatch(app,/Jak chcesz oglądać atrakcje\?/,'the planner decides inside vs facade itself');
 assert.match(app,/prefs\.visitMode='mix'/);
 assert.match(app,/if\(prefs\.visitMode==='outside'\)prefs\.avoid=normalizeRouteExclusions\(\[\.\.\.prefs\.avoid,'museums'\]\)/,'legacy outside-only maps to the museum exclusion');
 assert.match(app,/name="originAddress"/);
 assert.match(app,/id="planner-origin-options"/);
 assert.match(app,/role="combobox"/);
 assert.match(app,/data-action="planner-origin-change"/);
 assert.match(app,/f\.dataset\.originConfirmed/);
 assert.match(app,/f\.dataset\.originCity!==city\(\)\.id/);
 assert.match(enh,/originRemoteSuggestions\(query,city,controller\.signal\)/);
 assert.match(enh,/originLocalSuggestions\(query,city\)/);
 assert.match(enh,/kmFromCenter\(city,Number\(p\.lat\),Number\(p\.lng\)\)<=city\.radiusKm/);
 assert.match(enh,/originConfirmed:'1'/);
 assert.match(enh,/originMoveFocus\(form/);
 assert.match(enh,/originChoose\(form/);
 assert.match(enh,/originHideOptions\(form/);
 assert.match(style,/planner-origin-fields\[hidden\]/);
});
test('outdoor-only rejects indoor exhibitions unless a meaningful exterior is marked',()=>{
 assert.equal(canViewRouteExterior(p('museum','museum')),false);
 assert.equal(canViewRouteExterior(p('museum-outside','museum',{exteriorWorthVisiting:true})),true);
 assert.equal(canViewRouteExterior(p('cinema','theatre',{interiorOnly:true})),false);
 assert.equal(canViewRouteExterior(p('park','park')),true);
});
test('mixed viewing retains an exterior-worthy closed museum but inside only rejects',()=>{
 const museum=p('chopin-museum','museum',{cats:['muzea'],exteriorWorthVisiting:true,outsideMinutes:12});
 const origin={lat:52.23,lng:21.01};
 const prefs={cityId:'warsaw',visitDate:'2026-11-11',startTime:'10:00',time:120,
  transport:'walking',interests:['culture'],food:'none',budget:'premium',offers:'no',visitMode:'mix',start:origin};
 const mixed=planRoutesV2([museum],prefs);
 assert.ok(mixed.routes.some(r=>r.stopIds.includes(museum.id)));
 const inside=planRoutesV2([museum],{...prefs,visitMode:'inside'});
 assert.equal(inside.routes.length,0);
 const scheduled=scheduleRoute([museum],{cityId:'warsaw',date:'2026-11-11',mode:'mix',startTime:'10:00'});
 assert.equal(scheduled.feasible,true);
});
test('ticket and lodging tabs hidden from booking interface without deleting underlying handlers',()=>{
 const app=read('app.js');
 assert.match(app,/const BOOK=\[\['tables','Stoliki','utensils'\]\]/);
 assert.match(app,/const tab=BOOK\.some/);
 assert.match(app,/Rezerwacje stolików/);
 assert.match(app,/if\(tab==='hotels'\)/);
 assert.match(app,/if\(tab==='tickets'\)/);
});
