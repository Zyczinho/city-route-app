import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const read=p=>readFile(p,'utf8');

test('PLAN-UI-MOBILE-006 keeps planner semantics and adds progressive disclosure',async()=>{
 const [app,enhancements]=await Promise.all([read('app.js'),read('enhancements.js')]);
 for(const name of ['time','interests','transport','food','start','budget','tourist','offers']){
  assert.ok(app.includes(`name="${name}"`),`core planner must keep ${name}`);
 }
 assert.match(enhancements,/function simplifyPlanner\(\)/);
 assert.match(enhancements,/planner-primary/);
 assert.match(enhancements,/planner-advanced/);
 assert.match(enhancements,/data-planner-summary/);
 assert.match(enhancements,/\['transport','food','start'\]/);
 assert.match(enhancements,/details\.className='planner-advanced'/);
 assert.match(enhancements,/form\.insertAdjacentElement\('afterend',manual\)/);
 assert.match(enhancements,/overflow-x:auto/,'primary mobile choices should stay compact instead of stacking vertically');
});

test('planner enhancement is idempotent, accessible and syntax-valid',async()=>{
 const enhancements=await read('enhancements.js');
 assert.match(enhancements,/form\.dataset\.mobileSimple==='1'/);
 assert.match(enhancements,/primary\.setAttribute\('aria-label','Najważniejsze ustawienia trasy'\)/);
 assert.match(enhancements,/const observer=new MutationObserver\(\(\)=>\{decorateWhereInput\(\);simplifyPlanner\(\);\}\)/);
 assert.match(enhancements,/document\.addEventListener\('change',[\s\S]*updatePlannerSummary/);
 const syntax=spawnSync(process.execPath,['--check','enhancements.js'],{encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
});
