import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
 ACTIVE_KEY,DATA_KEY,scopedKey,activateLocalScope,newAccountState,
 guestImportAvailable,importGuestActivity,isGeneratedNickname,friendlyNickname,hasPersonalActivity
} from '../account-scope.js';
class MemoryStorage{
 constructor(){this.items=new Map();}
 getItem(k){return this.items.has(k)?this.items.get(k):null;}
 setItem(k,v){this.items.set(k,String(v));}
 removeItem(k){this.items.delete(k);}
}
const read=(store,k=DATA_KEY)=>JSON.parse(store.getItem(k));
function guestWithActivity(){
 return {...newAccountState('guest'),tester:{id:'oldguest',nickname:'Kuba Founder'},
  events:[{type:'stop_complete',place_id:'waw-1'}],placeReviews:{'waw-1':5},
  userPlaces:[{id:'u-1',name:'Moje miejsce'}],myRoutes:[{id:'mine-1',name:'Spacer'}],
  savedPlacesByCity:{warsaw:['waw-1']}};
}
test('legacy guest data retained while first Google sign in starts blank',()=>{
 const store=new MemoryStorage(),original=guestWithActivity();
 store.setItem(DATA_KEY,JSON.stringify(original));
 const transition=activateLocalScope(store,'google-A');
 assert.equal(transition.changed,true);
 assert.equal(transition.legacyGuestSaved,true);
 assert.equal(store.getItem(ACTIVE_KEY),'user:google-A');
 assert.equal(read(store).tester.id,'google-A');
 assert.equal(read(store).events.length,0);
 assert.deepEqual(read(store,scopedKey('guest')),original);
 assert.equal(guestImportAvailable(store,'google-A'),true);
});
test('A → logout → B → A keeps separate visits/reviews/bookmarks/nicknames',()=>{
 const store=new MemoryStorage();store.setItem(DATA_KEY,JSON.stringify(guestWithActivity()));
 activateLocalScope(store,'google-A');
 let a=read(store);
 a.tester.nickname='A-name';a.placeReviews={'a-spot':4};
 a.events=[{type:'stop_complete',place_id:'a-spot'}];
 a.savedPlacesByCity={warsaw:['a-spot']};store.setItem(DATA_KEY,JSON.stringify(a));
 activateLocalScope(store,null);
 assert.equal(read(store).tester.nickname,'Kuba Founder');
 activateLocalScope(store,'google-B');
 let b=read(store);assert.equal(b.tester.id,'google-B');
 assert.equal(b.events.length,0);assert.deepEqual(b.placeReviews,{});
 assert.equal(guestImportAvailable(store,'google-B'),true);
 b.tester.nickname='B-name';b.placeReviews={'b-spot':2};
 store.setItem(DATA_KEY,JSON.stringify(b));
 activateLocalScope(store,'google-A');
 assert.equal(read(store).tester.nickname,'A-name');
 assert.deepEqual(read(store).placeReviews,{'a-spot':4});
 assert.deepEqual(read(store).savedPlacesByCity,{warsaw:['a-spot']});
 activateLocalScope(store,'google-B');
 assert.equal(read(store).tester.nickname,'B-name');
 assert.deepEqual(read(store).placeReviews,{'b-spot':2});
});
test('guest import explicitly copies data to empty account, preserves original guest and backup',()=>{
 const store=new MemoryStorage();store.setItem(DATA_KEY,JSON.stringify(guestWithActivity()));
 activateLocalScope(store,'google-A');
 assert.equal(guestImportAvailable(store,'google-A'),true);
 const result=importGuestActivity(store,'google-A');
 assert.equal(result.imported,true);
 assert.equal(read(store).tester.nickname,'Kuba Founder');
 assert.equal(read(store).tester.id,'google-A');
 assert.equal(read(store).events.length,1);
 assert.equal(read(store,scopedKey('guest')).tester.id,'oldguest');
 assert.equal(read(store,result.backupKey).events.length,0);
 assert.equal(guestImportAvailable(store,'google-A'),false);
 activateLocalScope(store,null);
 assert.equal(read(store).tester.id,'oldguest');
});
test('never override an account that has saved its own activity',()=>{
 const store=new MemoryStorage();store.setItem(DATA_KEY,JSON.stringify(guestWithActivity()));
 activateLocalScope(store,'google-B');
 const b=read(store);b.events=[{type:'stop_complete',place_id:'b'}];store.setItem(DATA_KEY,JSON.stringify(b));
 assert.equal(guestImportAvailable(store,'google-B'),false);
 assert.deepEqual(importGuestActivity(store,'google-B'),{imported:false,reason:'not-available'});
 assert.equal(read(store).events[0].place_id,'b');
});
test('scope switch fails closed if localStorage cannot write snapshot',()=>{
 const store=new MemoryStorage();store.setItem(DATA_KEY,JSON.stringify(guestWithActivity()));
 const saved=store.setItem.bind(store);
 store.setItem=(k,v)=>{if(k===scopedKey('guest'))throw Error('quota');return saved(k,v);};
 assert.throws(()=>activateLocalScope(store,'A'),/quota/);
 assert.equal(store.getItem(ACTIVE_KEY),'guest');
 assert.equal(read(store).tester.nickname,'Kuba Founder');
});
test('generated DB nickname is not treated as a user-chosen display name',()=>{
 assert.equal(isGeneratedNickname('u_b88d8c52-232b-4acc-beca-96ab89e4bf63'),true);
 assert.equal(friendlyNickname('u_b88d8c52-232b-4acc-beca-96ab89e4bf63'),false);
 assert.equal(friendlyNickname('Kuba Founder'),true);
 assert.equal(friendlyNickname('Explorer'),false);
 assert.equal(hasPersonalActivity(newAccountState('A')),false);
});
test('card save/unsave and social saved route CSS are wired and run without modal',()=>{
 const app=readFileSync('app.js','utf8');
 const social=readFileSync('social-routes-enhancements.js','utf8');
 const css=readFileSync('social-routes.css','utf8'),style=readFileSync('styles.css','utf8');
 assert.match(app,/data-action="bookmark"/);
 assert.match(app,/class="bookmark-label"/);
 assert.match(app,/savedPlace\(p\)\?'Zapisane':'Zapisz'/);
 assert.match(app,/state\.savedPlacesByCity\[city\(\)\.id\]=was\?/);
 assert.match(social,/function syncSaveButtons\(routeId\)/);
 assert.match(social,/syncSaveButtons\(routeId\);queueRender\(\);/);
 assert.match(css,/\[data-social-action="save"\]\[aria-pressed="true"\]/);
 assert.match(style,/\.place \.side \.save-place\.on/);
});
test('photo fallback and account scope are part of PWA build and cached offline',()=>{
 const sw=readFileSync('service-worker.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 const html=readFileSync('index.html','utf8');
 for(const name of ['account-scope.js','photo-fallback.js']){
  assert.ok(build.includes(name),name+' missing build');
  assert.ok(sw.includes(name),name+' missing service-worker precache');
 }
 assert.match(sw,/city-route-v61/);
 assert.match(html,/auth-enhancements\.js\?v=23/);
 assert.match(html,/social-routes-enhancements\.js\?v=9/);
 assert.match(html,/photo-fallback\.js\?v=2/);
 for(const name of ['account-scope.js','photo-fallback.js','auth-enhancements.js','social-routes-enhancements.js','app.js'])
  execFileSync(process.execPath,['--check',name],{stdio:'pipe'});
});
