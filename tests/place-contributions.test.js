import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolveCategory,validateLocalPlace,photoPath,contributionError,createPlaceContributionsClient,BUCKET} from '../place-contributions-client.js';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const place={id:'u-12345678',cityId:'warsaw',name:'Sekretny punkt widokowy',visibility:'public',lat:52.239, lng:21.046,
 cats:['widoki'],description:'Widok na Wisłę',sourceUrl:null};
const fake=()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='my_place_submissions'?[{id:'a',city_slug:'warsaw',name:'X',status:'pending'}]:'01234567-8901-4234-b567-890123456789',error:null};}};
 return {calls,client};
};
test('shared place validates coordinates, privacy and required identity',()=>{
 assert.equal(validateLocalPlace(place),null);
 assert.equal(validateLocalPlace({...place,visibility:'private'}),'not-shared');
 assert.equal(validateLocalPlace({...place,lat:Infinity}),'invalid-coordinates');
 assert.equal(validateLocalPlace({...place,lat:91}),'invalid-coordinates');
 assert.equal(validateLocalPlace({...place,name:'x'}),'invalid-name');
 assert.equal(resolveCategory(place),'viewpoint');
 assert.equal(resolveCategory({...place,cats:['jedzenie']}),'restaurant');
});
test('proposal creates city-scoped, validated RPC; user rating is never sent as published aggregate',async()=>{
 const {client,calls}=fake();
 const result=await createPlaceContributionsClient({client}).submit({...place,rating:5});
 assert.equal(result,'01234567-8901-4234-b567-890123456789');
 assert.equal(calls[0].name,'create_place_submission');
 assert.equal(calls[0].args.p_city_slug,'warsaw');
 assert.equal(calls[0].args.p_category_id,'viewpoint');
 assert.equal(calls[0].args.p_lat,place.lat);
 assert.equal(calls[0].args.p_lng,place.lng);
 assert.ok(!('rating' in calls[0].args));
});
test('photo provenance link is passed to moderation instead of being scraped for a photo',async()=>{
 const {client,calls}=fake();
 await createPlaceContributionsClient({client}).submit({...place,photoSourcePage:'https://www.instagram.com/samplevenue/'});
 assert.equal(calls[0].args.p_source_url,'https://www.instagram.com/samplevenue/');
});
test('my submission state cannot disclose other users and admin approve RPC has only intended params',async()=>{
 const {client,calls}=fake(),api=createPlaceContributionsClient({client});
 assert.equal((await api.mine())[0].cityId,'warsaw');
 await api.review('sub','approve',null);
 assert.equal(calls[1].name,'admin_review_place_submission');
 await assert.rejects(()=>api.review('sub','anything'),e=>e.code==='invalid-action');
});
test('photo requires original JPG, rights confirmation and a bounded payload',async()=>{
 const {client}=fake(),api=createPlaceContributionsClient({client});
 assert.equal(photoPath('uid','sid'),'uid/sid.jpg');
 assert.equal(BUCKET,'city-route-place-photos');
 assert.deepEqual(await api.uploadOwnPhoto('uid','sid',null,true),{uploaded:false});
 await assert.rejects(()=>api.uploadOwnPhoto('uid','sid','data:image/png;base64,AAAA',true),e=>e.code==='invalid-photo-format');
});
test('known backend constraints map to predictable errors',()=>{
 for(const code of ['auth-required','duplicate-place','duplicate-pending','outside-city','forbidden'])
  assert.equal(contributionError(new Error(code)).code,code);
 assert.equal(contributionError({code:'PGRST404',message:'Unknown function'}).code,'network');
});
test('migration locks down all direct writes and moderates via app-admin only',async()=>{
 const sql=await load('supabase/migrations/014_place_submissions.sql');
 for(const term of ['create table if not exists public.place_submissions','alter table public.place_submissions enable row level security',
   'revoke all on public.place_submissions','create or replace function public.create_place_submission',
   'create or replace function public.admin_review_place_submission',
   'if not public.is_app_admin()','create policy city_route_place_photo_insert_own',
   'duplicate-place','duplicate-pending','status=\'pending\'',
   'v.status<>\'pending\'','image_rights_confirmed'])assert.ok(sql.includes(term),'missing SQL guard '+term);
 assert.match(sql,/name ~ '\^\[0-9a-f-\]\{36\}\/\[0-9a-f-\]\{36\}\[\.\]jpg\$'/);
 assert.doesNotMatch(sql,/rate-limited|interval '24 hours'|count\(\*\).*submitted_by=v_user/i,'public community submissions must have no per-user quota');
 assert.match(sql,/pg_advisory_xact_lock\(pg_catalog.hashtextextended\(v\.city_id::text\|\|':'\|\|v\.normalized_key,0\)\)/,'approval must take same per-city and name lock as a new submission');
 assert.match(sql,/s\.status='pending'[\s\S]*s\.normalized_key=v_key/,'pending submissions must also count as duplicates');
 assert.match(sql,/p\.status='published'[\s\S]*p\.visibility='public'[\s\S]*catalogue_request_key\(p\.name\)=v_key/,'already published places must be rejected as duplicates');
 assert.ok(!/grant insert|grant update|grant delete/i.test(sql),'no direct table writes for browser roles');
});
test('UI and PWA bundle shared-place modules without exposing private proposals',async()=>{
 const [app,index,sw,build,runtime,admin]=await Promise.all(['app.js','index.html','service-worker.js','scripts/build.mjs','place-contributions.js','admin/place-submissions.js'].map(load));
 for(const path of ['place-contributions.js','place-contributions-client.js'])assert.ok(build.includes(path));
 for(const path of ['./place-contributions.js?v=2','./place-contributions-client.js'])assert.ok(sw.includes(path));
 assert.match(index,/place-contributions\.js\?v=2/);
 assert.match(sw,/city-route-v60/);
 assert.match(app,/cityroute:place-created/);
 assert.match(app,/cityroute:submission-updated/);
 assert.match(app,/data-community-submit/);
 assert.match(app,/image_rights/);
 assert.match(runtime,/session\?\.user/);
 assert.match(runtime,/submissionStatus:'pending'/);
 assert.match(admin,/api\.review\(/);
 for(const p of ['place-contributions.js','place-contributions-client.js','admin/place-submissions.js']){
  const result=spawnSync(process.execPath,['--check',p],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
  assert.equal(result.status,0,result.stderr||result.stdout);
 }
});
