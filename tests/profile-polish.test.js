import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('own profile has three distinct real account social counters, not fake local counts',()=>{
 const app=read('app.js'),mod=read('profile-social-stats.js');
 for(const name of ['followers','following','friends'])assert.match(app,new RegExp('data-profile-'+name));
 assert.match(mod,/user_follows/);
 assert.match(mod,/my_friends/);
 assert.match(mod,/friend_status==='accepted'/);
 assert.match(mod,/cityroute:profile-rendered/);
 assert.match(mod,/panel.hidden=true/);
 assert.doesNotMatch(app,/<h2 class="h-sm">Więcej/);
 assert.doesNotMatch(app,/Bez konta\. Profil i aktywność/);
 assert.doesNotMatch(app,/community-card/);
});
test('stats and More are collapsed and account controls live inside More',()=>{
 const app=read('app.js'),auth=read('auth-enhancements.js'),style=read('profile-polish.css');
 assert.match(app,/<details class="profile-disclosure profile-statistics">/);
 assert.match(app,/<details class="profile-disclosure profile-more">/);
 assert.match(app,/profile-more-content/);
 assert.match(auth,/main\.querySelector\('\.profile-more-content'\)/);
 assert.match(auth,/auth-logout-button/);
 assert.doesNotMatch(auth,/<h2>Konto aktywne<\/h2>/);
 assert.match(style,/profile-social-counts/);
});
test('route stop can be removed directly from places and dialogue',()=>{
 const app=read('app.js');
 assert.match(app,/data-action="\$\{added\?'remove':'add'\}"/);
 assert.match(app,/Usuń z Mojej trasy/);
 assert.match(app,/if\(d\?\.open\)openPlace\(id\)/);
 assert.match(app,/Usunięto przystanek z Mojej trasy/);
});
test('all guide groups start collapsed and inactive sponsor input stays disabled',()=>{
 const guide=read('onboarding-guide.js'),app=read('app.js');
 assert.match(guide,/'<details class="guide-group">/);
 assert.doesNotMatch(guide,/index===0\?' open'/);
 assert.match(app,/planner-sponsors-disabled" disabled/);
 assert.match(app,/name="offers" value="no"/);
 assert.doesNotMatch(app,/Pojawią się z kontami, gdy inni zaczną/);
});
test('shared SVG system is consistent and assets shipped in PWA',()=>{
 const saved=read('social-routes-enhancements.js'),requests=read('requests-enhancements.js'),html=read('index.html'),sw=read('service-worker.js'),build=read('scripts/build.mjs');
 assert.match(saved,/icons\/ui\/bookmark\.svg/);
 assert.match(requests,/icons\/ui\/plus\.svg/);
 assert.doesNotMatch(saved,/🔖/);
 for(const v of ['profile-polish.css','profile-social-stats.js'])for(const src of [html,sw,build])assert.ok(src.includes(v),v+' missing');
 assert.match(sw,/city-route-v57/);
 for(const p of ['app.js','auth-enhancements.js','onboarding-guide.js','profile-social-stats.js'])execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
});
