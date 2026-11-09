import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {suggestVisitStart} from '../planner-defaults.js';
const read=path=>readFileSync(path,'utf8');
test('one-tap route starts at a future Warsaw-local time, with DST and next-day handling',()=>{
 const morning=suggestVisitStart({now:new Date('2026-11-04T09:53:00Z'),timeZone:'Europe/Warsaw'});
 assert.deepEqual(morning,{date:'2026-11-04',time:'11:30'});
 const night=suggestVisitStart({now:new Date('2026-11-04T20:53:00Z'),timeZone:'Europe/Warsaw'});
 assert.deepEqual(night,{date:'2026-11-05',time:'10:00'});
 const summer=suggestVisitStart({now:new Date('2026-07-01T08:53:00Z'),timeZone:'Europe/Warsaw'});
 assert.deepEqual(summer,{date:'2026-07-01',time:'11:30'});
 const dawn=suggestVisitStart({now:new Date('2026-07-01T03:00:00Z'),timeZone:'Europe/Warsaw'});
 assert.deepEqual(dawn,{date:'2026-07-01',time:'09:00'});
});

test('iPhone 13 Pro: quick Plan is purpose-first, while all legacy settings survive',()=>{
 const app=read('app.js'),ux=read('ux-cleanup.js');
 assert.match(app,/Odkrywaj miasto po swojemu/);
 assert.match(ux,/Twój plan na miasto/);
 assert.match(ux,/primary\.append\(time\)/);
 assert.match(ux,/whenDetails=disclosure\('Kiedy chcesz zwiedzać\?'/);
 assert.match(ux,/submit\.textContent='Ułóż mi trasę'/);
 assert.match(ux,/form\.replaceChildren\(climate\.details,primary,submit,alternatives,whenDetails\.details,advanced\.details\)/);
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
 assert.match(read('styles.css'),/\.variant-d-active-route/);
 assert.match(read('nav-enhancements.js'),/href='#my-route'/);
 assert.match(css,/\.ux-submit\{width:100%/);
 const sw=read('service-worker.js'),index=read('index.html'),build=read('scripts/build.mjs');
 assert.match(sw,/city-route-v\d+/);
 assert.match(sw,/mobile-first30\.css\?v=1/);
 assert.match(index,/mobile-first30\.css\?v=1/);
 assert.match(index,/ux-cleanup\.js\?v=5/);
 assert.match(sw,/ux-cleanup\.js\?v=5/);
 assert.ok(build.includes("'mobile-first30.css'"));
 for(const file of ['app.js','ux-cleanup.js'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});

test('real device fixes keep proportional time chips, city name and separate rating/actions rows',()=>{
 const css=readFileSync(new URL('../mobile-device-polish.css',import.meta.url),'utf8');
 const guide=readFileSync(new URL('../onboarding-guide.js',import.meta.url),'utf8');
 assert.match(css,/\.ux-time \.choice\{display:flex!important;flex-wrap:wrap/);
 assert.match(css,/\.ux-time \.choice label span\{width:auto;min-width:48px/);
 assert.match(css,/\.top \.city-select select\{box-sizing:border-box;width:118px/);
 assert.match(css,/grid-template-areas:"photo info" "actions actions"/);
 assert.match(guide,/GROUP_ICONS/);
 assert.doesNotMatch(guide,/[🧭🗺📍🚶👥🎟]/u);
});
