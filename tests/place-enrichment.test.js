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

test('Google review bodies are available only with explicit Atmosphere opt-in, with author and source',async()=>{
 const review={rating:5,text:{text:'Świetna obsługa i kawa.'},authorAttribution:{
  displayName:'Autorka',uri:'https://maps.google.com/contributor',photoUri:'https://lh3.googleusercontent.com/portrait'
 },googleMapsUri:'https://maps.google.com/review/123',relativePublishTimeDescription:'tydzień temu'};
 const result=await enrichPlace({...point,googleKey:'g',googlePlaceId:google.id,includeGoogleReviews:true,
  fetcher:async()=>reply({...google,reviews:[review]})});
 assert.equal(result.reviews.length,1);
 assert.equal(result.reviews[0].text,'Świetna obsługa i kawa.');
 assert.equal(result.reviews[0].author,'Autorka');
 assert.equal(result.reviews[0].authorUrl,'https://maps.google.com/contributor');
 assert.equal(result.reviews[0].source,'google');
 const noReview=await enrichPlace({...point,googleKey:'g',googlePlaceId:google.id,
  fetcher:async()=>reply({...google,reviews:[review]})});
 assert.deepEqual(noReview.reviews,[],'review text must not be retrieved without opt-in');
});
test('Terra review snippets respect partner API access and preserve author/source attribution',async()=>{
 let reviewCalls=0;
 const sample={id:112233,rating:4,publish_ts:'2026-10-20T00:00:00Z',url:'https://www.tripadvisor.com/ShowUserReviews-g.html',
  user:{name:'Odwiedzający'},title:[{language:'pl',primary:true,value:'Dobry wybór'}],
  text:[{language:'pl',primary:true,value:'Czysto i bardzo blisko centrum.'}]};
 const fetcher=async(url)=>{
  if(url.includes('/locations/search'))return reply({data:[{location:terra}]});
  if(url.includes('/reviews')){reviewCalls++;return reply({data:[sample]});}
  return {ok:false,json:async()=>null};
 };
 const result=await enrichPlace({...point,terraKey:'partner',includeTerraReviews:true,fetcher});
 assert.equal(reviewCalls,1);
 assert.equal(result.reviews.length,1);
 assert.equal(result.reviews[0].text,'Czysto i bardzo blisko centrum.');
 assert.equal(result.reviews[0].author,'Odwiedzający');
 assert.equal(result.reviews[0].source,'tripadvisor');
 const without=await enrichPlace({...point,terraKey:'partner',fetcher});
 assert.equal(without.reviews.length,0);
 assert.equal(reviewCalls,1,'disabled Terra reviews must not issue separate paid requests');
});

test('enrichment prefers highest-quality Google venue image and correctly attributes that image',async()=>{
 const photos=[
  {name:'places/id/photos/poster',widthPx:600,heightPx:1400,authorAttributions:[{displayName:'Wrong poster author',uri:'https://maps.google.com/author1'}]},
  {name:'places/id/photos/wide',widthPx:2100,heightPx:1400,authorAttributions:[{displayName:'Venue photographer',uri:'https://maps.google.com/author2'}]}
 ];
 const result=await enrichPlace({...point,googlePlaceId:google.id,googleKey:'secret',
  fetcher:async()=>reply({...google,photos})});
 assert.equal(result.image.credit.author,'Venue photographer');
});

test('short OSM name matches the longer Google name only when the venues are within 100 m',()=>{
 const base={requestedName:'Charlotte',requestedLat:52.22009,requestedLng:21.01864,candidateName:'Charlotte. Chleb i Wino'};
 assert.equal(isSamePlace({...base,candidateLat:52.22015,candidateLng:21.01870}),true);
 assert.equal(isSamePlace({...base,candidateLat:52.22200,candidateLng:21.01870}),false,'~210 m away is another venue');
 assert.equal(isSamePlace({...base,candidateName:'Charlie Burger',candidateLat:52.22015,candidateLng:21.01870}),false);
});

test('country-scoped provider search follows Lisbon, with legacy Poland default',async()=>{
 for(const countryCode of ['PT',undefined]){
  const calls=[];
  await enrichPlace({...point,city:{name:'Lizbona',countryCode},googleKey:'g',terraKey:'t',fetcher:async(url,opts)=>{
   calls.push({url,opts});
   return reply(url.includes('places.googleapis.com')?{places:[]}:{data:[]});
  }});
  const googleCall=calls.find(x=>x.url.includes('places.googleapis.com'));
  const terraCall=calls.find(x=>x.url.includes('/locations/search'));
  assert.equal(JSON.parse(googleCall.opts.body).regionCode,countryCode||'PL');
  assert.equal(new URL(terraCall.url).searchParams.get('country_code'),countryCode||'PL');
 }
});

test('"Inne zdjęcie" for an OpenStreetMap pick (e.g. Bar Studio): enrichment lists the other Google photos and the proposal offers them',async()=>{
 const g=(n,a)=>({name:'places/ChIJbarstudio123/photos/'+n,widthPx:1600,heightPx:1200,authorAttributions:[{displayName:a,uri:'https://maps.google.com/contrib/'+n}]});
 const place={...google,id:'ChIJbarstudio123',displayName:{text:'Bar Studio'},photos:[g('a','Bar Studio'),g('b','Ola'),g('c','Piotr'),g('d','Kasia'),g('e','Tomek')]};
 const r=await enrichPlace({...point,name:'Bar Studio',googleKey:'k',googlePlaceId:place.id,fetcher:async()=>reply(place)});
 assert.equal(r.image.credit.author,'Bar Studio');
 assert.deepEqual(r.image.more.map(m=>m.author),['Ola','Piotr','Kasia']);
 const {findPlacePhotoCandidates}=await import('../place-photo-proposal.js');
 // OSM selection: no Google placeId on the pick, so the photo comes through /api/place-enrichment.
 const selection={name:'Bar Studio',location:{lat:52.2326125,lng:21.0067525},source:'photon-osm'};
 const cityInfo={id:'warsaw',name:'Warszawa',center:{lat:52.2297,lng:21.0122},radiusKm:40};
 const fetcher=async url=>String(url).startsWith('/api/place-enrichment')?reply(r):reply({query:{pages:[]}});
 const out=await findPlacePhotoCandidates(selection,{city:'Warszawa',cityInfo,fetcher});
 assert.equal(out.candidates[0].src,'/api/place-photo?id=ChIJbarstudio123');
 assert.deepEqual(out.candidates.filter(c=>c.photoChoice).map(c=>[c.src,c.author]),[
  ['/api/place-photo?id=ChIJbarstudio123&n=1','Ola'],['/api/place-photo?id=ChIJbarstudio123&n=2','Piotr'],['/api/place-photo?id=ChIJbarstudio123&n=3','Kasia']]);
});
