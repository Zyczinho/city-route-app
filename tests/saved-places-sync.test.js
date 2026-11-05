import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncableRef,compactPending,mergeSaved,savedSyncUnavailable} from '../saved-places-model.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const row=(c,p)=>({city_slug:c,place_ref:p});

test('saved on the phone appears on the desktop (account is the source of truth once synced)',()=>{
 const desktop=mergeSaved({local:{warsaw:['barbican']},remote:[row('warsaw','barbican'),row('warsaw','azia')],initialized:true});
 assert.deepEqual(desktop.byCity,{warsaw:['barbican','azia']});
 assert.deepEqual(desktop.toInsert,[]);
});

test('first sync on a device adds its existing saves to the account instead of dropping them',()=>{
 const r=mergeSaved({local:{warsaw:['barbican','boulevards'],krakow:['wawel']},remote:[row('warsaw','barbican')],initialized:false});
 assert.deepEqual(r.toInsert,[row('warsaw','boulevards'),row('krakow','wawel')]);
 assert.deepEqual(r.byCity,{warsaw:['barbican','boulevards'],krakow:['wawel']});
});

test('removed on another device disappears here; removed here is not re-added by the first sync',()=>{
 const afterRemoteRemoval=mergeSaved({local:{warsaw:['barbican','azia']},remote:[row('warsaw','barbican')],initialized:true});
 assert.deepEqual(afterRemoteRemoval.byCity,{warsaw:['barbican']});
 const removedHere=mergeSaved({local:{warsaw:['barbican']},remote:[row('warsaw','barbican'),row('warsaw','azia')],
  pending:[{c:'warsaw',p:'azia',s:false,t:2}],initialized:false});
 assert.deepEqual(removedHere.toDelete,[row('warsaw','azia')]);
 assert.deepEqual(removedHere.byCity,{warsaw:['barbican']});
});

test('offline changes are queued and the latest change per place wins',()=>{
 const ops=compactPending([{c:'warsaw',p:'azia',s:true,t:1},{c:'warsaw',p:'azia',s:false,t:2},{c:'warsaw',p:'koszyki',s:true,t:3}]);
 assert.deepEqual(ops.map(o=>[o.p,o.s]),[['azia',false],['koszyki',true]]);
 const r=mergeSaved({local:{warsaw:['koszyki']},remote:[row('warsaw','azia')],pending:ops,initialized:true});
 assert.deepEqual(r.toInsert,[row('warsaw','koszyki')]);
 assert.deepEqual(r.toDelete,[row('warsaw','azia')]);
 assert.deepEqual(r.byCity,{warsaw:['koszyki']});
});

test('private places made on one device stay local and are never sent',()=>{
 assert.equal(syncableRef('u-1a2b3c4d'),false);
 assert.equal(syncableRef('barbican'),true);
 assert.equal(syncableRef('bad ref with spaces'),false);
 const r=mergeSaved({local:{warsaw:['u-1a2b3c4d','barbican']},remote:[],initialized:false});
 assert.deepEqual(r.toInsert,[row('warsaw','barbican')]);
 assert.deepEqual(r.byCity,{warsaw:['u-1a2b3c4d','barbican']});
});

test('missing migration keeps local-only behaviour; schema matches the client rules',()=>{
 assert.equal(savedSyncUnavailable({code:'PGRST205',message:"Could not find the table 'public.user_saved_places' in the schema cache"}),true);
 assert.equal(savedSyncUnavailable({code:'42501',message:'permission denied'}),false);
 const sql=read('supabase/migrations/018_user_saved_places.sql');
 assert.match(sql,/primary key \(user_id, city_slug, place_ref\)/);
 assert.match(sql,/place_ref !~ '\^u-'/);
 assert.match(sql,/using \(user_id = \(select auth\.uid\(\)\)\)/);
 assert.doesNotMatch(sql,/to anon/);
});

test('app.js reports saves and applies the merged result; module never writes app state',()=>{
 const app=read('app.js'),runtime=read('saved-places-sync.js');
 assert.match(app,/cityroute:saved-changed',\{detail:\{cityId:city\(\)\.id,placeId:id,saved:!was\}\}/);
 assert.match(app,/addEventListener\('cityroute:saved-synced'/);
 assert.doesNotMatch(runtime,/setItem\(DATA_KEY/);
 assert.match(read('index.html'),/saved-places-sync\.js\?v=1/);
 assert.match(read('service-worker.js'),/saved-places-model\.js/);
 assert.match(read('scripts/build.mjs'),/'saved-places-sync\.js'/);
});

test('#109: a community route requested while the feed is still loading is rendered, not dropped',()=>{
 const src=read('social-routes-enhancements.js');
 assert.match(src,/if\(rendering\)\{renderAgain=true;return;\}/);
 assert.match(src,/finally\{rendering=false;if\(renderAgain\)\{renderAgain=false;queueRender\(\);\}\}/);
 assert.doesNotMatch(src,/if\(rendering\)return;/);
});
