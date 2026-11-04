import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {normalizeExternalRatings,cityRouteSortScore,reviewSourcePolicy} from '../review-source-model.js';
import {createPlaceReviewsClient} from '../place-reviews-client.js';
import {combinedRating} from '../core.js';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('licensed provider adapters preserve ratings and review counts, without copying text',()=>{
 const checked='2026-11-04';
 const payload={
  google:{rating:4.6,userRatingCount:520,googleMapsUri:'https://maps.google.com/?q=foo',displayName:{text:'Miejsce'},reviews:[{authorAttribution:{displayName:'Jan'},text:{text:'private provider copy'}}]},
  tripadvisor:{rating:4.4,num_reviews:200,web_url:'https://www.tripadvisor.com/Attraction_Review-example',name:'Miejsce'}
 };
 const records=normalizeExternalRatings(payload,checked);
 assert.deepEqual(records.map(x=>[x.source,x.value,x.reviewCount]),[['google',4.6,520],['tripadvisor',4.4,200]]);
 assert.equal(records[0].url,'https://maps.google.com/?q=foo');
 assert.ok(records.every(x=>x.checked===checked));
 assert.ok(!JSON.stringify(records).includes('private provider copy'));
 assert.ok(!JSON.stringify(records).includes('Jan'));
 const blended=combinedRating(records);
 assert.ok(Math.abs(blended.value-(4.6*520+4.4*200)/720)<1e-8);
 const absent=normalizeExternalRatings();
 assert.ok(absent.every(x=>x.value===null&&x.reviewCount===null));
 assert.deepEqual(reviewSourcePolicy.externalCombinedSources,['google','tripadvisor']);
 assert.equal(reviewSourcePolicy.communityPartOfExternalCombinedScore,false);
});

test('City Route reviews have an independent Bayesian ranking (even with small volume)',()=>{
 const one=cityRouteSortScore({average_rating:5,review_count:1});
 const established=cityRouteSortScore({average_rating:4.8,review_count:100});
 assert.ok(one>4&&one<4.1,'one 5-star cannot dominate');
 assert.ok(established>one,'strong sample outranks one perfect review');
 assert.equal(cityRouteSortScore({average_rating:5,review_count:0}),null);
 assert.equal(cityRouteSortScore({average_rating:4.5,review_count:30,sort_score:4.28}),4.28);
});

test('review data client sends ratings using account-based SQL RPC and keeps external averages out',async()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='city_route_place_scores'?[{place_ref:'old-town',review_count:2,average_rating:5,sort_score:4.0909}]:null,error:null};}};
 const api=createPlaceReviewsClient(client);
 const ratings=await api.scores('warsaw');
 assert.equal(ratings.get('old-town').reviewCount,2);
 assert.equal(ratings.get('old-town').sortScore,4.0909);
 await api.rate('warsaw','old-town',4);
 assert.deepEqual(calls.map(x=>x.name),['city_route_place_scores','rate_visited_place']);
 assert.deepEqual(calls[1].args,{p_city_slug:'warsaw',p_ref:'old-town',p_rating:4,p_feedback:''});
 await assert.rejects(()=>api.rate('warsaw','old-town',7),e=>e.code==='invalid-rating');
});

test('DB schema keeps unverified personal reviews separate from provider aggregate and author text private',async()=>{
 const [sql,social,app,sidecar]=await Promise.all(['supabase/migrations/016_cityroute_ratings_and_route_feedback.sql','social-routes-enhancements.js','app.js','place-reviews.js'].map(load));
 for(const token of ['create table if not exists public.place_reviews','visit_verified boolean not null default false',
   'create or replace function public.rate_visited_place','create or replace function public.city_route_place_scores',
   'create or replace function public.set_route_feedback','create or replace function public.my_route_feedback',
   'grant execute on function public.city_route_place_scores(text) to anon,authenticated',
   'raise exception \'self-rating\''])assert.ok(sql.includes(token),token);
 assert.match(sql,/public\.place_reviews enable row level security/);
 assert.match(sql,/from public\.place_reviews pr/);
 assert.match(sql,/where id=p_route_id and owner_user_id=v_user/);
 assert.match(social,/data-social-feedback/);
 assert.match(social,/api\.saveFeedback/);
 assert.match(sidecar,/data-cityroute-sort/);
 assert.match(sidecar,/cityroute:place-reviewed/);
 assert.match(app,/cityroute:place-reviewed/);
 for(const path of ['social-routes-enhancements.js','place-reviews.js','place-reviews-client.js','review-source-model.js'])
  execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});

test('compact place cards keep explicit Google/Tripadvisor source values on phones, and only reveal actual City Route scores',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/\.place \.srcs\{display:flex;flex-wrap:nowrap/);
 assert.match(css,/\.place \.cr-score\.has-score\{display:inline-flex/);
 const guide=await load('onboarding-guide.css');assert.match(guide,/#navigation\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});
