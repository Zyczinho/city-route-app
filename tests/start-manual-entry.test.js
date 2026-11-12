import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ux=await readFile(new URL('../ux-cleanup.js',import.meta.url),'utf8');
const css=await readFile(new URL('../ux-cleanup.css',import.meta.url),'utf8');

test('Start offers a distinct manual planning entry above the automatic planner',()=>{
 assert.match(ux,/manual\.href='#my-route'/);
 assert.match(ux,/manual\.textContent='Ułóż sam'/);
 assert.match(ux,/choice\.append\(description,manual\)/);
 assert.match(ux,/form\.before\(choice\)/);
 assert.match(css,/\.ux-plan-manual-entry/);
});

test('manual entry reuses the existing My Route builder and does not create another',()=>{
 assert.match(ux,/location\.hash!=='#my-route'/);
 assert.match(ux,/empty\.dataset\.uxManualReady==='1'/);
 assert.match(ux,/add\.classList\.add\('primary'\)/);
 assert.match(ux,/links\.prepend\(add\)/);
 assert.match(ux,/Wybierz pierwsze miejsce/);
 assert.match(ux,/Wolę plan automatyczny/);
});

test('manual entry remains accessible while Places and Social stay in alternatives',()=>{
 assert.match(ux,/manual\.setAttribute\('aria-label','Ułóż trasę samodzielnie w Mojej trasie'\)/);
 assert.match(ux,/placesLink\.href='#places'/);
 assert.match(ux,/social\.href='#routes\/community'/);
 assert.doesNotMatch(ux,/manual\.href='#places'/);
});
