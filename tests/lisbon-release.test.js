import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cityFromParams,searchPlaceAddress,suggestPlaces} from '../geocode.js';
import {cityParams} from '../place-composer-model.js';

const cities=JSON.parse(await readFile(new URL('../data/cities.json',import.meta.url),'utf8'));
const city=id=>cities.find(c=>c.id===id);
const googleResponse=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

test('city selection sends valid country code to API and preserves Warsaw defaults',()=>{
 const lisboa=city('lisbon'),param=new URLSearchParams(cityParams(lisboa));
 assert.equal(param.get('country'),'PT');
 const l=cityFromParams(param);
 assert.equal(l.id,'lisbon');
 assert.equal(l.name,'Lizbona');
 assert.equal(l.countryCode,'PT');
 assert.deepEqual(l.center,lisboa.center);
 assert.equal(l.radiusKm,25);
 const warsaw=cityFromParams(new URLSearchParams(cityParams(city('warsaw'))));
 assert.equal(warsaw.countryCode,'PL');
 const krakow=cityFromParams(new URLSearchParams(cityParams(city('krakow'))));
 assert.equal(krakow.countryCode,'PL');
 assert.equal(cityFromParams(new URLSearchParams('lat=38.7223&lng=-9.1393&r=25&country=invalid!')).countryCode,'PL');
});

test('Lisbon autocomplete searches Portugal, not Polish region',async()=>{
 const l=cityFromParams(new URLSearchParams(cityParams(city('lisbon')))),calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url:String(url),body:JSON.parse(opts.body)});
  return googleResponse({suggestions:[{placePrediction:{placeId:'ChIJabcdefgh1234',text:{text:'Dois Corvos'},structuredFormat:{mainText:{text:'Dois Corvos'},secondaryText:{text:'Lizbona'}}}}]});
 };
 const out=await suggestPlaces('Dois Corvos',{city:l,googleKey:'test-key',googleAutocomplete:true,fetcher});
 assert.equal(out.status,'ok');
 assert.equal(out.provider,'google');
 assert.equal(out.suggestions[0].name,'Dois Corvos');
 assert.deepEqual(calls[0].body.includedRegionCodes,['pt']);
 assert.equal(calls[0].body.regionCode,'pt');
 assert.deepEqual(calls[0].body.locationRestriction.circle.center,{latitude:38.7223,longitude:-9.1393});
});

test('Google Text Search uses Portugal region bias, retains 25km city fence',async()=>{
 const l=cityFromParams(new URLSearchParams(cityParams(city('lisbon'))));
 let req;
 const fetcher=async(url,opts)=>{
  req=JSON.parse(opts.body);
  return googleResponse({places:[{id:'lisbon-test',displayName:{text:'Castelo de São Jorge'},
   formattedAddress:'Lisboa, Portugal',location:{latitude:38.7139,longitude:-9.1335},types:['tourist_attraction']}]});
 };
 const out=await searchPlaceAddress('Castelo de São Jorge',{city:l,googleKey:'test-key',fetcher});
 assert.equal(req.regionCode,'PT');
 assert.equal(out.status,'ok');
 assert.equal(out.name,'Castelo de São Jorge');
 assert.equal(out.location.lat,38.7139);
});

test('Warsaw autocomplete remains restricted to Poland',async()=>{
 const w=cityFromParams(new URLSearchParams(cityParams(city('warsaw'))));
 let request;
 const fetcher=async(url,opts)=>{request=JSON.parse(opts.body);return googleResponse({suggestions:[]});};
 await suggestPlaces('Tuk Tuk',{city:w,googleKey:'test',googleAutocomplete:true,fetcher});
 assert.equal(request.regionCode,'pl');
 assert.deepEqual(request.includedRegionCodes,['pl']);
});

test('PWA includes Lisbon city fallback without removing Krakow',async()=>{
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/city-route-v65/);
 for(const path of ['lisbon/places.json','lisbon/routes.json','krakow/places.json','krakow/routes.json'])
  assert.ok(sw.includes('./data/cities/'+path),path);
 const [places,routes]=await Promise.all(['places','routes'].map(async kind=>JSON.parse(await readFile(new URL('../data/cities/lisbon/'+kind+'.json',import.meta.url),'utf8'))));
 assert.equal(places.length,188);
 assert.deepEqual(routes,[]);
});
