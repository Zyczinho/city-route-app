import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('accepted Commons record on form is never mistaken for a photo action',()=>{
 const code=readFileSync(new URL('../place-composer.js',import.meta.url),'utf8');
 assert.match(code,/form\.dataset\.pcPhoto=JSON\.stringify\(record\)/);
 assert.match(code,/const photoAction=e\.target\.closest\('button\[data-pc-photo\]'\)/);
 assert.doesNotMatch(code,/e\.target\.closest\('\[data-pc-photo\]'\)/);
});
