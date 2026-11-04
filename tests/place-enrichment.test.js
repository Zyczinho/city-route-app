import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichPlace,isSamePlace} from '../place-enrichment.js';

const point={name:'Kawiarnia Test',lat:52.2297,lng:21.0122,city:{name:'Warszawa'}};
const google={
 id:'ChIJabcdefgh1234',displayName:{text:'Kawiarnia Test'},
 location:{latitude:52.2297,longitude:21.0122},rating:4.6,userRatingCount:125,
 googleMapsUri:'https://maps.google.com/?cid=1',
 photos:[{name:'places/ChIJabcdefgh1234/photos/demo',authorAttributions:[{displayName:'Anna',uri:'https://maps.google.com/author'}]}]
};
const terra={
 id:7654321,names:[{value:'Kawiarnia Test',primary:true}],coordinates:{latitude:52.22972,longitude:21.01223},
 traveler_ratings:{overall:{rating:4.4,count:60}},
 urls:{tripadvisor:'https://www.tripadvisor.com/Restaurant_Review-123.html'},
 photos:{total_count:0}
};
const reply=data=>({ok:true,json:async()=>data});

test('no configured credentials => no fake ratings/photo',async()=>{
 const r=await enrichPlace(point);
 assert.equal(r.status,'no-key');assert.deepEqual(r.ratings,[]);assert.equal(r.image,null);
});
test('Google official rating and photo are kept separate and have author attribution',async()=>{
 const calls=[];
 const r=await enrichPlace({...point,googleKey:'secret',googlePlaceId:google.id,fetcher:async(url,opts)=>{calls.push({url,opts});return reply(google);}});
 assert.equal(r.status,'ok');assert.equal(r.ratings.length,1);assert.equal(r.ratings[0].source,'google');assert.equal(r.ratings[0].value,4.6);
 assert.equal(r.ratings[0].reviewCount,125);assert.match(r.image.src,/^\/api\/place-photo\?id=/);
 assert.equal(r.image.credit.author,'Anna');assert.equal(calls.length,1);
 assert.match(calls[0].opts.headers['x-goog-fieldmask'],/userRatingCount/);
 assert.doesNotMatch(JSON.stringify(r),/secret/);
});
test('Tripadvisor licensed rating adds second provider, not City Route, without provider review text',async()=>{
 const urls=[];
 const r=await enrichPlace({...point,googleKey:'g',terraKey:'t',googlePlaceId:google.id,fetcher:async(url)=>{
  urls.push(url);
  if(url.includes('places.googleapis.com'))return reply(google);
  if(url.includes('/locations/search'))return reply({data:[{location:terra}]});
  return {ok:false,json:async()=>null};
 }});
 assert.equal(r.ratings.length,2);assert.deepEqual(r.ratings.map(x=>x.source),['google','tripadvisor']);
 assert.equal(r.ratings[1].reviewCount,60);assert.equal(r.ratings[1].value,4.4);
 assert.ok(urls.some(x=>x.includes('/api/locations/search?')));assert.ok(!r.ratings.some(x=>x.source==='city_route'));
 assert.equal(r.image.credit.via,'Google Maps');
});
test('far-away or wrong-name results are not assigned to another place',async()=>{
 assert.equal(isSamePlace({...point,requestedName:'Kawiarnia Test',requestedLat:52.2297,requestedLng:21.0122,candidateName:'Kawiarnia Test',candidateLat:50.06,candidateLng:19.94}),false);
 const wrong={...google,displayName:{text:'Inny Obiekt'}};
 const r=await enrichPlace({...point,googleKey:'g',googlePlaceId:google.id,fetcher:async()=>reply(wrong)});
 assert.equal(r.status,'no-match');assert.deepEqual(r.ratings,[]);
});
test('provider cap denies enrichment without accidental paid calls',async()=>{
 let calls=0;
 const r=await enrichPlace({...point,googleKey:'g',terraKey:'t',allowGoogle:()=>false,allowTerra:()=>false,fetcher:async()=>{calls++;throw new Error('not allowed');}});
 assert.equal(calls,0);assert.deepEqual(r.ratings,[]);
});
test('Google score field absent => no invented rating, photo still allowed',async()=>{
 const r=await enrichPlace({...point,googleKey:'g',googlePlaceId:google.id,fetcher:async()=>reply({...google,userRatingCount:null,rating:null})});
 assert.equal(r.ratings.length,0);assert.equal(r.status,'ok');assert.ok(r.image);
});
