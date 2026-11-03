// Optional integration check for migration 013 on a real Postgres (PGlite, WASM). Not part of npm test: the repo has no dependencies.
// Run from an empty temp folder (never inside the repo):
//   npm init -y && npm install @electric-sql/pglite@0.2.17
//   node <repo>/supabase/tests/013_app_admins.pglite.mjs <repo>/supabase/migrations
// Same 001/003 stub as 011_social_routes.pglite.mjs plus place_categories; applies 011, 012, then 013 twice.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const DIR=process.argv[2];
const db=new PGlite();
const A='aaaaaaaa-0000-4000-8000-000000000001',B='bbbbbbbb-0000-4000-8000-000000000002',ADMIN='dddddddd-0000-4000-8000-000000000004';

const harness011=await readFile(fileURLToPath(new URL('./011_social_routes.pglite.mjs',import.meta.url)),'utf8');
const STUB=harness011.match(/const STUB=`([\s\S]*?)`;/)[1].replace(/\$\{A\}/g,A).replace(/\$\{B\}/g,B)+`
insert into auth.users values ('${ADMIN}');
create table public.place_categories(id text primary key,group_id text not null,label_pl text not null,sort_order integer not null default 0,active boolean not null default true);
alter table public.place_categories enable row level security;
create policy categories_read on public.place_categories for select to anon,authenticated using (active);
insert into public.place_categories(id,group_id,label_pl) values ('street_food','food','Street food'),('club','nightlife','Kluby');
`;
const as=async(role,uid,fn)=>{
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`);
  try{return await fn();}finally{await db.exec('reset role;');}
};
const q=(sql,params)=>db.query(sql,params).then(r=>r.rows);
const fails=async(p,re,label)=>{try{await p;}catch(e){assert.match(e.message,re,`${label}: ${e.message}`);return;}assert.fail(`${label}: expected failure ${re}`);};
const ok=label=>console.log('  ok',label);

await db.exec(STUB);
await db.exec(await readFile(`${DIR}/011_social_routes.sql`,'utf8'));
await db.exec(await readFile(`${DIR}/012_catalogue_requests.sql`,'utf8'));
const mig=await readFile(`${DIR}/013_app_admins.sql`,'utf8');
await db.exec(mig);await db.exec(mig);ok('011, 012, then 013 twice: applies cleanly and re-runs');

let rk,rg;
await as('authenticated',A,async()=>{
  rk=(await q(`select public.create_catalogue_request('warsaw','place','Kebab King','street_food','tajna notatka','https://maps.example/k') id`))[0].id;
  rg=(await q(`select public.create_catalogue_request('warsaw','category_gap','Więcej klubów','club') id`))[0].id;
});
await as('authenticated',B,async()=>{await q(`select public.support_catalogue_request($1)`,[rk]);});

// Before anyone is on the allow-list nobody is an admin; the founder adds themself in the SQL editor.
for(const uid of [A,B,ADMIN])await as('authenticated',uid,async()=>{
  assert.equal((await q('select public.is_app_admin() a'))[0].a,false);
  await fails(q(`select * from public.admin_catalogue_requests('warsaw')`),/forbidden/,'not yet admin');
});
await db.exec(`insert into public.app_admins(user_id,note) values ('${ADMIN}','founder')`);
ok('allow-list starts empty; admin is added by SQL, never by a client');

await as('anon',null,async()=>{
  await fails(q('select public.is_app_admin()'),/permission denied/,'anon cannot call is_app_admin');
  await fails(q(`select * from public.admin_catalogue_requests('warsaw')`),/permission denied/,'anon cannot call admin ranking');
  await fails(q('select * from public.app_admins'),/permission denied/,'anon cannot read allow-list');
});
for(const uid of [A,B])await as('authenticated',uid,async()=>{
  assert.equal((await q('select public.is_app_admin() a'))[0].a,false);
  await fails(q(`select * from public.admin_catalogue_requests('warsaw','place',null,'all')`),/forbidden/,'non-admin ranking');
  await fails(q(`select public.admin_set_catalogue_request_status($1,'added')`,[rk]),/forbidden/,'non-admin status change');
  await fails(q('select * from public.app_admins'),/permission denied/,'allow-list unreadable');
  await fails(q(`insert into public.app_admins(user_id) values ($1)`,[uid]),/permission denied/,'cannot add self as admin');
});
ok('anon and normal users: no ranking, no status change, allow-list unreadable and unwritable');

await as('authenticated',ADMIN,async()=>{
  assert.equal((await q('select public.is_app_admin() a'))[0].a,true);
  const list=await q(`select * from public.admin_catalogue_requests('warsaw')`);
  assert.deepEqual(list.map(r=>[r.id,r.support_count]),[[rk,2],[rg,1]],'ranked by supports');
  const k=list.find(r=>r.id===rk);
  assert.equal(k.note,'tajna notatka');assert.equal(k.source_url,'https://maps.example/k');
  for(const r of list)for(const key of ['created_by','user_id','email','supporters'])assert.ok(!(key in r),`admin row leaks ${key}`);
  assert.equal((await q(`select * from public.admin_catalogue_requests('krakow')`)).length,0,'city-scoped');
  assert.deepEqual((await q(`select id from public.admin_catalogue_requests('warsaw','category_gap')`)).map(r=>r.id),[rg]);
  assert.deepEqual((await q(`select id from public.admin_catalogue_requests('warsaw',null,'club')`)).map(r=>r.id),[rg]);
  assert.equal((await q(`select id from public.admin_catalogue_requests('warsaw',null,null,'all','newest')`))[0].id,rg,'newest first');

  await fails(q(`select public.admin_set_catalogue_request_status($1,'merged')`,[rk]),/invalid-status/,'unknown status');
  await fails(q(`select public.admin_set_catalogue_request_status($1,'added')`,[rk]),/place-required/,'added without a place');
  await fails(q(`select public.admin_set_catalogue_request_status($1,'added',null)`,[rk]),/place-required/,'added with a null place');
  await fails(q(`select public.admin_set_catalogue_request_status($1,'added','  ')`,[rk]),/place-required/,'added with a blank place');
  assert.equal((await q(`select * from public.admin_catalogue_requests('warsaw',null,null,'all')`)).find(r=>r.id===rk).status,'open','rejected added leaves the request unchanged');
  await fails(q(`select public.admin_set_catalogue_request_status($1,'added','k1')`,[rk]),/unknown-place/,'place from another city');
  await fails(q(`select public.admin_set_catalogue_request_status($1,'added','wx')`,[rk]),/unknown-place/,'unpublished place');
  await fails(q(`select public.admin_set_catalogue_request_status('00000000-0000-4000-8000-000000000000','planned')`),/request-not-found/,'missing request');
  await q(`select public.admin_set_catalogue_request_status($1,'added','w1')`,[rk]);
  await q(`select public.admin_set_catalogue_request_status($1,'declined')`,[rg]);
  const all=await q(`select * from public.admin_catalogue_requests('warsaw',null,null,'all')`);
  assert.equal(all.find(r=>r.id===rk).status,'added');assert.equal(all.find(r=>r.id===rk).resolved_place_id,'w1');
  assert.equal(all.find(r=>r.id===rg).status,'declined');
  assert.equal((await q(`select * from public.admin_catalogue_requests('warsaw')`)).length,0,'active view drops added/declined');
  await q(`select public.admin_set_catalogue_request_status($1,'planned','w1')`,[rk]);
  assert.equal((await q(`select * from public.admin_catalogue_requests('warsaw')`)).find(r=>r.id===rk).resolved_place_id,null,'non-added status clears the link');
  await q(`select public.admin_set_catalogue_request_status($1,'added','w1')`,[rk]);
});
ok('admin: ranked rows with private note/link and no identities, filters, sorts, validated lifecycle with place link');

await as('authenticated',A,async()=>{
  const mine=await q('select * from public.my_catalogue_requests()');
  assert.equal(mine.find(r=>r.id===rk).status,'added');assert.equal(mine.find(r=>r.id===rk).resolved_place_id,'w1');
  assert.equal(mine.find(r=>r.id===rg).status,'declined');
});
await as('anon',null,async()=>{
  assert.equal((await q(`select * from public.catalogue_requests_ranked('warsaw')`)).length,0,'public ranking still active-only');
});
ok('creator sees the admin decision; public ranking unchanged (active only)');
console.log('ALL 013 CHECKS PASSED');
