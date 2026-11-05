import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDraft,addStop,setName} from '../route-builder-model.js';
import {createSocialRoutesClient,communityRouteFromRow,publicProfileFromRow,forkRoute,validatePublish,toSocialError,SocialRoutesError} from '../social-routes-client.js';

const A='aaaaaaaa-0000-4000-8000-000000000001',R='11111111-2222-4333-8444-555555555555';
const row={id:R,city_slug:'warsaw',name:'Mój spacer',description:'Opis',transport:'walking',visibility:'public',status:'published',
  author_id:A,author_nickname:'Ala',published_at:'2026-11-03T10:00:00Z',forked_from_id:null,forked_from_name:null,
  stops:['castle','old-town'],stop_count:2,tags:['local'],save_count:3,saves_30d:2,rating_count:1,rating_avg:4.5,ratings_30d:1,fork_count:1,forks_30d:1,popular_score:13.75};
const fake=(responses={})=>{const calls=[];return {calls,client:{rpc:async(name,args)=>{calls.push([name,args]);const r=responses[name];return typeof r==='function'?r(args):r??{data:[],error:null};}}};};
const draft=(...stops)=>stops.reduce((d,id)=>addStop(d,id).draft,setName(createDraft('warsaw'),'Mój spacer').draft);

test('rows become normalized application objects, never raw rows',()=>{
  const r=communityRouteFromRow(row);
  assert.deepEqual(r.author,{id:A,nickname:'Ala'});
  assert.equal(r.cityId,'warsaw');assert.equal(r.kind,'community');assert.deepEqual(r.cats,['local']);
  assert.deepEqual(r.stats,{saves:3,saves30d:2,ratings:1,ratingAvg:4.5,ratings30d:1,forks:1,forks30d:1,popularScore:13.75});
  assert.equal(communityRouteFromRow({...row,rating_count:0,rating_avg:null}).stats.ratingAvg,null);
  assert.equal(communityRouteFromRow({...row,forked_from_id:'x',forked_from_name:null}).forkedFrom.name,null,'source no longer public');
  assert.ok(!('author_id' in r)&&!('city_slug' in r));
  assert.equal(communityRouteFromRow(null),null);
  const p=publicProfileFromRow({id:A,nickname:'Ala',bio:'Hej',instagram:'ala',tiktok:'',website:'',route_count:2,stay:'visitor'});
  assert.deepEqual(p,{id:A,nickname:'Ala',bio:'Hej',socials:{instagram:'ala',tiktok:'',website:''},routeCount:2,avatarPath:null});
});

test('feed is one city-scoped RPC with clamped paging and a cursor',async()=>{
  const {client,calls}=fake({community_routes:{data:[row,row],error:null}});
  const api=createSocialRoutesClient({client});
  const page=await api.loadCommunityRoutes({citySlug:'krakow',sort:'nonsense',limit:2,cursor:'4'});
  assert.deepEqual(calls,[['community_routes',{p_city_slug:'krakow',p_sort:'popular',p_limit:2,p_offset:4}]]);
  assert.equal(page.routes.length,2);assert.equal(page.nextCursor,'6');
  assert.equal((await api.loadCommunityRoutes({citySlug:'krakow',limit:999})).nextCursor,null);
  assert.equal(calls.at(-1)[1].p_limit,50);
  await assert.rejects(api.loadCommunityRoutes({}),{code:'city-not-found'});
});

test('marks for a whole page come from one call',async()=>{
  const {client,calls}=fake({my_route_marks:{data:[{route_id:R,saved:true,my_rating:5}],error:null}});
  const marks=await createSocialRoutesClient({client}).loadRouteMarks([R,R]);
  assert.deepEqual(calls,[['my_route_marks',{p_route_ids:[R]}]]);
  assert.deepEqual(marks.get(R),{saved:true,rating:5});
  assert.equal((await createSocialRoutesClient({client}).loadRouteMarks([])).size,0);
});

test('save/rate address editorial routes by slug+city and community routes by uuid',async()=>{
  const {client,calls}=fake({save_route:{data:R,error:null},rate_route:{data:R,error:null},unsave_route:{data:R,error:null},remove_rating:{data:R,error:null}});
  const api=createSocialRoutesClient({client});
  await api.saveRoute('old-warsaw','warsaw');await api.saveRoute(R);await api.rateRoute(R,5);await api.unsaveRoute(R);await api.removeRating(R);
  assert.deepEqual(calls.map(c=>c[0]),['save_route','save_route','rate_route','unsave_route','remove_rating']);
  assert.deepEqual(calls[0][1],{p_city_slug:'warsaw',p_ref:'old-warsaw'});
  assert.deepEqual(calls[2][1],{p_city_slug:null,p_ref:R,p_rating:5});
  await assert.rejects(api.rateRoute(R,6),{code:'invalid-rating'});
  await assert.rejects(api.rateRoute(R,4.5),{code:'invalid-rating'});
  assert.equal(calls.length,5,'invalid ratings never reach the server');
});

test('publish validates locally with the same limits as migration 011, then sends one atomic RPC',async()=>{
  const {client,calls}=fake({publish_community_route:{data:R,error:null}});
  const api=createSocialRoutesClient({client});
  assert.equal(await api.publishRoute({draft:draft('castle','old-town'),description:'Opis',tags:['local','local'],forkedFrom:{cityId:'warsaw',ref:A}}),R);
  assert.deepEqual(calls[0],['publish_community_route',{p_city_slug:'warsaw',p_name:'Mój spacer',p_stops:['castle','old-town'],p_transport:'walking',
    p_description:'Opis',p_tags:['local'],p_visibility:'public',p_route_id:null,p_forked_from:A}]);
  assert.equal(validatePublish({draft:draft('castle')}),'invalid-stop-count');
  assert.equal(validatePublish({draft:createDraft('warsaw')}),'invalid-name');
  assert.equal(validatePublish({draft:draft('a','b'),visibility:'private'}),'invalid-visibility');
  assert.equal(validatePublish({draft:draft('a','b'),tags:['Bad Tag']}),'invalid-tags');
  assert.equal(validatePublish({draft:draft('a','b'),description:'x'.repeat(501)}),'invalid-description');
  await assert.rejects(api.publishRoute({draft:draft('castle')}),{code:'invalid-stop-count'});
  assert.equal(calls.length,1);
});

test('server errors map to stable codes',async()=>{
  assert.equal(toSocialError({message:'unknown-stop:w9'}).code,'unknown-stop');
  assert.equal(toSocialError({message:'unknown-stop:w9'}).detail,'w9');
  assert.equal(toSocialError({message:'new row violates row-level security policy for table "route_ratings"'}).code,'forbidden');
  assert.equal(toSocialError({code:'42501',message:'permission denied for function save_route'}).code,'forbidden');
  assert.equal(toSocialError({message:'auth-required'}).code,'auth-required');
  assert.equal(toSocialError(new TypeError('Failed to fetch')).code,'network');
  const {client}=fake({archive_community_route:{data:null,error:{message:'not-owner',code:'42501'}}});
  await assert.rejects(createSocialRoutesClient({client}).archiveRoute(R),e=>e instanceof SocialRoutesError&&e.code==='not-owner');
  assert.throws(()=>createSocialRoutesClient({}),/client-missing/);
});

test('fork is local and keeps provenance for public community and editorial sources',async()=>{
  const community=communityRouteFromRow(row);
  const f=forkRoute(community,{cityId:'warsaw',isKnown:id=>id!=='old-town'});
  assert.equal(f.draft.name,'Kopia: Mój spacer');assert.deepEqual(f.draft.stops,['castle']);assert.deepEqual(f.report.dropped,['old-town']);
  assert.deepEqual(f.forkedFrom,{cityId:'warsaw',ref:R},'community source by UUID');
  const editorial=forkRoute({id:'old-warsaw',cityId:'warsaw',name:'Pierwsze',stops:['castle'],transport:'walking'},{cityId:'warsaw'});
  assert.deepEqual(editorial.forkedFrom,{cityId:'warsaw',ref:'old-warsaw'},'editorial source by slug');
  assert.equal(forkRoute({...community,visibility:'unlisted'},{cityId:'warsaw'}).forkedFrom,null,'unlisted source is never recorded');
  assert.equal(forkRoute({...community,status:'archived'},{cityId:'warsaw'}).forkedFrom,null,'archived source is never recorded');
  assert.throws(()=>forkRoute(community,{cityId:'krakow'}),{code:'cross-city'});
  assert.deepEqual([...community.stops],['castle','old-town'],'source untouched');
  // publishing the fork sends the reference; the server resolves and validates it
  const {client,calls}=fake({publish_community_route:{data:R,error:null}});
  const api=createSocialRoutesClient({client});
  const fork=setName(addStop(addStop(createDraft('warsaw'),'castle').draft,'old-town').draft,'Kopia').draft;
  await api.publishRoute({draft:fork,forkedFrom:editorial.forkedFrom});
  await api.publishRoute({draft:fork,forkedFrom:f.forkedFrom});
  await api.publishRoute({draft:fork,forkedFromRouteId:R});
  await api.publishRoute({draft:fork});
  assert.deepEqual(calls.map(c=>c[1].p_forked_from),['old-warsaw',R,R,null]);
});

test('migration 011 implements the reviewed contract',async()=>{
  const sql=await readFile('supabase/migrations/011_social_routes.sql','utf8');
  // 1 editorial catalogue only
  assert.match(sql,/function public\.catalogue_routes\(city_slug text\)[\s\S]*?r\.route_type='editorial'/);
  // 2 nickname via definer RPCs; profiles RLS untouched; no stay/email in the read model
  assert.doesNotMatch(sql,/policy[^;]*on public\.profiles/i);
  const view=sql.match(/create or replace view public\.community_route_cards as([\s\S]*?);\r?\n/)[1];
  assert.doesNotMatch(view,/\bstay\b|email/i);
  assert.match(sql,/revoke all on public\.community_route_cards from public,anon,authenticated/);
  for(const fn of ['community_routes','community_route','author_routes','public_profile','saved_routes'])
    assert.match(sql,new RegExp(`function public\\.${fn}\\([\\s\\S]*?set search_path=''[\\s\\S]*?security definer`),`${fn} must be a definer with empty search_path`);
  // 3 unlisted by direct link only; cards never reveal an unlisted fork source; route_ref resolves public routes only
  assert.match(sql,/c\.visibility in \('public','unlisted'\)/);
  assert.match(view,/src\.id as forked_from_id/);
  assert.match(view,/left join public\.routes src on src\.id=r\.forked_from_route_id and src\.status='published' and src\.visibility='public'/);
  assert.match(sql,/function public\.route_ref[\s\S]*?and r\.status='published' and r\.visibility='public'/);
  assert.match(sql,/p_forked_from text default null/,'fork source is a reference: editorial slug or community uuid');
  // 4 atomic publish, invoker
  assert.match(sql,/function public\.publish_community_route[\s\S]*?language plpgsql volatile as/);
  assert.doesNotMatch(sql.match(/function public\.publish_community_route[\s\S]*?end \$\$;/)[0],/security definer/);
  // 5 one route reference
  assert.match(sql,/function public\.route_ref\(p_city_slug text,p_ref text\)/);
  // 6 owner-only rows, no self-rating, writes not executable by anon
  assert.match(sql,/owner_user_id is distinct from \(select auth\.uid\(\)\)/);
  assert.match(sql,/from public,anon,authenticated;/);
  // 7 fork provenance
  assert.match(sql,/forked_from_route_id uuid references public\.routes\(id\) on delete set null/);
  // forward-only and re-runnable
  assert.doesNotMatch(sql,/drop table|drop column|truncate|delete from public\.(routes|places)\b(?![\s\S]{0,40}owner_user_id)/i);
  assert.match(sql,/create table if not exists public\.route_saves/);
  assert.doesNotMatch(sql,/create trigger(?! route_ratings_set_updated_at)/,'no counter triggers');
});
