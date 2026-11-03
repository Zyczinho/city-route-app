import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Route Builder draft is synchronized to the map after mutations and mount',async()=>{
 const app=await readFile('app.js','utf8');
 assert.match(app,/mapView\?\.setRouteStops\(items\(nextDraft\.stops\)\)/);
 assert.match(app,/mapView=view;\s*view\.setRouteStops\(items\(builderDraft\?\.stops\|\|\[\]\)\)/);
});

test('builder-map integration invalidates the PWA cache',async()=>{
 const sw=await readFile('service-worker.js','utf8');
 assert.match(sw,/city-route-v31/);
 assert.match(sw,/map-view\.js/);
 assert.match(sw,/route-builder-model\.js/);
});
