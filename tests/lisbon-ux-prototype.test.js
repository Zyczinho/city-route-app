import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../assets/prototypes/lisbon-route-entry-compare.html', import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build.mjs', import.meta.url),'utf8');

test('Lisbon UX prototype is isolated from production app',()=>{
  assert.match(html, /<title>City Route · Lizbona/);
  assert.match(html, /role="region" aria-label="Interaktywny podgląd telefonu"/);
  assert.match(html, /proto-picker/);
  assert.match(html, /<button class="proto-picker-item" data-active/);
  assert.match(html, /<button class="proto-picker-item">Przewodnik/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /data-action="save"/);
  assert.match(html, /przez City Route|Zapisano w prototypie/);
  assert.doesNotMatch(html, /\bfetch\s*\(|\bXMLHttpRequest\b|\bSupabase\b|\bnavigator\.sendBeacon\b/);
  assert.match(build, /'assets'/);
  assert.doesNotMatch(build, /'assets\/prototypes\/lisbon-route-entry-compare.html'/);
});

test('two different navigation models and progressive disclosure',()=>{
  assert.match(html, /\['Start','Trasy','Miejsca','Moja','Społ\.','Profil'\]/);
  assert.match(html, /\['Odkrywaj','Planuj','Zapisane','Profil'\]/);
  assert.match(html, /function builderHub/);
  assert.match(html, /function wizard/);
  assert.match(html, /step===1/);
  assert.match(html, /step===2/);
  assert.match(html, /prefers-reduced-motion/);
});

test('Lisbon names are catalog-based and route is clearly a demo',()=>{
  for(const name of ['Castelo de São Jorge','A Brasileira','Confeitaria Nacional'])assert.ok(html.includes(name));
  assert.match(html,/trasa wygenerowana przez silnik City Route/);
  assert.match(html,/W Lizbonie nie ma jeszcze opublikowanych tras/);
  assert.match(html,/Nie ma jeszcze publicznych tras społecznościowych|W Lizbonie nie ma jeszcze publicznych tras społecznościowych/);
});
