import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ICON_NAMES,iconMarkup} from '../ui-icons.js';
import {GUIDE_GROUPS} from '../onboarding-content.js';
import {guideView} from '../onboarding-guide.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sourceModules=['app.js','onboarding-guide.js','onboarding-content.js',
 'photo-fallback.js','ux-cleanup.js','place-composer.js','social-routes-enhancements.js',
 'community-enhancements.js','place-reviews.js','requests-enhancements.js','first-launch.js'];

test('Lucide icon inventory is complete, local, unique and stroke-consistent',()=>{
 assert.equal(new Set(ICON_NAMES).size,ICON_NAMES.length,'icon paths must be unique');
 for(const name of ICON_NAMES){
  const path=new URL('../assets/icons/ui/'+name+'.svg',import.meta.url);
  assert.ok(existsSync(path),'Missing local icon: '+name);
  const data=read('assets/icons/ui/'+name+'.svg');
  assert.match(data,/<svg/);
  assert.match(data,/viewBox="0 0 24 24"/);
  assert.match(data,/stroke="currentColor"/);
  assert.match(data,/stroke-width="2"/);
 }
 assert.ok(ICON_NAMES.includes('chevron-down'),'profile accordion was missing this SVG');
 assert.equal(iconMarkup('heart'),'<span class="i" style="--i:url(./assets/icons/ui/heart.svg)" aria-hidden="true"></span>');
 assert.match(iconMarkup('camera','missing-photo'),/class="i missing-photo"/);
 assert.throws(()=>iconMarkup('../../malicious'),/Unknown City Route icon/);
 assert.throws(()=>iconMarkup('camera','unsafe" onclick="alert(1)'),/Invalid icon class/);
});
test('no emojis or decorative Unicode-as-icon remain in first-run UI modules',()=>{
 const forbidden=/[📍🧭🚶👥🔐🗺♡⑂◎◫⌄›‹★✓]/u;
 for(const path of sourceModules)assert.doesNotMatch(read(path),forbidden,path+' contains glyph in place of SVG');
 assert.ok(GUIDE_GROUPS.every(g=>ICON_NAMES.includes(g.icon)),'every guide category must resolve to a real Lucide icon');
});
test('all iconic call sites in the primary app resolve to existing assets',()=>{
 const src=read('app.js');
 for(const match of src.matchAll(/\bic\(['"]([a-z0-9-]+)['"]\)/g))
  assert.ok(ICON_NAMES.includes(match[1]),'App icon '+match[1]+' has no asset');
 assert.match(src,/const ic=iconMarkup;/);
});
test('guide, place search, planner, photo fallback and community use SVG rather than glyphs',()=>{
 const html=guideView();
 assert.match(html,/assets\/icons\/ui\/chevron-right\.svg/);
 assert.doesNotMatch(html,/[›⌄]/);
 for(const [path,pattern] of [
  ['place-composer.js',/iconMarkup\('camera'\)/],
  ['photo-fallback.js',/iconNode\('camera'\)/],
  ['ux-cleanup.js',/UX_CHEVRON.*chevron-right\.svg/],
  ['social-routes-enhancements.js',/iconMarkup\('heart'\)/],
  ['social-routes-enhancements.js',/iconMarkup\('shuffle'\)/],
  ['place-reviews.js',/labeledIcon\(badge,'star',txt\)/],
  ['requests-enhancements.js',/iconMarkup\("chevron-right"\)/],
  ['community-enhancements.js',/BACK_ICON.*arrow-left\.svg/]
 ])assert.match(read(path),pattern,path);
});
test('PWA includes icon renderer, CSS, missing SVGs and correct module version bumps',()=>{
 const html=read('index.html'),sw=read('service-worker.js'),build=read('scripts/build.mjs');
 assert.match(sw,/city-route-v60/);
 assert.match(html,/ui-icons\.css\?v=1/);
 for(const path of ['ui-icons.css','ui-icons.js']){assert.ok(build.includes(path));assert.ok(sw.includes(path));}
 for(const name of ['chevron-down','minus','heart'])assert.ok(sw.includes('assets/icons/ui/'+name+'.svg'),'missing offline icon '+name);
 for(const [file,v] of [['photo-fallback.js','2'],['place-composer.js','4'],['social-routes-enhancements.js','8'],['place-reviews.js','3'],['requests-enhancements.js','3'],['ux-cleanup.js','5'],['community-enhancements.js','21'],['first-launch.js','2']]){
  assert.ok(html.includes(file+'?v='+v),'new JS not versioned in HTML: '+file);
  assert.ok(sw.includes(file+'?v='+v),'new JS not cached: '+file);
 }
 for(const path of [...sourceModules,'ui-icons.js'])execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});
