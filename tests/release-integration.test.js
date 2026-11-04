import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('release 029 includes all three feature modules in HTML, build and offline cache',async()=>{
 const [html,build,sw]=await Promise.all(['index.html','scripts/build.mjs','service-worker.js'].map(read));
 for(const [id,version] of [['place-contributions.js','v=1'],['friends.js','v=1'],['place-reviews.js','v=2']]){
  assert.ok(html.includes(id+'?'+version),'missing frontend module '+id);
  assert.ok(sw.includes(id+'?'+version),'missing offline resource '+id);
  assert.ok(build.includes("'"+id+"'"),'missing production build copy '+id);
 }
 for(const file of ['place-contributions-client.js','friends-client.js','place-reviews-client.js','review-source-model.js']){
  assert.ok(build.includes("'"+file+"'"),'missing build dependency '+file);
  assert.ok(sw.includes(file),'missing offline dependency '+file);
 }
 assert.match(html,/auth-enhancements\.js\?v=21/);
 assert.match(html,/community-hub\.js\?v=2/);
 assert.match(html,/social-routes-enhancements\.js\?v=4/);
 assert.match(sw,/city-route-v50/);
 assert.ok(!html.includes('city-route-v33'));
});

test('release keeps onboard, variant picker, arrival review and finished-route publishing',async()=>{
 const [app,social,guide]=await Promise.all(['app.js','social-routes-enhancements.js','community-hub.js'].map(read));
 for(const token of ['start-guide-menu','generatedPicker','arrival-rating','publish-finished','cityroute:submission-updated','cityroute:place-reviewed']){
  assert.ok(app.includes(token),'regression in live route UI: '+token);
 }
 assert.match(social,/function normalizedPublicDraft/);
 assert.match(social,/hasUnapprovedStops/,'no publishing unapproved public places');
 assert.match(social,/cityroute:publish-completed/);
 assert.match(social,/completedDraft/,'completed stops stay independent of the editor basket');
 assert.match(guide,/'#routes\/community\/friends','Znajomi'/);
 assert.match(guide,/'#routes\/community\/chats','Czaty'/);
});

test('the three DB migrations and independent auditor documentation are in release tree',async()=>{
 const files=[
  'supabase/migrations/014_place_submissions.sql',
  'supabase/migrations/015_friends_unique_nicknames.sql',
  'supabase/migrations/016_cityroute_ratings_and_route_feedback.sql',
  'AUDITORS.md','auditors/AUDITOR_01_ERASMUS.md','auditors/AUDITOR_02_RESIDENT.md',
  'auditors/AUDITOR_03_24H_TOURIST.md','auditors/AUDITOR_04_OPERATOR.md',
  'docs/DISCOVERY_RANKING_V0.1.md'
 ];
 const content=await Promise.all(files.map(read));assert.ok(content.every(Boolean));
 const [places,friends,reviews]=content;
 assert.doesNotMatch(places,/raise exception 'rate-limited'/,'no public submissions quotas');
 assert.match(places,/normalized_key/,'public duplicate detection remains');
 assert.match(friends,/profiles_nickname_ci_unique/,'case-insensitive nicknames');
 assert.match(reviews,/visit_verified boolean not null default false/);
 assert.match(reviews,/city_route_place_scores/);
 assert.doesNotMatch(reviews,/google_rating|tripadvisor_rating/,'own community mean must not secretly blend external sources');
});

test('staged scripts parse in Node before browser validation',()=>{
 const paths=['app.js','social-routes-enhancements.js','place-contributions.js','friends.js','friends-client.js',
 'place-reviews.js','place-reviews-client.js','review-source-model.js','auth-enhancements.js','community-hub.js'];
 for(const path of paths)execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});
