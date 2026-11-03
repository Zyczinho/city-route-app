import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile('app.js','utf8');
const html=await readFile('index.html','utf8');
const sw=await readFile('service-worker.js','utf8');

test('runtime exposes a city selector without Krakow-specific branching',()=>{
  assert.match(app,/id=\\?"city-select\\?"|id='city-select'|id="city-select"/);
  assert.doesNotMatch(app,/if\s*\([^)]*krakow|switch\s*\([^)]*krakow/i);
  assert.match(app,/switchCity\(/);
});

test('city selector preserves basket state per city',()=>{
  assert.match(app,/basketsByCity/);
  assert.match(app,/state\.basketsByCity\[state\.cityId\]/);
});

test('active route blocks city switching',()=>{
  assert.match(app,/if\(isLive\(\)\).*zakończ aktywną trasę/);
});

test('static shell is city-neutral and Krakow fallback is cached',()=>{
  assert.match(html,/Wczytujemy miasto/);
  assert.match(sw,/data\/cities\/krakow\/places\.json/);
  assert.match(sw,/data\/cities\/krakow\/routes\.json/);
});
