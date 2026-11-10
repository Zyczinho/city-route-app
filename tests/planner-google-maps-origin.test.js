import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeMapsUrl,mapsUrl} from '../core.js';

const source=()=>readFileSync(new URL('../app.js',import.meta.url),'utf8');
const route=[
 {id:'gothic-store',name:'Gothic Store',lat:52.233, lng:21.02},
 {id:'fly-bar',name:'Fly bar',lat:52.232, lng:21.021},
 {id:'creative',name:'Modern Creative',lat:52.231,lng:21.022}
];
const pawilony={id:'custom-origin',name:'Pawilony, Nowy Świat',lat:52.2333,lng:21.0195};

test('custom planner origin becomes the Google Maps starting point, without adding a visit',()=>{
 const u=new URL(routeMapsUrl(route,'walking',pawilony));
 assert.equal(u.searchParams.get('origin'),'52.2333,21.0195');
 assert.equal(u.searchParams.get('destination'),'52.231,21.022');
 assert.equal(u.searchParams.get('waypoints'),'52.233,21.02|52.232,21.021');
 assert.equal(u.searchParams.get('travelmode'),'walking');
 assert.equal(u.searchParams.get('waypoints')?.includes('52.2333,21.0195'),false);
});
test('generated routes without a specified origin retain Google Maps current-location behavior',()=>{
 const url=new URL(routeMapsUrl(route,'bike'));
 assert.equal(url.searchParams.has('origin'),false);
 assert.equal(url.searchParams.get('travelmode'),'bicycling');
 assert.equal(routeMapsUrl([]), '');
});
test('invalid origin never produces a broken Maps link',()=>{
 assert.equal(new URL(routeMapsUrl(route,'walking',{lat:null,lng:21.01})).searchParams.has('origin'),false);
 assert.equal(new URL(routeMapsUrl(route,'walking',{lat:110,lng:21.01})).searchParams.has('origin'),false);
 assert.equal(new URL(routeMapsUrl(route,'walking',{lat:52.2,lng:21.01})).searchParams.has('origin'),true);
});
test('planner preserves chosen start through generation, saved routes and sharing',()=>{
 const app=source();
 assert.match(app,/return plan\(prefs,\{lat,lng,id:'custom-origin',name:input\.value\.trim\(\)\}\)/);
 assert.match(app,/start:generationPrefs\.start\|\|null/);
 assert.match(app,/shareRouteButton\(ps,r\.transport,r\.name,own\|\|r\.id==='generated'\?\{kind:'maps',origin:r\.start\|\|null\}/);
 assert.match(app,/\$\{wholeRoute\(ps,r\.transport,r\.start\|\|null\)\}/);
 assert.match(app,/sourceKind:r\.sourceKind\|\|null,start:r\.start\|\|null/);
 assert.match(app,/transport:r\.transport\|\|'walking',start:r\.start\|\|null/);
 assert.match(app,/routeMapsUrl\(ps,t,origin\)/);
 assert.match(app,/routeMapsUrl\(ps,transport,origin\)/);
 assert.match(app,/function transitLegLinks\(ps,origin=null\)/);
});


test('first live navigation leg uses the selected start, later legs do not',()=>{
 const first=new URL(mapsUrl(route[0],'walking',pawilony));
 const later=new URL(mapsUrl(route[1],'walking'));
 assert.equal(first.searchParams.get('origin'),'52.2333,21.0195');
 assert.equal(first.searchParams.get('destination'),'52.233,21.02');
 assert.equal(later.searchParams.has('origin'),false);
 assert.match(source(),/mapsUrl\(p,s\.transport,s\.index===0\?s\.start:null\)/);
});
