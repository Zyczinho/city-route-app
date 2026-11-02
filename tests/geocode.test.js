import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlaceQuery,searchPlaceAddress} from '../geocode.js';

test('normalizes a user-entered Warsaw address',()=>{
 assert.equal(normalizePlaceQuery('  Tuk Tuk,   Francuska 3A, 03-906  '),'Tuk Tuk, Francuska 3A, 03-906');
});

test('uses Google Places first when a key is configured',async()=>{
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push([String(url),options]);
  return new Response(JSON.stringify({places:[{displayName:{text:'Tuk Tuk'},formattedAddress:'Francuska 3A, Warszawa',location:{latitude:52.235,longitude:21.06},types:['restaurant']}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const result=await searchPlaceAddress('Tuk Tuk, Francuska 3A',{googleKey:'test',fetcher});
 assert.equal(result.status,'ok');
 assert.equal(result.provider,'google');
 assert.equal(result.name,'Tuk Tuk');
 assert.deepEqual(result.location,{lat:52.235,lng:21.06});
 assert.match(calls[0][0],/places\.googleapis\.com/);
});

test('falls back to Photon and keeps results near Warsaw',async()=>{
 const fetcher=async url=>new Response(JSON.stringify({features:[
  {geometry:{coordinates:[19.94,50.06]},properties:{name:'Wrong city'}},
  {geometry:{coordinates:[21.058,52.235]},properties:{name:'Tuk Tuk',street:'Francuska',housenumber:'3A',postcode:'03-906',city:'Warszawa',osm_value:'restaurant'}}
 ]}),{status:200,headers:{'content-type':'application/json'}});
 const result=await searchPlaceAddress('Tuk Tuk, Francuska 3A, 03-906',{fetcher});
 assert.equal(result.status,'ok');
 assert.equal(result.provider,'photon-osm');
 assert.equal(result.name,'Tuk Tuk');
 assert.equal(result.address,'Francuska 3A, 03-906, Warszawa');
});

test('returns not-found when providers have no Warsaw result',async()=>{
 const fetcher=async()=>new Response(JSON.stringify({features:[]}),{status:200,headers:{'content-type':'application/json'}});
 const result=await searchPlaceAddress('Nieistniejące miejsce 123',{fetcher});
 assert.deepEqual(result,{status:'not-found'});
});
