import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {GUIDE_GROUPS,GUIDE_TOPIC_COUNT} from '../onboarding-content.js';
import {guideView,filterGuide} from '../onboarding-guide.js';

test('the permanent guide explains what City Route is and every live core section',()=>{
 assert.equal(GUIDE_GROUPS.length,6);
 assert.equal(GUIDE_TOPIC_COUNT,34,'founder requested every major feature');
 const html=guideView();
 for(const s of ['Po co jest City Route?','Poradnik City Route','GDZIE TO JEST?',
  'Ważne na etapie beta','data-guide-topic','guide-search','Zarezerwuj',
  'Zapisz lub odznacz miejsce','Znajomi','Przenieś dane gościa']){
  assert.ok(html.includes(s),'missing useful explanation: '+s);
 }
 assert.equal((html.match(/data-guide-topic/g)||[]).length,GUIDE_TOPIC_COUNT);
 const quickLinks=[...html.matchAll(/class="help-row" href="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(quickLinks,['#plan','#routes','#places','#my-route','#routes/community','#book']);
});
test('each feature explains reason, precise location, steps and a real destination',()=>{
 const valid=new Set(['#plan','#places','#my-route','#routes','#routes/community',
  '#social-saved','#add-place','#sources','#routes/community/friends',
  '#routes/community/groups','#events','#book','#profile']);
 for(const group of GUIDE_GROUPS){
  assert.ok(group.title&&group.items.length);
  for(const [name,where,why,steps,href] of group.items){
   assert.ok(name.length>6&&where.length>=5&&why.length>20,name);
   assert.ok(Array.isArray(steps)&&steps.length>=2,'steps missing: '+name);
   assert.ok(valid.has(href),'broken deep-link to '+href);
  }
 }
});
test('guide search filters content without affecting the app hash router',()=>{
 const make=(text)=>({textContent:text,hidden:false});
 const a=make('Jak zapisać miejsce'),b=make('Znajomi i zaproszenia'),c=make('Jak planować trasę');
 const group=(items)=>({hidden:false,open:false,querySelectorAll:s=>s==='[data-guide-topic]'?items:[]});
 const g1=group([a,c]),g2=group([b]),counter={hidden:true,textContent:''};
 const root={querySelectorAll:s=>s==='.guide-group'?[g1,g2]:[],querySelector:s=>s==='[data-guide-count]'?counter:null};
 assert.equal(filterGuide(root,'znajomi'),1);
 assert.equal(a.hidden,true);
 assert.equal(b.hidden,false);
 assert.equal(g1.hidden,true);
 assert.equal(g2.open,true);
 assert.equal(counter.hidden,false);
 assert.equal(filterGuide(root,'zzz not present'),0);
 assert.match(counter.textContent,/Nie znaleziono tematu/);
 assert.equal(filterGuide(root,''),3);
 assert.equal(g1.hidden,false);
 assert.equal(counter.hidden,true);
});
test('guide assets are present in build and offline cache; navbar has exactly six destinations',()=>{
 const nav=readFileSync('nav-enhancements.js','utf8');
 const app=readFileSync('app.js','utf8');
 const index=readFileSync('index.html','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 const sw=readFileSync('service-worker.js','utf8');
 const css=readFileSync('onboarding-guide.css','utf8');
 assert.match(nav,/desiredNav=\['#plan','#routes','#my-route','#routes\/community','#places','#about'\]/);
 assert.match(app,/\['about','library','Poradnik'\]/);
 assert.match(app,/about:'about'/);
 assert.match(app,/function aboutView\(\)\{return guideView\(\);\}/);
 for(const name of ['onboarding-guide.js','onboarding-content.js','onboarding-guide.css']){
  assert.ok(build.includes(name),'missing from production build: '+name);
  assert.ok(sw.includes(name),'not offline: '+name);
 }
 assert.match(index,/onboarding-guide\.css\?v=1/);
 assert.match(index,/nav-enhancements\.js\?v=4/);
 assert.match(sw,/city-route-v51/);
 assert.match(css,/#navigation\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/guide-group\[hidden\].*display:none/);
 for(const p of ['onboarding-guide.js','onboarding-content.js','app.js','nav-enhancements.js'])
  execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
});
