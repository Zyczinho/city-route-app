import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(p,'utf8');

test('single-day date/time and museum entrance mode survive compact planner cleanup',async()=>{
 const [app,ux,core]=await Promise.all([read('app.js'),read('ux-cleanup.js'),read('core.js')]);
 for(const field of ['visitDate','startTime'])assert.match(app,new RegExp('name="'+field+'"'));
 assert.match(app,/radio\('visitMode'/);
 assert.match(ux,/when=field\('visitDate'\)/);
 assert.match(ux,/whenDetails\.body\.append\(when\)/);
 assert.match(ux,/visitMode,transport/);
 assert.match(core,/timeFeasible\(\[\.\.\.result,p\]\)/);
 assert.match(app,/generatedTimingView\(ps\)/);
 assert.match(app,/maxMinutes:Number\(chosenPrefs.time\)/);
});
test('Google signin retains existing password auth, uses Supabase OAuth with PKCE and explicit redirect',async()=>{
 const [auth,client]=await Promise.all([read('auth-enhancements.js'),read('supabase-client.js')]);
 assert.match(auth,/signInWithPassword/);
 assert.match(auth,/auth\.signUp/);
 assert.match(auth,/data-auth-action="google"/);
 assert.match(auth,/signInWithOAuth\(\{/);
 assert.match(auth,/provider:'google'/);
 assert.match(auth,/redirectTo:location\.origin\+location\.pathname/);
 assert.match(client,/detectSessionInUrl:true,flowType:'pkce'/);
 assert.doesNotMatch(auth,/service_role|client_secret|provider_token/);
});
test('one-time onboarding can be skipped without login or forced geolocation',async()=>{
 const [welcome,html,css,build,sw]=await Promise.all([read('first-launch.js'),read('index.html'),read('first-launch.css'),read('scripts/build.mjs'),read('service-worker.js')]);
 assert.match(welcome,/city-route-first-launch-v1/);
 assert.match(welcome,/data-intro="skip"/);
 assert.match(welcome,/data-intro="plan"/);
 assert.match(welcome,/data-intro="places"/);
 assert.match(welcome,/localStorage\.setItem\(SEEN_KEY,'1'\)/);
 assert.doesNotMatch(welcome,/signInWithOAuth|getCurrentPosition/);
 for(const file of ['first-launch.js','first-launch.css','opening-hours.js'])assert.ok(build.includes(file),file);
 assert.match(html,/first-launch\.css/);
 assert.match(html,/first-launch\.js\?v=1/);
 assert.match(sw,/city-route-v60/);
 assert.ok(css.includes('.welcome-overlay'));
});
test('new modules are syntax valid',()=>{
 for(const file of ['opening-hours.js','first-launch.js','auth-enhancements.js','app.js','core.js','ux-cleanup.js']){
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
 }
});
