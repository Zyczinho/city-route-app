import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const read=p=>readFile(p,'utf8');

test('UX cleanup makes the planner progressively disclose complexity without changing field names',async()=>{
 const [app,ux]=await Promise.all([read('app.js'),read('ux-cleanup.js')]);
 for(const name of ['time','transport','start'])assert.match(app,new RegExp(`radio\\('${name}'`));
 assert.match(app,/name="interests"/);
 assert.match(app,/name="coffee"/);
 assert.match(ux,/Twój plan na miasto/);
  assert.match(ux,/disclosure\('Co Cię interesuje\?'/);
 assert.match(ux,/disclosure\('Więcej ustawień'/);
 assert.match(ux,/submit\.textContent='Ułóż mi trasę'/);
  assert.match(ux,/form\.replaceChildren\(climate\.details,primary,\.\.\.\(feedback\?\[feedback\]:\[\]\),submit,alternatives,advanced\.details\)/);
 assert.match(ux,/primary\.append\(when\)/);
 assert.match(ux,/manual\.href='#my-route'/);
 assert.match(ux,/form\.before\(choice\)/);
 assert.match(ux,/placesLink\.href='#places'/);
 assert.match(ux,/avoid=field\('avoid'\)/);
 assert.match(ux,/\[transport,coffee,start,avoid\]/);
 assert.match(ux,/social\.href='#routes\/community'/);
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


test('Community detail backlink does not trigger an endless MutationObserver loop',async()=>{
 const source=await read('ux-cleanup.js');
 let href='#routes',label='← Trasy',hrefWrites=0,textWrites=0;
 const back={
  getAttribute:k=>k==='href'?href:null,
  setAttribute:(k,v)=>{if(k==='href'){href=v;hrefWrites++;}},
  get textContent(){return label;},
  set textContent(v){label=v;textWrites++;}
 };
 const root={dataset:{},querySelector:s=>s==='.social-detail .back'?back:null};
 const callbacks=[];
 const context={
  document:{querySelector:s=>s==='#main'?root:null,addEventListener(){}},
  location:{hash:'#community-route/4b04f674-bc2c-4650-ae1e-82f040fc9d9d'},
  window:{addEventListener(){}},
  MutationObserver:class{constructor(cb){callbacks.push(cb);}observe(){}},
  setTimeout(){}
 };
 vm.runInNewContext(source,context);
 assert.equal(href,'#routes/community');
 assert.equal(label,'Społeczność');
 assert.equal(hrefWrites,1);
 assert.equal(textWrites,1);
 for(let i=0;i<10;i++)callbacks.forEach(cb=>cb());
 assert.equal(hrefWrites,1,'back navigation must not rewrite the same URL on every DOM change');
 assert.equal(textWrites,1,'repeated textContent writes previously caused an infinite microtask loop');
});
