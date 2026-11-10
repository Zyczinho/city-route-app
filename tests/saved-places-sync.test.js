import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncableRef,isPrivateRef,placeSnapshot,mergeLocalSources,compactPending,mergeSaved,recoverSyncQueue,savedSyncUnavailable} from '../saved-places-model.js';
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

test('private places are exported as owner-only display snapshots without device photos',()=>{
 const device={id:'u-1a2b3c4d',cityId:'warsaw',name:'Moja kawiarnia',area:'Saska Kępa',
  lat:52.2,lng:21.1,cats:['jedzenie'],image:'data:image/jpeg;base64,VERY_BIG',
  images:['data:image/png;base64,PRIVATE','https://example.org/photo.jpg']};
 const snap=placeSnapshot(device);
 assert.equal(syncableRef(device.id),true);
 assert.equal(isPrivateRef(device.id),true);
 assert.equal(snap.image,null);
 assert.deepEqual(snap.images,['https://example.org/photo.jpg']);
 const first=mergeSaved({local:{warsaw:[device.id,'barbican']},remote:[],userPlaces:[device],initialized:false});
 assert.equal(first.toInsert.length,2);
 assert.deepEqual(first.toInsert.find(r=>r.place_ref===device.id)?.place_snapshot,snap);
 const second=mergeSaved({local:{warsaw:['azia']},remote:first.toInsert,userPlaces:[],initialized:false});
 assert.deepEqual(new Set(second.byCity.warsaw),new Set(['azia',device.id,'barbican']));
 assert.equal(second.userPlaces.length,1);
 assert.equal(second.userPlaces[0].name,device.name);
 assert.deepEqual(second.toInsert,[row('warsaw','azia')]);
});

test('one-time recovery combines saved places and private snapshots from two local account copies',()=>{
 const a={savedPlacesByCity:{warsaw:['azie','u-abc']},userPlaces:[{id:'u-abc',cityId:'warsaw',name:'Kino'}]};
 const b={savedPlacesByCity:{warsaw:['barbican','azie'],lisbon:['alfama']},userPlaces:[]};
 const merged=mergeLocalSources(a,b);
 assert.deepEqual(merged.savedPlacesByCity,{warsaw:['azie','u-abc','barbican'],lisbon:['alfama']});
 assert.equal(merged.userPlaces.length,1);
 const out=mergeSaved({local:merged.savedPlacesByCity,remote:[],userPlaces:merged.userPlaces,initialized:false});
 assert.deepEqual(new Set(out.byCity.warsaw),new Set(['azie','u-abc','barbican']));
 assert.equal(out.toInsert.length,4);
});

test('private place removal propagates as an explicit deletion, not re-import',()=>{
 const place={id:'u-abc',cityId:'warsaw',name:'Stary punkt'};
 const previous=[{...row('warsaw','u-abc'),place_snapshot:placeSnapshot(place)}];
 const result=mergeSaved({local:{warsaw:[]},remote:previous,userPlaces:[place],
  pending:[{c:'warsaw',p:'u-abc',s:false,t:100}],initialized:false});
 assert.deepEqual(result.toDelete,[row('warsaw','u-abc')]);
 assert.deepEqual(result.byCity.warsaw,[]);
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
 assert.ok(read('index.html').includes('saved-places-sync.js?v=3'));
 assert.match(read('service-worker.js'),/saved-places-model\.js/);
 assert.match(read('scripts/build.mjs'),/'saved-places-sync\.js'/);
});

test('#109: a community route requested while the feed is still loading is rendered, not dropped',()=>{
 const src=read('social-routes-enhancements.js');
 assert.match(src,/if\(rendering\)\{renderAgain=true;return;\}/);
 assert.match(src,/finally\{rendering=false;if\(renderAgain\)\{renderAgain=false;queueRender\(\);\}\}/);
 assert.doesNotMatch(src,/if\(rendering\)return;/);
});


test('V2 upgrade recovers V1 pending changes without trusting its initialized marker',()=>{
 const v1={initialized:true,pending:[{c:'warsaw',p:'azia',s:false,t:2},{c:'krakow',p:'wawel',s:true,t:3}]};
 const recovered=recoverSyncQueue(null,v1);
 assert.equal(recovered.initialized,false);
 assert.deepEqual(recovered.pending.map(x=>[x.c,x.p,x.s]),[['warsaw','azia',false],['krakow','wawel',true]]);
 assert.deepEqual(recoverSyncQueue({initialized:true,pending:[]},v1),{initialized:true,pending:[]});
});

test('phone and desktop account bookmark lists converge without deleting either device saves during recovery',()=>{
 const server=[row('warsaw','barbican')];
 const phone=mergeSaved({local:{warsaw:['barbican','koszyki']},remote:server,initialized:false});
 assert.deepEqual(phone.toDelete,[]);
 const afterPhone=[...server,...phone.toInsert];
 const desktop=mergeSaved({local:{warsaw:['barbican','azia']},remote:afterPhone,initialized:false});
 assert.deepEqual(desktop.toDelete,[]);
 const afterDesktop=[...afterPhone,...desktop.toInsert];
 const phoneRefresh=mergeSaved({local:phone.byCity,remote:afterDesktop,initialized:true});
 const desktopRefresh=mergeSaved({local:desktop.byCity,remote:afterDesktop,initialized:true});
 assert.deepEqual(new Set(phoneRefresh.byCity.warsaw),new Set(['barbican','koszyki','azia']));
 assert.deepEqual(new Set(desktopRefresh.byCity.warsaw),new Set(['barbican','koszyki','azia']));
});

test('an explicit offline unsave wins during first account recovery',()=>{
 const recovered=recoverSyncQueue(null,{initialized:true,pending:[{c:'warsaw',p:'azia',s:false,t:1}]});
 const result=mergeSaved({local:{warsaw:['azia','koszyki']},remote:[row('warsaw','azia')],pending:recovered.pending,initialized:recovered.initialized});
 assert.deepEqual(result.toDelete,[row('warsaw','azia')]);
 assert.deepEqual(result.toInsert,[row('warsaw','koszyki')]);
 assert.deepEqual(result.byCity.warsaw,['koszyki']);
});

test('runtime confirms server writes, guards account scope, and exposes status and retry',()=>{
 const src=read('saved-places-sync.js'),app=read('app.js');
 for(const token of ['city-route-saved-sync-v3:','city-route-saved-sync-v2:','city-route-saved-before-v3:','BACKUP_PREFIX','sameAccount(id)','refs','cityroute:saved-sync-status','cityroute:saved-sync-request','visibilitychange','setInterval']){
  assert.ok(src.includes(token),'missing durability/sync behavior: '+token);
 }
 assert.match(app,/data-saved-sync-status/);
 assert.match(app,/retry-saved-sync/);
 assert.doesNotMatch(src,/setItem\(DATA_KEY/,'the synchronizer must not overwrite app state behind app.js');
});


test('V3 covers private create/delete events and guest import without automatic data leakage',()=>{
 const app=read('app.js'),runtime=read('saved-places-sync.js'),sql=read('supabase/migrations/029_saved_places_private_snapshots.sql');
 assert.match(app,/data-action="merge-guest-saved"/);
 assert.match(app,/cityroute:saved-import-guest/);
 assert.match(app,/userPlaces:next.userPlaces|userPlaces=|userPlaces\}/);
 assert.match(app,/state\.userPlaces\.push\(p\)/);
 assert.match(runtime,/scopedKey\('guest'\)/);
 assert.match(runtime,/guestImport/);
 assert.match(runtime,/place_snapshot/);
 assert.match(sql,/add column if not exists place_snapshot jsonb/i);
 assert.match(sql,/user_saved_places_snapshot_check/);
 assert.match(sql,/octet_length\(place_snapshot::text\)<=16384/);
 assert.match(read('service-worker.js'),/saved-places-sync\.js\?v=3/);
});
