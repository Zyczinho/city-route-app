// Optional integration check for migration 011 on a real Postgres (PGlite, WASM). Not part of npm test: the repo has no dependencies.
// Run from an empty temp folder (never inside the repo):
//   npm init -y && npm install @electric-sql/pglite@0.2.17
//   node <repo>/supabase/tests/011_social_routes.pglite.mjs <repo>/supabase/migrations/011_social_routes.sql
// The stub mirrors the 001/003 tables, the 003 RLS policies verbatim, Supabase roles, auth.uid() and default privileges.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const MIG=process.argv[2];
const db=new PGlite();
const A='aaaaaaaa-0000-4000-8000-000000000001',B='bbbbbbbb-0000-4000-8000-000000000002';

const STUB=`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
grant usage on schema public to anon,authenticated;
alter default privileges in schema public grant all on tables to anon,authenticated;
alter default privileges in schema public grant all on functions to anon,authenticated;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,nickname text not null default 'Odkrywca',bio text not null default '',stay text,instagram text not null default '',tiktok text not null default '',website text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.cities(id uuid primary key default gen_random_uuid(),slug text unique not null,status text not null default 'launch');
create table public.places(id uuid primary key default gen_random_uuid(),city_id uuid not null references public.cities(id),slug text not null,legacy_id text,status text not null default 'published',visibility text not null default 'public');
create table public.routes(id uuid primary key default gen_random_uuid(),city_id uuid not null references public.cities(id) on delete cascade,slug text,legacy_id text,
  name text not null check (char_length(name) between 1 and 160),description text not null default '',
  route_type text not null default 'community' check (route_type in ('editorial','community')),owner_user_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','unlisted','private')),status text not null default 'draft' check (status in ('draft','published','archived')),
  transport text not null default 'walking' check (transport in ('walking','bike','transit','mix')),metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(city_id,slug));
create table public.route_stops(route_id uuid not null references public.routes(id) on delete cascade,place_id uuid not null references public.places(id) on delete restrict,position integer not null check(position>=0),note text not null default '',primary key(route_id,position),unique(route_id,place_id));
create table public.route_tags(route_id uuid not null references public.routes(id) on delete cascade,tag text not null check (tag ~ '^[a-z0-9_-]+$'),primary key(route_id,tag));
create trigger routes_set_updated_at before update on public.routes for each row execute function public.set_updated_at();
alter table public.profiles enable row level security; alter table public.cities enable row level security; alter table public.places enable row level security;
alter table public.routes enable row level security; alter table public.route_stops enable row level security; alter table public.route_tags enable row level security;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy cities_read on public.cities for select to anon,authenticated using (status<>'hidden');
create policy places_read_published on public.places for select to anon,authenticated using (status='published' and visibility='public');
create policy routes_read_public_or_own on public.routes for select to anon,authenticated using ((status='published' and visibility='public') or owner_user_id=(select auth.uid()));
create policy routes_insert_own on public.routes for insert to authenticated with check (owner_user_id=(select auth.uid()) and route_type='community');
create policy routes_update_own on public.routes for update to authenticated using (owner_user_id=(select auth.uid()) and route_type='community') with check (owner_user_id=(select auth.uid()) and route_type='community');
create policy routes_delete_own on public.routes for delete to authenticated using (owner_user_id=(select auth.uid()) and route_type='community');
create policy route_stops_read on public.route_stops for select to anon,authenticated using (exists(select 1 from public.routes r where r.id=route_id and ((r.status='published' and r.visibility='public') or r.owner_user_id=(select auth.uid()))));
create policy route_stops_manage_own on public.route_stops for all to authenticated using (exists(select 1 from public.routes r where r.id=route_id and r.owner_user_id=(select auth.uid()) and r.route_type='community')) with check (exists(select 1 from public.routes r where r.id=route_id and r.owner_user_id=(select auth.uid()) and r.route_type='community'));
create policy route_tags_read on public.route_tags for select to anon,authenticated using (exists(select 1 from public.routes r where r.id=route_id and ((r.status='published' and r.visibility='public') or r.owner_user_id=(select auth.uid()))));
create policy route_tags_manage_own on public.route_tags for all to authenticated using (exists(select 1 from public.routes r where r.id=route_id and r.owner_user_id=(select auth.uid()) and r.route_type='community')) with check (exists(select 1 from public.routes r where r.id=route_id and r.owner_user_id=(select auth.uid()) and r.route_type='community'));
create function public.catalogue_routes(city_slug text) returns table(id text,name text,description text,transport text,metadata jsonb,tags jsonb,stops jsonb) set search_path='' language sql stable as $$
  select coalesce(r.legacy_id,r.slug,r.id::text),r.name,r.description,r.transport,r.metadata,'[]'::jsonb,'[]'::jsonb from public.routes r join public.cities c on c.id=r.city_id
  where c.slug=city_slug and r.status='published' and r.visibility='public' $$;
-- seed
insert into auth.users values ('${A}'),('${B}');
insert into public.profiles(id,nickname,stay) values ('${A}','Ala','visitor'),('${B}','Bartek','resident');
insert into public.cities(slug) values ('warsaw'),('krakow');
insert into public.places(city_id,slug) select id,s from public.cities,unnest(array['w1','w2','w3','w4']) s where slug='warsaw';
insert into public.places(city_id,slug,status) select id,'wx','draft' from public.cities where slug='warsaw';
insert into public.places(city_id,slug) select id,s from public.cities,unnest(array['k1','k2']) s where slug='krakow';
insert into public.routes(city_id,slug,legacy_id,name,route_type,status,visibility) select id,'old-warsaw','old-warsaw','Pierwsze spotkanie','editorial','published','public' from public.cities where slug='warsaw';
insert into public.routes(city_id,slug,legacy_id,name,route_type,status,visibility) select id,'krakow-2h','krakow-2h','Kraków w 2h','editorial','published','public' from public.cities where slug='krakow';
insert into public.routes(city_id,slug,legacy_id,name,route_type,status,visibility) select id,'hidden-draft','hidden-draft','Szkic redakcji','editorial','draft','public' from public.cities where slug='warsaw';
`;

const as=async(role,uid,fn)=>{
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`);
  try{return await fn();}finally{await db.exec('reset role;');}
};
const q=(sql,params)=>db.query(sql,params).then(r=>r.rows);
const fails=async(p,re,label)=>{try{await p;}catch(e){assert.match(e.message,re,`${label}: ${e.message}`);return;}assert.fail(`${label}: expected failure ${re}`);};
const ok=label=>console.log('  ok',label);

await db.exec(STUB);
const mig=(await readFile(MIG,'utf8'));
await db.exec(mig);await db.exec(mig);ok('migration 011 applies twice (idempotent)');

// editorial catalogue stays editorial
let ra,ru,rb;
await as('authenticated',A,async()=>{
  ra=(await q(`select public.publish_community_route('warsaw','  Mój   spacer ',array['w1','w2'],'walking','Opis',array['local','local'],'public') as id`))[0].id;
  ru=(await q(`select public.publish_community_route('warsaw','Ukryta',array['w2','w3'],'bike','',array[]::text[],'unlisted') as id`))[0].id;
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1'])`),/invalid-stop-count/,'one stop');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','wx'])`),/unknown-stop:wx/,'unpublished place');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','k1'])`),/unknown-stop:k1/,'cross-city place');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w1'])`),/duplicate-stop/,'duplicate stop');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w2'],'rocket')`),/invalid-transport/,'transport');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w2'],'walking','',array['Bad Tag'])`),/invalid-tags/,'tags');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w2'],'walking','','{}','private')`),/invalid-visibility/,'private');
  await fails(q(`select public.publish_community_route('warsaw','',array['w1','w2'])`),/invalid-name/,'empty name');
  await fails(q(`select public.publish_community_route('krakow','x',array['k1','k2'],'walking','','{}','public',null,$1)`,[ra]),/invalid-fork-source/,'cross-city fork');
});
ok('publish validates stops, city, transport, tags, visibility, name and fork city');
const [pub]=await q(`select name,owner_user_id,status,published_at is not null as p,(select array_agg(tag) from public.route_tags where route_id=r.id) tags from public.routes r where id=$1`,[ra]);
assert.equal(pub.name,'Mój spacer');assert.equal(pub.owner_user_id,A);assert.equal(pub.status,'published');assert.ok(pub.p);assert.deepEqual(pub.tags,['local']);
ok('publish normalises name, dedupes tags, sets owner/status/published_at server-side');

await as('anon',null,async()=>{
  assert.deepEqual((await q(`select id from public.catalogue_routes('warsaw')`)).map(r=>r.id),['old-warsaw']);
  const feed=await q(`select * from public.community_routes('warsaw')`);
  assert.deepEqual(feed.map(r=>r.id),[ra],'unlisted stays out of the feed');
  assert.equal(feed[0].author_nickname,'Ala');assert.deepEqual(feed[0].stops,['w1','w2']);assert.equal(feed[0].stop_count,2);
  assert.ok(!('stay' in feed[0])&&!('email' in feed[0]));
  assert.equal((await q(`select * from public.community_routes('krakow')`)).length,0,'no Warsaw routes in Kraków');
  assert.equal((await q(`select * from public.community_route($1)`,[ru])).length,1,'unlisted by direct link');
  await fails(q(`select * from public.community_route_cards`),/permission denied/,'view not readable');
  await fails(q(`select * from public.profiles`),/permission denied|0 rows/,'profiles stay closed to anon').catch(async()=>{assert.equal((await q('select * from public.profiles')).length,0);});
  const prof=await q(`select * from public.public_profile($1)`,[A]);
  assert.equal(prof[0].nickname,'Ala');assert.equal(prof[0].route_count,1);assert.ok(!('stay' in prof[0]));
  assert.equal((await q(`select * from public.public_profile($1)`,[B])).length,0,'no profile for users without public routes');
  await fails(q(`select public.save_route('warsaw',$1)`,[ra]),/permission denied/,'anon cannot save');
  await fails(q(`select * from public.route_saves`),/permission denied/,'anon cannot read saves');
});
ok('anon: editorial-only catalogue, city-scoped public feed with nickname, unlisted by link, closed view/profiles/saves');

await as('authenticated',B,async()=>{
  assert.equal((await q(`select public.save_route('warsaw',$1) as id`,[ra]))[0].id,ra);
  await q(`select public.save_route('warsaw',$1)`,[ra]);
  await q(`select public.save_route('warsaw','old-warsaw')`);
  await fails(q(`select public.save_route('krakow','old-warsaw')`),/route-not-found/,'editorial ref is city-scoped');
  await fails(q(`select public.save_route('warsaw',$1)`,[ru]),/route-not-found|row-level security/,'unlisted cannot be saved');
  await q(`select public.rate_route('warsaw',$1,4)`,[ra]);await q(`select public.rate_route('warsaw',$1,5)`,[ra]);
  await fails(q(`select public.rate_route('warsaw',$1,6)`,[ra]),/invalid-rating/,'rating range');
  await fails(q(`insert into public.route_saves(route_id,user_id) values($1,$2)`,[ra,A]),/row-level security/,'cannot save as someone else');
  rb=(await q(`select public.publish_community_route('warsaw','Kopia: Mój spacer',array['w2','w1','w4'],'walking','','{}','public',null,$1) as id`,[ra]))[0].id;
  const marks=await q(`select * from public.my_route_marks(array[$1,$2]::uuid[])`,[ra,rb]);
  assert.deepEqual(marks.map(m=>[m.saved,m.my_rating]),[[true,5],[false,null]]);
  const saved=await q(`select * from public.saved_routes()`);
  assert.deepEqual(saved.map(s=>[s.public_id,s.route_type,!!s.card]).sort(),[[ra,'community',true],['old-warsaw','editorial',false]].sort());
  assert.equal((await q('select count(*)::int n from public.route_saves'))[0].n,2,'B sees only own saves');
  await fails(q(`select public.publish_community_route('warsaw','Hijack',array['w1','w2'],'walking','','{}','public',$1)`,[ra]),/not-owner/,'edit someone else');
  await fails(q(`select public.archive_community_route($1)`,[ra]),/not-owner/,'archive someone else');
  await fails(q(`select public.delete_community_route($1)`,[ra]),/not-owner/,'delete someone else');
  await fails(q(`update public.routes set name='x' where id=$1 returning id`,[ra]).then(r=>{if(!r.length)throw new Error('row-level security: 0 rows');}),/row-level security/,'direct update blocked');
});
ok('B: idempotent save, editorial save by slug, rating upsert, fork publish, marks, saved list, no foreign writes');

await as('authenticated',A,async()=>{
  await fails(q(`select public.rate_route('warsaw',$1,5)`,[ra]),/row-level security/,'author cannot rate own route');
  assert.equal((await q('select count(*)::int n from public.route_saves'))[0].n,0,'A cannot see B saves');
  const before=(await q(`select published_at from public.routes where id=$1`,[ra]))[0].published_at;
  assert.equal((await q(`select public.publish_community_route('warsaw','Mój spacer v2',array['w3','w2','w1'],'mix','',array['views'],'public',$1) as id`,[ra]))[0].id,ra);
  const after=await q(`select published_at,(select array_agg(p.slug order by s.position) from public.route_stops s join public.places p on p.id=s.place_id where s.route_id=r.id) stops from public.routes r where id=$1`,[ra]);
  assert.equal(+after[0].published_at,+before,'edit keeps publish time');assert.deepEqual(after[0].stops,['w3','w2','w1']);
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','nope'],'walking','','{}','public',$1)`,[ra]),/unknown-stop/,'failed edit');
  assert.deepEqual((await q(`select (select array_agg(p.slug order by s.position) from public.route_stops s join public.places p on p.id=s.place_id where s.route_id=$1) st`,[ra]))[0].st,['w3','w2','w1'],'failed edit rolls back atomically');
});
ok('A: cannot rate own route, cannot see B saves, edit in place keeps id/published_at, failed edit is atomic');

await as('anon',null,async()=>{
  const feed=await q(`select * from public.community_routes('warsaw','popular')`);
  const a=feed.find(r=>r.id===ra),b=feed.find(r=>r.id===rb);
  assert.deepEqual([a.save_count,a.rating_count,+a.rating_avg,a.fork_count],[1,1,5,1]);
  assert.equal(b.forked_from_id,ra);assert.equal(b.forked_from_name,'Mój spacer v2');
  for(const s of ['newest','top','popular','unknown'])assert.equal((await q(`select * from public.community_routes('warsaw',$1)`,[s])).length,2);
  assert.deepEqual((await q(`select id from public.community_routes('warsaw','popular',1,1)`)).length,1,'paging');
  assert.ok(+a.popular_score>+b.popular_score,'engagement outranks a newer route with none');
});
ok('feed aggregates (saves/ratings/forks), fork provenance, sorts and paging');

// Review cycle 2: provenance never reveals non-public sources; editorial forks keep provenance; route_ref is public-only
let re,rx;
await as('authenticated',B,async()=>{
  re=(await q(`select public.publish_community_route('warsaw','Kopia redakcyjnej',array['w1','w4'],'walking','','{}','public',null,'old-warsaw') as id`))[0].id;
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w4'],'walking','','{}','public',null,$1)`,[ru]),/invalid-fork-source/,'unlisted source refused by the RPC');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w4'],'walking','','{}','public',null,'hidden-draft')`),/invalid-fork-source/,'draft editorial source refused');
  await fails(q(`select public.publish_community_route('warsaw','x',array['w1','w4'],'walking','','{}','public',null,'krakow-2h')`),/invalid-fork-source/,'editorial source from another city refused');
  // bypass the RPC: 003 routes_insert_own still allows a direct insert pointing at the unlisted route
  rx=(await q(`insert into public.routes(city_id,name,route_type,owner_user_id,visibility,status,published_at,forked_from_route_id) select id,'Przeciek?','community',$1,'public','published',now(),$2 from public.cities where slug='warsaw' returning id`,[B,ru]))[0].id;
});
const [stored]=await q(`select forked_from_route_id f from public.routes where id=$1`,[re]);
assert.equal(stored.f,(await q(`select id from public.routes where slug='old-warsaw'`))[0].id,'editorial fork stores the editorial route uuid');
await as('anon',null,async()=>{
  const feed=await q(`select * from public.community_routes('warsaw','newest',50)`);
  const e=feed.find(r=>r.id===re),x=feed.find(r=>r.id===rx);
  assert.equal(e.forked_from_name,'Pierwsze spotkanie');assert.ok(e.forked_from_id,'editorial provenance shown');
  assert.equal(x.forked_from_id,null);assert.equal(x.forked_from_name,null);
  assert.ok(!JSON.stringify(feed).includes(ru)&&!JSON.stringify(feed).includes('Ukryta'),'unlisted source id/name never in public discovery');
  assert.ok(!JSON.stringify(await q(`select * from public.author_routes($1)`,[B])).includes(ru),'nor in author routes');
  assert.equal((await q(`select * from public.community_route($1)`,[ru])).length,1,'unlisted source still opens by direct link');
  assert.equal((await q(`select public.route_ref('warsaw',$1) r`,[ru]))[0].r,null,'route_ref ignores unlisted');
  assert.equal((await q(`select public.route_ref('warsaw','hidden-draft') r`))[0].r,null,'route_ref ignores non-published editorial');
  assert.ok((await q(`select public.route_ref('warsaw','old-warsaw') r`))[0].r);
});
ok('editorial forks keep provenance; unlisted/draft sources never surface; route_ref resolves public routes only');

await as('authenticated',A,async()=>{
  await q(`select public.archive_community_route($1)`,[ra]);
  assert.equal((await q(`select * from public.community_route($1)`,[ra])).length,1,'owner still sees archived');
});
await as('anon',null,async()=>{
  const feed=await q(`select * from public.community_routes('warsaw','newest',50)`);
  assert.ok(!feed.some(r=>r.id===ra)&&feed.some(r=>r.id===rb),'archived leaves the feed');
  assert.equal(feed.find(r=>r.id===rb).forked_from_id,null,'archived source no longer revealed by its forks');
  assert.equal((await q(`select * from public.community_route($1)`,[ra])).length,0);
});
await as('authenticated',B,async()=>{
  await q(`select public.unsave_route('warsaw',$1)`,[ra]);await q(`select public.remove_rating('warsaw',$1)`,[ra]);
  assert.deepEqual((await q(`select (select count(*)::int from public.route_saves where route_id=$1) s,(select count(*)::int from public.route_ratings where route_id=$1) r`,[ra]))[0],{s:0,r:0},'own save/rating removable after archive');
});
await as('authenticated',A,async()=>{await q(`select public.delete_community_route($1)`,[ra]);});
const left=await q(`select (select forked_from_route_id from public.routes where id=$1) f,(select count(*)::int from public.route_saves where route_id=$2) s`,[rb,ra]);
assert.equal(left[0].f,null);assert.equal(left[0].s,0);
await as('anon',null,async()=>{
  assert.equal((await q(`select * from public.community_routes('warsaw','newest',50)`)).find(r=>r.id===rb).forked_from_name,null);
  assert.deepEqual((await q(`select id from public.catalogue_routes('warsaw')`)).map(r=>r.id),['old-warsaw'],'catalogue still editorial-only');
});
ok('archive hides, delete cascades saves and clears fork provenance, catalogue unaffected');
console.log('ALL 011 CHECKS PASSED');
