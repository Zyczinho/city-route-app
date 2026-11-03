import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminRequestsClient,adminRequestFromRow,requestsToCsv,toAdminError,AdminError} from '../admin/admin-client.js';

const R='11111111-2222-4333-8444-555555555555';
const row={id:R,city_slug:'warsaw',request_kind:'place',title:'Kebab King',category_id:'street_food',status:'open',note:'tajna notatka',
  source_url:'https://maps.example/k',resolved_place_id:null,created_at:'2026-11-03T10:00:00Z',updated_at:'2026-11-03T10:00:00Z',
  support_count:104,supports_30d:12,last_supported_at:'2026-11-03T11:00:00Z'};
const fake=(responses={})=>{const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push([name,args]);const r=responses[name];return typeof r==='function'?r(args):r??{data:[],error:null};}}};};

test('admin rows carry the private note/link but never identities, and drop non-http links',()=>{
  const r=adminRequestFromRow(row);
  assert.equal(r.note,'tajna notatka');assert.equal(r.sourceUrl,'https://maps.example/k');assert.equal(r.supports,104);
  for(const k of ['createdBy','userId','supporters','email'])assert.ok(!(k in r));
  assert.equal(adminRequestFromRow({...row,source_url:'javascript:alert(1)'}).sourceUrl,null);
  assert.equal(adminRequestFromRow(null),null);
});

test('ranking request is whitelisted and clamped',async()=>{
  const {client,calls}=fake({admin_catalogue_requests:{data:[row],error:null}});
  const api=createAdminRequestsClient({client});
  assert.equal((await api.loadRequests({citySlug:'warsaw',status:'declined',sort:'recent',kind:'category_gap',category:'club'})).length,1);
  assert.deepEqual(calls[0],['admin_catalogue_requests',{p_city_slug:'warsaw',p_kind:'category_gap',p_category:'club',p_status:'declined',p_sort:'recent',p_limit:100,p_offset:0}]);
  await api.loadRequests({citySlug:'warsaw',status:'bogus',sort:'bogus',kind:'bogus',limit:9999});
  assert.deepEqual(calls[1][1],{p_city_slug:'warsaw',p_kind:null,p_category:null,p_status:'active',p_sort:'popular',p_limit:500,p_offset:0});
  await assert.rejects(api.loadRequests({}),{code:'city-not-found'});
});

test('status changes: lifecycle whitelist, place link only for added',async()=>{
  const {client,calls}=fake({admin_set_catalogue_request_status:{data:R,error:null}});
  const api=createAdminRequestsClient({client});
  await api.setStatus(R,'added',' wawel-castle ');await api.setStatus(R,'declined','wawel-castle');
  assert.deepEqual(calls.map(c=>c[1]),[{p_request_id:R,p_status:'added',p_resolved_place:'wawel-castle'},{p_request_id:R,p_status:'declined',p_resolved_place:null}]);
  await assert.rejects(api.setStatus(R,'merged'),{code:'invalid-status'});
  for(const p of [null,undefined,'','   '])await assert.rejects(api.setStatus(R,'added',p),{code:'place-required'});
  assert.equal(calls.length,2,'invalid requests never reach the server');
  assert.equal(toAdminError({message:'place-required'}).code,'place-required');
});

test('isAdmin is false for non-admins and signed-out users, errors map to codes',async()=>{
  assert.equal(await createAdminRequestsClient(fake({is_app_admin:{data:true,error:null}})).isAdmin(),true);
  assert.equal(await createAdminRequestsClient(fake({is_app_admin:{data:false,error:null}})).isAdmin(),false);
  assert.equal(await createAdminRequestsClient(fake({is_app_admin:{data:null,error:{code:'42501',message:'permission denied for function is_app_admin'}}})).isAdmin(),false);
  assert.equal(toAdminError({message:'forbidden'}).code,'forbidden');
  assert.equal(toAdminError({message:'unknown-place'}).code,'unknown-place');
  assert.equal(toAdminError(new TypeError('Failed to fetch')).code,'network');
  const denied=createAdminRequestsClient(fake({admin_catalogue_requests:{data:null,error:{message:'forbidden'}}}));
  await assert.rejects(denied.loadRequests({citySlug:'warsaw'}),e=>e instanceof AdminError&&e.code==='forbidden');
  assert.throws(()=>createAdminRequestsClient({}),/admin-client-missing/);
});

test('CSV export escapes quotes/commas and neutralises spreadsheet formulas',()=>{
  const csv=requestsToCsv([adminRequestFromRow({...row,title:'=HYPERLINK("http://evil")',note:'a, "b"\nc'}),adminRequestFromRow({...row,title:'-2+3',note:'@SUM(A1)'})]);
  const lines=csv.trim().split('\r\n');
  assert.equal(lines[0].split(',')[0],'Tytuł');
  assert.match(csv,/"'=HYPERLINK\(""http:\/\/evil""\)"/);
  assert.match(csv,/"a, ""b""\nc"/);
  assert.match(csv,/'-2\+3/);assert.match(csv,/'@SUM\(A1\)/);
  assert.ok(csv.endsWith('\r\n'));
});

test('migration 013 and the admin page keep the contract',async()=>{
  const [sql,page,js,build]=await Promise.all(['supabase/migrations/013_app_admins.sql','admin/index.html','admin/admin.js','scripts/build.mjs'].map(p=>readFile(p,'utf8')));
  assert.match(sql,/create table if not exists public\.app_admins/);
  assert.match(sql,/revoke all on public\.app_admins from public,anon,authenticated/);
  assert.doesNotMatch(sql,/create policy[^;]*app_admins/i,'allow-list has no client policy at all');
  assert.doesNotMatch(sql,/insert into public\.app_admins/i,'no admin is created by the migration');
  assert.doesNotMatch(sql,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,'no hard-coded UUID');
  for(const fn of ['admin_catalogue_requests','admin_set_catalogue_request_status'])
    assert.match(sql,new RegExp(`function public\\.${fn}\\([\\s\\S]*?security definer[\\s\\S]*?if not public\\.is_app_admin\\(\\) then raise exception 'forbidden'`),`${fn} must check the allow-list`);
  const ranking=sql.match(/function public\.admin_catalogue_requests[\s\S]*?end \$\$;/)[0];
  assert.doesNotMatch(ranking.split('from public.catalogue_request_cards')[0],/created_by|user_id|email/,'no identities in admin rows');
  assert.match(sql,/if p_status='added' then[\s\S]*?raise exception 'place-required'/,'added requires a place on the server');
  assert.match(sql,/from public,anon,authenticated;/);
  const code=sql.split(/\r?\n/).filter(l=>!l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(code,/grant[^;]*anon[^;]*;/i,'nothing is granted to anon');
  assert.match(page,/noindex/);
  assert.doesNotMatch(js,/from\s*['"][^'"]*\/app\.js['"]/,'admin page is isolated from the app runtime');
  assert.match(js,/esc\(r\.note\)/);assert.match(js,/rel="noopener noreferrer nofollow"/);
  assert.match(build,/'admin'/,'admin page ships in dist');
});
