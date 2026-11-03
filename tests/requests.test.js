import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequestsClient,requestFromRow,requestKey,validateRequest,toRequestsError,RequestsError} from '../requests-client.js';

const R='11111111-2222-4333-8444-555555555555';
const row={id:R,city_slug:'warsaw',request_kind:'place',title:'Kebab King',normalized_key:'kebab king',category_id:'street_food',status:'open',
  resolved_place_id:null,created_at:'2026-11-03T10:00:00Z',updated_at:'2026-11-03T10:00:00Z',support_count:104,supports_30d:12,last_supported_at:'2026-11-03T11:00:00Z'};
const fake=(responses={})=>{const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push([name,args]);const r=responses[name];return typeof r==='function'?r(args):r??{data:[],error:null};}}};};

test('rows become safe application objects',()=>{
  const r=requestFromRow(row);
  assert.deepEqual(r,{id:R,cityId:'warsaw',kind:'place',title:'Kebab King',categoryId:'street_food',status:'open',resolvedPlaceId:null,
    createdAt:'2026-11-03T10:00:00Z',supports:104,supports30d:12,lastSupportedAt:'2026-11-03T11:00:00Z'});
  assert.equal(requestFromRow({...row,similarity:'0.8'}).similarity,0.8);
  assert.equal(requestFromRow(null),null);
  for(const k of ['note','sourceUrl','createdBy','supporters'])assert.ok(!(k in r));
});

test('requestKey folds like catalogue_request_key in migration 012',()=>{
  assert.equal(requestKey('  Kebab-King, Marszałkowska! '),'kebab king marszalkowska');
  assert.equal(requestKey('Więcej KLUBÓW żółć'),'wiecej klubow zolc');
  assert.equal(requestKey('!!!'),'');
});

test('ranking is one city-scoped RPC with whitelisted filters, sorts and a cursor',async()=>{
  const {client,calls}=fake({catalogue_requests_ranked:{data:[row,row],error:null}});
  const api=createRequestsClient({client});
  const page=await api.loadRequests({citySlug:'krakow',kind:'category_gap',category:'club',status:'nonsense',sort:'weird',limit:2,cursor:'2'});
  assert.deepEqual(calls[0],['catalogue_requests_ranked',{p_city_slug:'krakow',p_kind:'category_gap',p_category:'club',p_status:'active',p_sort:'popular',p_limit:2,p_offset:2}]);
  assert.equal(page.requests.length,2);assert.equal(page.nextCursor,'4');
  await api.loadRequests({citySlug:'krakow',kind:'bogus',status:'added',sort:'newest',limit:500});
  assert.deepEqual(calls[1][1],{p_city_slug:'krakow',p_kind:null,p_category:null,p_status:'added',p_sort:'newest',p_limit:50,p_offset:0});
  await assert.rejects(api.loadRequests({}),{code:'city-not-found'});
});

test('duplicate lookup before creating, skipped for empty titles',async()=>{
  const {client,calls}=fake({similar_catalogue_requests:{data:[{...row,similarity:0.8}],error:null}});
  const api=createRequestsClient({client});
  assert.deepEqual(await api.findSimilarRequests({citySlug:'warsaw',title:'!'}),[]);
  assert.equal(calls.length,0);
  const sim=await api.findSimilarRequests({citySlug:'warsaw',title:'kebab king',kind:'place'});
  assert.equal(sim[0].id,R);assert.equal(sim[0].similarity,0.8);
  assert.deepEqual(calls[0],['similar_catalogue_requests',{p_city_slug:'warsaw',p_title:'kebab king',p_kind:'place',p_category:null,p_limit:5}]);
});

test('create validates locally with the same limits as 012, then one RPC',async()=>{
  const {client,calls}=fake({create_catalogue_request:{data:R,error:null}});
  const api=createRequestsClient({client});
  assert.equal(await api.createRequest({citySlug:'warsaw',kind:'place',title:'  Kebab   King ',categoryId:'street_food',note:'dobry',sourceUrl:' https://maps.example/k '}),R);
  assert.deepEqual(calls[0][1],{p_city_slug:'warsaw',p_kind:'place',p_title:'Kebab King',p_category:'street_food',p_note:'dobry',p_source_url:'https://maps.example/k'});
  const base={citySlug:'warsaw',kind:'place',title:'Bar X'};
  assert.equal(validateRequest(base),null);
  assert.equal(validateRequest({...base,kind:'wish'}),'invalid-kind');
  assert.equal(validateRequest({...base,title:'x'}),'invalid-title');
  assert.equal(validateRequest({...base,title:'!!!'}),'invalid-title');
  assert.equal(validateRequest({...base,kind:'category_gap'}),'category-required');
  assert.equal(validateRequest({...base,categoryId:'Bad Cat'}),'invalid-category');
  assert.equal(validateRequest({...base,note:'x'.repeat(501)}),'invalid-note');
  assert.equal(validateRequest({...base,sourceUrl:'javascript:alert(1)'}),'invalid-url');
  assert.equal(validateRequest({...base,citySlug:''}),'city-not-found');
  await assert.rejects(api.createRequest({...base,kind:'category_gap'}),{code:'category-required'});
  assert.equal(calls.length,1,'invalid requests never reach the server');
});

test('support, unsupport, delete and page marks',async()=>{
  const {client,calls}=fake({support_catalogue_request:{data:R,error:null},unsupport_catalogue_request:{data:R,error:null},delete_my_catalogue_request:{data:R,error:null},
    my_catalogue_request_marks:{data:[{request_id:R,supported:true,mine:false}],error:null}});
  const api=createRequestsClient({client});
  await api.supportRequest(R);await api.unsupportRequest(R);await api.deleteMyRequest(R);
  const marks=await api.loadMyRequestMarks([R,R]);
  assert.deepEqual(calls.map(c=>c[0]),['support_catalogue_request','unsupport_catalogue_request','delete_my_catalogue_request','my_catalogue_request_marks']);
  assert.deepEqual(calls[3][1],{p_request_ids:[R]});
  assert.deepEqual(marks.get(R),{supported:true,mine:false});
  assert.equal((await api.loadMyRequestMarks([])).size,0);
});

test('server errors map to stable codes',async()=>{
  assert.equal(toRequestsError({message:'rate-limited'}).code,'rate-limited');
  assert.equal(toRequestsError({message:'request-not-supportable'}).code,'request-not-supportable');
  assert.equal(toRequestsError({message:'permission denied for function support_catalogue_request',code:'42501'}).code,'forbidden');
  assert.equal(toRequestsError({message:'new row violates row-level security policy'}).code,'forbidden');
  assert.equal(toRequestsError(new TypeError('Failed to fetch')).code,'network');
  const {client}=fake({delete_my_catalogue_request:{data:null,error:{message:'not-deletable',code:'42501'}}});
  await assert.rejects(createRequestsClient({client}).deleteMyRequest(R),e=>e instanceof RequestsError&&e.code==='not-deletable');
  assert.throws(()=>createRequestsClient({}),/client-missing/);
});

test('migration 012 implements the REQUESTS.md contract',async()=>{
  const sql=await readFile('supabase/migrations/012_catalogue_requests.sql','utf8');
  assert.match(sql,/create table if not exists public\.catalogue_requests/);
  assert.match(sql,/request_kind in \('place','category_gap'\)/);
  assert.match(sql,/status in \('open','planned','added','declined'\)/);
  assert.match(sql,/primary key\(request_id,user_id\)/);
  // no mutable counters; aggregate from support rows
  assert.doesNotMatch(sql,/support_count\s+(int|integer)\s/i);
  assert.match(sql,/count\(\*\)::int as support_count/);
  // public cards never carry private fields
  const view=sql.match(/create or replace view public\.catalogue_request_cards as([\s\S]*?);\n/)[1];
  for(const k of ['note','source_url','created_by','user_id','email'])assert.doesNotMatch(view.split('from public.catalogue_requests')[0],new RegExp(`\\b${k}\\b`),`card exposes ${k}`);
  assert.match(sql,/revoke all on public\.catalogue_request_cards from public,anon,authenticated/);
  // status never writable by users; no admin UUID
  assert.match(sql,/grant update \(title,category_id,note,source_url\) on public\.catalogue_requests to authenticated/);
  assert.doesNotMatch(sql,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,'no hard-coded UUIDs');
  // cross-user checks via narrow definers, explicit EXECUTE revokes, creator auto-support
  assert.match(sql,/function public\.catalogue_request_has_other_supporters[\s\S]*?security definer/);
  assert.match(sql,/from public,anon,authenticated;/);
  assert.match(sql,/-- creator counts as a supporter/);
  assert.doesNotMatch(sql,/drop table|drop column|truncate/i);
});
