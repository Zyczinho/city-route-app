import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('places runtime mounts map and server-backed Nearby with graceful fallback',async()=>{
 const app=await read('app.js');
 assert.match(app,/createMapView/);
 assert.match(app,/loadNearbyPlaces/);
 assert.match(app,/id=\"places-map\"/);
 assert.match(app,/distanceM:row\.distanceMeters/);
 assert.match(app,/catch\{if\(mapView===view\)view\.setPlaces\(base\)/);
 assert.match(app,/mapView\?\.destroy\(\)/);
});

test('map integration ships in build and service worker cache',async()=>{
 const [index,build,sw]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('service-worker.js')]);
 assert.match(index,/map\.css/);
 for(const file of ['nearby-client.js','map-view.js','map.css']){assert.match(build,new RegExp(file.replace('.', '\\.')));assert.match(sw,new RegExp(file.replace('.', '\\.')));}
 assert.match(sw,/city-route-v31/);
});

test('map view exposes nearby hook for PostGIS integration',async()=>{
 const map=await read('map-view.js');
 assert.match(map,/onNearbyChange/);
 assert.match(map,/onNearbyChange\?\.\(c\|\|null\)/);
});
