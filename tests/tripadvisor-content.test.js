import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupContent,contentPhoto,contentReviews} from '../tripadvisor-content.js';
import {enrichPlace} from '../place-enrichment.js';
const place={name:'Nudle i Makaron',lat:52.23012,lng:21.01242,city:{name:'Warszawa'}};
const search={data:[{location_id:'98765',name:place.name}]};
const details={location_id:'98765',name:'Nudle i Makaron',latitude:'52.23014',longitude:'21.01239',rating:'4.7',
 num_reviews:'127',web_url:'https://www.tripadvisor.com/Restaurant_Review-98765'};
const photos={data:[{images:{large:{url:'https://media-cdn.tripadvisor.com/media/photo-o/example.jpg'}},
 user:{username:'Kasia'},url:'https://www.tripadvisor.com/ShowUserPhotos-98765'}]};
const reviews={data:[{text:'Wspaniały makaron!',rating:5,title:'Polecam',
 url:'https://www.tripadvisor.com/ShowUserReviews-98765',published_date:'2026-10-27',
 user:{username:'Tester'}}]};
const response=x=>({ok:true,json:async()=>x});
const fetcher=async(url)=>{const u=new URL(url);if(u.pathname.endsWith('/search'))return response(search);
 if(u.pathname.endsWith('/details'))return response(details);
 if(u.pathname.endsWith('/photos'))return response(photos);
 if(u.pathname.endsWith('/reviews'))return response(reviews);
 throw Error('Unexpected API call '+u.pathname);
};
test('Content Search + Details matches a real place before assigning provider rating',async()=>{
 let calls=0;const get=async(url,opts)=>{calls++;return fetcher(url,opts)};
 const result=await lookupContent({...place,key:'private',fetcher:get});
 assert.equal(result?.id,'98765');assert.equal(result.rating,4.7);assert.equal(result.reviewCount,127);
 assert.equal(calls,2,'search and details only');
});
test('Content rejects different business or distant location',async()=>{
 const bad=await lookupContent({...place,key:'private',fetcher:async(url)=>{
  if(url.includes('/search?'))return response(search);
  return response({...details,name:'Nudle i Makaron',latitude:'52.35'});
 }});
 assert.equal(bad,null);
 const unrelated=await lookupContent({...place,key:'private',fetcher:async(url)=>{
  if(url.includes('/search?'))return response(search);
  return response({...details,name:'Zupełnie inny lokal'});
 }});
 assert.equal(unrelated,null);
});
test('Content provider respects a per-request quota before every API fetch',async()=>{
 let calls=0,quota=0;const result=await lookupContent({...place,key:'private',fetcher:async(url)=>{calls++;return fetcher(url)},
  allowCall:()=>++quota<=1});
 assert.equal(result,null);assert.equal(calls,1,'details must not be called once budget is exhausted');
});
test('Content photo and review excerpts have attribution but are not persisted',async()=>{
 const photo=await contentPhoto({id:'98765',key:'private',fetcher});
 assert.match(photo.src,/^https:\/\/media-cdn\.tripadvisor\.com\//);
 assert.equal(photo.credit.author,'Kasia');
 const snippets=await contentReviews({id:'98765',key:'private',fetcher});
 assert.equal(snippets.length,1);assert.equal(snippets[0].author,'Tester');assert.equal(snippets[0].source,'tripadvisor');
});
test('Content rating, image and opted-in review integrate with City Route external data (Google remains separate)',async()=>{
 const r=await enrichPlace({...place,contentKey:'private',fetcher,includeContentReviews:true});
 assert.equal(r.status,'ok');assert.deepEqual(r.ratings.map(x=>x.source),['tripadvisor']);
 assert.equal(r.ratings[0].value,4.7);assert.equal(r.ratings[0].reviewCount,127);
 assert.ok(r.image?.src.includes('tripadvisor.com'));assert.equal(r.reviews.length,1);
 assert.equal(r.reviews[0].source,'tripadvisor');assert.ok(!JSON.stringify(r).includes('private'));
});
test('No secrets means zero external network requests',async()=>{
 let called=false;
 const r=await enrichPlace({...place,fetcher:async()=>{called=true;throw Error('must not call')}});
 assert.equal(r.status,'no-key');assert.equal(called,false);
});
