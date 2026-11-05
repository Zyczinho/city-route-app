import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('PWA cache and entrypoint versions change with navigation hotfix',async()=>{
 const [html,worker,build,app]=await Promise.all([
  read('index.html'),read('service-worker.js'),read('scripts/build.mjs'),read('app.js')
 ]);
 assert.match(html,/sw-update\.js\?v=1/);
 assert.match(html,/nav-enhancements\.js\?v=4/);
 assert.match(worker,/city-route-v63/);
 assert.match(worker,/nav-enhancements\.js\?v=4/);
 assert.match(worker,/sw-update\.js\?v=1/);
 assert.match(build,/'sw-update\.js'/);
 assert.match(app,/!window\.__cityRouteSwBootstrapped/);
 assert.doesNotMatch(worker,/city-route-v32|nav-enhancements\.js\?v=2/);
 assert.doesNotMatch(html,/nav-enhancements\.js\?v=2/);
});

test('service worker navigations are network-first and have an offline fallback',async()=>{
 const worker=await read('service-worker.js');
 assert.match(worker,/if\(e\.request\.mode==='navigate'\)[\s\S]*?fetch\(e\.request\)/);
 assert.match(worker,/cache\.put\('\.\/index\.html'/);
 assert.match(worker,/cache\.match\('\.\/index\.html'\)/);
});

test('service worker updater runs even when app.js fails and reloads once on replacement',async()=>{
 const code=await read('sw-update.js');
 let reloads=0,updates=0,registrations=0;
 const callbacks={};
 const serviceWorker={
  controller:{},
  addEventListener:(name,fn)=>{callbacks[name]=fn;},
  register:async()=>{registrations++;return {update:async()=>{updates++;}};}
 };
 const window={};
 vm.runInNewContext(code,{window,navigator:{serviceWorker},location:{reload:()=>reloads++},console});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(window.__cityRouteSwBootstrapped,true);
 assert.equal(registrations,1);
 assert.equal(updates,1);
 assert.equal(typeof callbacks.controllerchange,'function');
 callbacks.controllerchange();callbacks.controllerchange();
 assert.equal(reloads,1);
});
