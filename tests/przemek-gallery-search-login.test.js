import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MAX_PLACE_PHOTOS,photoFileProblem,sanitizePhotoCrop,photoCropGeometry,withCoverFirst} from '../place-photo-model.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('five photos only, safe file validation and retained originals for nondestructive cropping',()=>{
 assert.equal(MAX_PLACE_PHOTOS,5);
 assert.equal(photoFileProblem({type:'image/jpeg',size:2_000_000}),null);
 assert.equal(photoFileProblem({type:'image/svg+xml',size:3000}),'format');
 assert.equal(photoFileProblem({type:'image/png',size:11*1024*1024}),'size');
 assert.equal(photoFileProblem({type:'image/webp',size:0}),'size');
 const crop=sanitizePhotoCrop({ratio:'16:9',x:-15,y:150,zoom:10});
 assert.deepEqual(crop,{ratio:'16:9',x:0,y:100,zoom:2.5});
 assert.deepEqual(sanitizePhotoCrop({ratio:'x',x:50,y:50,zoom:1}),{ratio:'4:3',x:50,y:50,zoom:1});
 const source=[{id:'a',source:'jpeg-a'},{id:'b',source:'jpeg-b'},{id:'c',source:'jpeg-c'}];
 const result=withCoverFirst(source,'c');
 assert.deepEqual(result.map(p=>p.id),['c','a','b']);
 assert.deepEqual(source.map(p=>p.id),['a','b','c'],'original order unchanged');
});
test('crop geometry produces actual aspect ratios and respects x/y without altering the stored source',()=>{
 const wide=photoCropGeometry(1600,900,{ratio:'4:3',x:50,y:50,zoom:1},900);
 assert.deepEqual({width:wide.width,height:wide.height},{width:900,height:675});
 assert.equal(wide.drawWidth,1200);
 assert.equal(wide.dx,-150);
 const shift=photoCropGeometry(1600,900,{ratio:'4:3',x:100,y:50,zoom:1},900);
 assert.equal(shift.dx,-300);
 const square=photoCropGeometry(1600,900,{ratio:'1:1',x:50,y:50,zoom:1},900);
 assert.equal(square.height,900);
 assert.equal(square.dx,-350);
 const narrow=photoCropGeometry(1600,900,{ratio:'16:9',x:50,y:50,zoom:1},900);
 assert.equal(narrow.height,506);
 assert.throws(()=>photoCropGeometry(0,100),/invalid-photo-dimensions/);
});
test('multi-upload, cover choice, remove and public rights are all connected to the saved local place',()=>{
 const src=read('app.js');
 for(const part of ['MAX_PLACE_PHOTOS','photoFileProblem(file)','cropPlacePhoto(p.source,p.crop)','multiple data-action="photo"','data-action="cover-place-photo"','data-action="remove-place-photo"','data-photo-crop="ratio"','data-photo-crop="zoom"','images:localImages','image:localImages[0]','d.vis!==\'public\''])assert.ok(src.includes(part),'missing gallery behavior '+part);
 assert.match(src,/imageRightsConfirmed:draft.vis==='public'&&localImages.length>0&&!!draft.imageRights/);
 assert.match(src,/data-photo-rights/);
 assert.match(src,/place-own-gallery/);
 assert.match(src,/data-action="view-own-photo"/);
 assert.match(src,/Obecnie udostępniamy społeczności zdjęcie główne/);
 const backend=read('place-contributions.js');
 assert.match(backend,/api.uploadOwnPhoto\(session.user.id,submissionId,place.image,true\)/,'only the consented cover is sent to existing server');
 const css=read('place-photo-gallery.css');
 assert.match(css,/max-width:360px/);
 assert.match(css,/data-photo-rights\]\[hidden\]/);
 assert.match(css,/min-height:44px/);
});
test('search offers a prefilled Add Place only when city results are empty, not on loading',()=>{
 const src=read('app.js'),composer=read('place-composer.js');
 assert.match(src,/data-action="suggest-add-place"/);
 assert.match(src,/draft=\{name,cat:'okolice',vis:'private'/);
 assert.match(src,/catalog\(\)\.some\(p=>matches\(placeHay\(p\),query\)\)/);
 assert.match(composer,/!local.length&&!found.length\?\[customOption\(query\)\]/);
 assert.match(composer,/renderList\(form,local\);/,'initial autocomplete list must not show add-place before provider resolves');
 assert.match(composer,/if\(!r\|\|!r.ok\)/);
});
test('success message is shown once across login redirect/scope reload and not on normal navigation',()=>{
 const src=read('auth-enhancements.js');
 for(const x of ['LOGIN_TOAST_KEY','markLoginSuccess(session.user.id)','event===\'SIGNED_IN\'','clearLoginSuccess()','sessionStorage.removeItem(LOGIN_TOAST_KEY)','Zalogowano pomyślnie','setTimeout(showLoginSuccess,350)','setTimeout(showLoginSuccess,450)'])assert.ok(src.includes(x),'missing success toast handling: '+x);
 assert.match(src,/if\(pending!==String\(session.user.id\)\)return/);
 assert.match(src,/sessionStorage.getItem\(LOGIN_TOAST_KEY\)/);
 const html=read('index.html');assert.match(html,/id="toast" role="status"/);
});
test('release ships all gallery code/css and refreshed modules offline',()=>{
 const html=read('index.html'),sw=read('service-worker.js'),build=read('scripts/build.mjs');
 for(const file of ['place-photo-gallery.css','place-photo-model.js']){assert.ok(sw.includes(file),file+' missing from cache');assert.ok(build.includes(file),file+' missing from build');}
 assert.ok(html.includes('place-photo-gallery.css?v=2'));
 assert.match(html,/auth-enhancements\.js\?v=23/);
 assert.match(html,/place-composer\.js\?v=5/);
 assert.match(sw,/city-route-v64/);
 for(const file of ['app.js','auth-enhancements.js','place-composer.js','place-photo-model.js'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
