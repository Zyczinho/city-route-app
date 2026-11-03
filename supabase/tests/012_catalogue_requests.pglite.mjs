// Optional integration check for migration 012 on a real Postgres (PGlite, WASM). Not part of npm test: the repo has no dependencies.
// Run from an empty temp folder (never inside the repo):
//   npm init -y && npm install @electric-sql/pglite@0.2.17
//   node <repo>/supabase/tests/012_catalogue_requests.pglite.mjs <repo>/supabase/migrations
// Reuses the 001/003 stub of 011_social_routes.pglite.mjs (same tables, 003 RLS verbatim, Supabase roles, auth.uid(),
// default privileges), adds place_categories, then applies 011 and 012 (012 twice) and replays the REQUESTS.md acceptance.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const DIR=process.argv[2];
const db=new PGlite();
const A='aaaaaaaa-0000-4000-8000-000000000001',B='bbbbbbbb-0000-4000-8000-000000000002',C='cccccccc-0000-4000-8000-000000000003';

const harness011=await readFile(fileURLToPath(new URL('./011_social_routes.pglite.mjs',import.meta.url)),'utf8');
const STUB=harness011.match(/const STUB=`([\s\S]*?)`;/)[1].replace(/\$\{A\}/g,A).replace(/\$\{B\}/g,B)+`
insert into auth.users values ('${C}');
create table public.place_categories(id text primary key,group_id text not null,label_pl text not null,sort_order integer not null default 0,active boolean not null default true);
alter table public.place_categories enable row level security;
create policy categories_read on public.place_categories for select to anon,authenticated using (active);
insert into public.place_categories(id,group_id,label_pl) values ('street_food','food','Street food'),('club','nightlife','Kluby'),('bar','nightlife','Bary');
insert into public.place_categories(id,group_id,label_pl,active) values ('old_cat','food','Old',false);
`;

const as=async(role,uid,fn)=>{
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`);
  try{return await fn();}finally{await db.exec('reset role;');}
};
const q=(sql,params)=>db.query(sql,params).then(r=>r.rows);
const fails=async(p,re,label)=>{try{await p;}catch(e){assert.match(e.message,re,`${label}: ${e.message}`);return;}assert.fail(`${label}: expected failure ${re}`);};
const ok=label=>console.log('  ok',label);
const rank=(city,extra='')=>q(`select * from public.catalogue_requests_ranked('${city}'${extra})`);

await db.exec(STUB);
await db.exec(await readFile(`${DIR}/011_social_routes.sql`,'utf8'));
const mig=await readFile(`${DIR}/012_catalogue_requests.sql`,'utf8');
await db.exec(mig);await db.exec(mig);ok('011 then 012 twice: applies cleanly and re-runs');

let rk,rg,rc;
await as('authenticated',A,async()=>{
  rk=(await q(`select public.create_catalogue_request('warsaw','place','  Kebab   King, Marszałkowska ','street_food','dobry','https://maps.example/k') id`))[0].id;
  rg=(await q(`select public.create_catalogue_request('warsaw','category_gap','Więcej kebabów','street_food') id`))[0].id;
  await fails(q(`select public.create_catalogue_request('warsaw','category_gap','Więcej klubów')`),/category-required/,'category gap needs a category');
  await fails(q(`select public.create_catalogue_request('warsaw','place','x')`),/invalid-title/,'title length');
  await fails(q(`select public.create_catalogue_request('warsaw','place','!!!')`),/invalid-title/,'title without letters');
  await fails(q(`select public.create_catalogue_request('warsaw','wish','Coś')`),/invalid-kind/,'kind');
  await fails(q(`select public.create_catalogue_request('warsaw','place','Bar X','nope')`),/invalid-category/,'unknown category');
  await fails(q(`select public.create_catalogue_request('warsaw','place','Bar X','old_cat')`),/invalid-category/,'inactive category');
  await fails(q(`select public.create_catalogue_request('warsaw','place','Bar X',null,'',$1)`,['javascript:alert(1)']),/invalid-url/,'url scheme');
  await fails(q(`select public.create_catalogue_request('warsaw','place','Bar X',null,$1)`,['x'.repeat(501)]),/invalid-note/,'note length');
  await fails(q(`select public.create_catalogue_request('atlantis','place','Bar X')`),/city-not-found/,'city');
  await fails(q(`update public.catalogue_requests set status='added' where id=$1`,[rk]),/permission denied/,'creator cannot change status');
  await fails(q(`insert into public.catalogue_requests(city_id,request_kind,title,normalized_key,created_by,status) select id,'place','Sneaky','x',$1,'planned' from public.cities where slug='warsaw'`,[A]),/permission denied/,'no direct insert of a non-open request');
  await fails(q(`insert into public.catalogue_requests(city_id,request_kind,title,normalized_key,category_id,created_by) select id,'place','Bypass','x','old_cat',$1 from public.cities where slug='warsaw'`,[A]),/permission denied/,'no direct insert bypassing validation, limit and creator support');
  await fails(q(`insert into public.catalogue_request_supports(request_id,user_id) values($1,$2)`,[rk,A]),/permission denied/,'no direct support insert');
  await fails(q(`delete from public.catalogue_request_supports where request_id=$1`,[rk]),/permission denied/,'no direct support delete');
  await fails(q(`select public.catalogue_request_validate('place','x',null,'',null)`),/permission denied/,'helpers not callable by clients');
});
const [row]=await q(`select title,normalized_key,created_by,status,(select count(*)::int from public.catalogue_request_supports where request_id=r.id) s from public.catalogue_requests r where id=$1`,[rk]);
assert.deepEqual(row,{title:'Kebab King, Marszałkowska',normalized_key:'kebab king marszalkowska',created_by:A,status:'open',s:1});
ok('create validates kind/title/category/url/note/city, normalises the key, creator auto-supports; no direct table writes, no status writes');

await as('anon',null,async()=>{
  const list=await rank('warsaw');
  assert.deepEqual(list.map(r=>[r.id,r.support_count]).sort(),[[rk,1],[rg,1]].sort());
  for(const r of list)for(const k of ['note','source_url','created_by','user_id','email'])assert.ok(!(k in r),`card leaks ${k}`);
  assert.equal((await rank('krakow')).length,0,'Warsaw requests never in Kraków');
  const sim=await q(`select * from public.similar_catalogue_requests('warsaw','kebab king')`);
  assert.equal(sim[0].id,rk);assert.ok(+sim[0].similarity>=0.8);
  assert.deepEqual((await q(`select id from public.similar_catalogue_requests('warsaw','Kebab-King Marszałkowska!')`)).map(r=>r.id)[0],rk,'diacritics/punctuation folded');
  assert.equal((await q(`select * from public.similar_catalogue_requests('warsaw','pizza hut')`)).length,0,'no false duplicates');
  assert.equal((await q(`select * from public.similar_catalogue_requests('krakow','kebab king')`)).length,0,'city-scoped');
  await fails(q(`select * from public.catalogue_request_cards`),/permission denied/,'view closed');
  await fails(q(`select * from public.catalogue_requests`),/permission denied/,'table closed to anon');
  await fails(q(`select * from public.catalogue_request_supports`),/permission denied/,'supports closed to anon');
  await fails(q(`select public.create_catalogue_request('warsaw','place','Anon bar')`),/permission denied/,'anon cannot create');
  await fails(q(`select public.support_catalogue_request($1)`,[rk]),/permission denied/,'anon cannot support');
});
ok('anon: city-scoped safe cards (no note/url/creator/supporters), duplicate lookup, closed tables/view, no writes');

await as('authenticated',B,async()=>{
  assert.equal((await q(`select count(*)::int n from public.catalogue_requests`))[0].n,0,'B cannot read A rows');
  await q(`select public.support_catalogue_request($1)`,[rk]);await q(`select public.support_catalogue_request($1)`,[rk]);
  await fails(q(`insert into public.catalogue_request_supports(request_id,user_id) values($1,$2)`,[rg,C]),/permission denied/,'cannot support as someone else');
  await fails(q(`delete from public.catalogue_requests where id=$1`,[rk]),/permission denied/,'cannot delete A request directly');
  await fails(q(`select public.delete_my_catalogue_request($1)`,[rk]),/not-deletable/,'cannot delete A request via RPC');
  await fails(q(`select public.update_my_catalogue_request($1,'Hijack')`,[rk]),/not-editable/,'cannot edit A request');
  assert.deepEqual((await q(`select * from public.my_catalogue_request_marks(array[$1,$2]::uuid[])`,[rk,rg])).map(m=>[m.supported,m.mine]),[[true,false],[false,false]]);
});
await as('authenticated',C,async()=>{await q(`select public.support_catalogue_request($1)`,[rk]);});
assert.equal((await as('anon',null,()=>rank('warsaw'))).find(r=>r.id===rk).support_count,3);
await as('authenticated',B,async()=>{await q(`select public.unsupport_catalogue_request($1)`,[rk]);await q(`select public.unsupport_catalogue_request($1)`,[rk]);});
assert.equal((await as('anon',null,()=>rank('warsaw'))).find(r=>r.id===rk).support_count,2,'unsupport drops the count once');
ok('B/C support once each (idempotent), only own rows, B unsupports, count follows unique users');

await as('authenticated',A,async()=>{
  await fails(q(`select public.delete_my_catalogue_request($1)`,[rk]),/not-deletable/,'shared demand is preserved');
  await fails(q(`select public.update_my_catalogue_request($1,'Changed','street_food')`,[rk]),/not-editable/,'no edit once others support');
  await fails(q(`update public.catalogue_requests set title='Changed' where id=$1`,[rg]),/permission denied/,'no direct update');
  await q(`select public.update_my_catalogue_request($1,'Więcej kebabów w centrum','street_food')`,[rg]);
  assert.equal((await q(`select normalized_key from public.catalogue_requests where id=$1`,[rg]))[0].normalized_key,'wiecej kebabow w centrum','own unsupported request editable, key follows title');
  await fails(q(`select public.update_my_catalogue_request($1,'Więcej kebabów','old_cat')`,[rg]),/invalid-category/,'edit cannot pick an inactive category');
  await fails(q(`select public.update_my_catalogue_request($1,'Więcej kebabów',null)`,[rg]),/category-required/,'edit keeps category gaps categorised');
  await fails(q(`select public.unsupport_catalogue_request($1)`,[rk]),/creator-support-required/,'creator cannot withdraw the automatic support');
  await fails(q(`select public.unsupport_catalogue_request($1)`,[rg]),/creator-support-required/,'not even on a lone request');
  rc=(await q(`select public.create_catalogue_request('warsaw','place','Klub Y','club') id`))[0].id;
  assert.equal((await q(`select public.delete_my_catalogue_request($1) id`,[rc]))[0].id,rc,'own request without other supporters deletable');
  assert.deepEqual((await q(`select * from public.my_catalogue_request_marks(array[$1]::uuid[])`,[rk])).map(m=>[m.supported,m.mine]),[[true,true]]);
  for(let i=0;i<18;i++)await q(`select public.create_catalogue_request('warsaw','place',$1)`,[`Miejsce ${i}`]);// rk+rg+18 = 20 live (deleted rc no longer counts)
  await fails(q(`select public.create_catalogue_request('warsaw','place','Miejsce 21')`),/rate-limited/,'21st request in 24 h');
});
ok('A: cannot delete/edit shared demand or withdraw own support, edits own unsupported request (validated), deletes own lone request, rate limit 20/24h');

// founder/service operation: status change outside client roles (documented SQL)
await db.exec(`update public.catalogue_requests set status='planned' where id='${rk}'`);
await db.exec(`update public.catalogue_requests set status='added',resolved_place_id=(select id from public.places where slug='w1') where id='${rg}'`);
await as('anon',null,async()=>{
  assert.ok((await rank('warsaw')).some(r=>r.id===rk&&r.status==='planned'),'planned stays in the active list');
  assert.ok(!(await rank('warsaw')).some(r=>r.id===rg),'added leaves the active list');
  for(const st of ['added','declined','all'])assert.ok(!(await rank('warsaw',",null,null,'"+st+"'")).some(r=>['added','declined'].includes(r.status)),'anon cannot enumerate '+st);
  assert.ok((await rank('warsaw',",'category_gap'")).every(r=>r.request_kind==='category_gap'));
  assert.ok((await rank('warsaw',",null,'club'")).every(r=>r.category_id==='club'));
  assert.deepEqual((await rank('warsaw',",null,null,'planned'")).map(r=>r.id),[rk],'status filter within active demand');
  await fails(q('select * from public.my_catalogue_requests()'),/permission denied/,'anon has no own-requests read');
  const newest=await rank('warsaw',",null,null,'active','newest',50");
  assert.ok(newest.every((r,i)=>i===0||+new Date(newest[i-1].created_at)>=+new Date(r.created_at)),'newest sort');
  const popular=await rank('warsaw',",null,null,'active','popular',50");
  assert.ok(popular.every((r,i)=>i===0||popular[i-1].support_count>=r.support_count),'popular sort');
  assert.equal((await rank('warsaw',",null,null,'active','popular',2,1")).length,2,'paging');
});
await as('authenticated',C,async()=>{await fails(q(`select public.support_catalogue_request($1)`,[rg]),/request-not-supportable/,'cannot support an added request');});
await as('authenticated',A,async()=>{
  const mine=await q('select * from public.my_catalogue_requests()');
  const g=mine.find(r=>r.id===rg),k=mine.find(r=>r.id===rk);
  assert.equal(g.status,'added');assert.equal(g.resolved_place_id,'w1','owner sees the resolved place by public id');assert.equal(g.can_edit,false);
  assert.equal(k.status,'planned');assert.equal(k.note,'dobry');assert.equal(k.source_url,'https://maps.example/k');assert.equal(k.support_count,2);
  assert.ok(mine.every(r=>r.city_slug==='warsaw'));
});
await as('authenticated',B,async()=>{assert.ok(!(await q('select * from public.my_catalogue_requests()')).some(r=>r.id===rg||r.id===rk),'others never see A requests, notes or lifecycle');});
ok('public ranking is open/planned only (added/declined/all not enumerable); owner reads own lifecycle, note, link and resolved place');
await as('anon',null,async()=>{assert.deepEqual((await q(`select id from public.catalogue_routes('warsaw')`)).map(r=>r.id),['old-warsaw'],'011 catalogue unaffected');});
console.log('ALL 012 CHECKS PASSED');
