import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Route Builder draft is category-gated on the Places map after mutations and mount',async()=>{
 const app=await readFile('app.js','utf8');
 assert.match(app,/const stopsForPlacesMap=ids=>mapCategorySelected\?items\(ids\)\.filter/);
 assert.match(app,/mapView\?\.setRouteStops\(stopsForPlacesMap\(nextDraft\.stops\)\)/);
 assert.match(app,/view\.setRouteStops\(stopsForPlacesMap\(builderDraft\?\.stops\|\|\[\]\)\)/);
});

test('builder-map integration invalidates the PWA cache',async()=>{
 const sw=await readFile('service-worker.js','utf8');
 assert.match(sw,/city-route-v65/);
 assert.match(sw,/map-view\.js/);
 assert.match(sw,/route-builder-model\.js/);
});
