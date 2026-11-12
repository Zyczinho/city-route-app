import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('autocomplete is in-flow below the address input, with selected-place card',()=>{
 const app=src('app.js'),css=src('ux-cleanup.css');
 assert.match(app,/role="combobox" aria-autocomplete="list"/);
 assert.match(app,/id="planner-origin-options" class="planner-origin-options" role="listbox"/);
 assert.match(app,/class="planner-origin-selected" hidden/);
 assert.doesNotMatch(app,/data-action="planner-origin-search"/);
 assert.match(css,/\.planner-origin-options\{display:grid/);
 assert.match(css,/\.planner-origin-selected\[hidden\]/);
 assert.match(css,/\.planner-origin-option\[aria-selected="true"\]/);
});
test('origin autocomplete is debounced, local-first and requires an explicit selection',()=>{
 const enh=src('enhancements.js'),app=src('app.js');
 assert.match(enh,/setTimeout\(\(\)=>\{void originSearch\(form,query,token,controller\);\},500\)/);
 assert.match(enh,/new AbortController\(\)/);
 assert.match(enh,/originNormalise\(input.value\)===query/);
 assert.match(enh,/originInput\(form\)/);
 assert.match(enh,/originEntries\.set\(form,results\)/);
 assert.match(enh,/if\(options\.length\)originChoose\(form,originActiveIndex>=0\?originActiveIndex:0\)/);
 assert.match(enh,/originReset\(form\)/);
 assert.match(app,/!f\.dataset\.originConfirmed/);
 assert.match(app,/\.planner-origin-status'\);if\(status\)status\.textContent='Wybierz punkt/);
});
test('search uses current city and forces OSM, never paid Google',()=>{
 const enh=src('enhancements.js'),worker=src('worker.js');
 assert.match(enh,/api\/place-suggest\?source=osm&q=/);
 assert.match(enh,/cityQuery\(city\)/);
 assert.match(enh,/originValid\(p,city\)/);
 assert.match(enh,/photon\.komoot\.io\/api\//);
 assert.match(worker,/url\.searchParams\.get\('source'\)!=='osm'/);
});
