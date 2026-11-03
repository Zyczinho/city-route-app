import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const read=p=>readFile(p,'utf8');

test('UX cleanup makes the planner progressively disclose complexity without changing field names',async()=>{
 const [app,ux]=await Promise.all([read('app.js'),read('ux-cleanup.js')]);
 for(const name of ['time','transport','food','start','budget','tourist','offers'])assert.match(app,new RegExp(`radio\\('${name}'`));
 assert.match(app,/name="interests"/);
 assert.match(ux,/Wybierz czas\. Reszta jest opcjonalna\./);
 assert.match(ux,/disclosure\('Klimat trasy'/);
 assert.match(ux,/disclosure\('Więcej ustawień'/);
 assert.match(ux,/submit\.textContent='Ułóż trasę'/);
 assert.match(ux,/form\.replaceChildren\(primary,climate\.details,advanced\.details,submit,alternatives\)/);
 assert.doesNotMatch(ux,/—/,'planner cleanup copy must avoid long AI-style dashes');
});

test('Community tab focuses the existing social feed instead of duplicating social data logic',async()=>{
 const ux=await read('ux-cleanup.js');
 assert.match(ux,/#routes\/community/);
 assert.match(ux,/\[data-social-feed\]/);
 assert.match(ux,/root\.dataset\.communityFocus='1'/);
 assert.doesNotMatch(ux,/loadCommunityRoutes/,'community focus should reuse the existing social runtime');
});

test('UX cleanup browser module is syntax valid',()=>{
 execFileSync(process.execPath,['--check','ux-cleanup.js'],{stdio:'pipe'});
});
