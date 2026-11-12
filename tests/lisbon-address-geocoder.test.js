import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../enhancements.js',import.meta.url),'utf8');

test('Lisbon address geocoding uses Portugal instead of Poland',()=>{
 assert.match(src,/countryCode:c\.countryCode\|\|'PL'/);
 assert.match(src,/city\.id==='lisbon'\?'Lisboa':city\.name/);
 assert.match(src,/u\.searchParams\.set\('countrycodes',String\(city\.countryCode\|\|'PL'\)\.toLowerCase\(\)\)/);
 assert.match(src,/city\.locale\|\|'pl-PL'/);
 assert.doesNotMatch(src,/u\.searchParams\.set\('countrycodes','pl'\)/);
});
