import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
test('iPhone 13 Pro: quick Plan is purpose-first, while all legacy settings survive',()=>{
 const app=read('app.js'),ux=read('ux-cleanup.js');
 assert.match(app,/Odkrywaj miasto po swojemu/);
 assert.match(ux,/Odkrywaj miasto po swojemu/);
 assert.match(ux,/primary\.append\(time\)/);
 assert.match(ux,/whenDetails=disclosure\('Kiedy chcesz zwiedzać\?'/);
 assert.match(ux,/submit\.textContent='Ułóż mi trasę'/);
 assert.match(ux,/form\.replaceChildren\(primary,submit,alternatives,whenDetails\.details,climate\.details,advanced\.details\)/);
 assert.match(ux,/manual\.href='#places'/);
 assert.match(ux,/social\.href='#routes\/community'/);
 assert.match(app,/radio\('time'/);
 for(const name of ['visitDate','startTime','visitMode','interests','transport','food','start','budget','tourist','offers']){
  assert.ok(app.includes(name),'existing feature cannot be removed: '+name);
 }
});
test('mobile CSS guards iPhone native date/time width and route nav active status',()=>{
 const css=read('mobile-first30.css');
 assert.match(css,/\.planner-when-fields\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/input::-webkit-date-and-time-value/);
 assert.match(css,/#navigation a\[href="#my-route"\]:not\(\.active\)/);
 assert.match(css,/#navigation a\[href="#my-route"\]\.active/);
 assert.match(css,/\.ux-submit\{width:100%/);
 const sw=read('service-worker.js'),index=read('index.html'),build=read('scripts/build.mjs');
 assert.match(sw,/city-route-v52/);
 assert.match(sw,/mobile-first30\.css\?v=1/);
 assert.match(index,/mobile-first30\.css\?v=1/);
 assert.match(index,/ux-cleanup\.js\?v=4/);
 assert.match(sw,/ux-cleanup\.js\?v=4/);
 assert.ok(build.includes("'mobile-first30.css'"));
 for(const file of ['app.js','ux-cleanup.js'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
