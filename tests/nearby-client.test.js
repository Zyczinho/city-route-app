import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadNearbyPlaces,nearbyPlaceFromRow} from '../nearby-client.js';

const city={id:'krakow',slug:'krakow',name:'Kraków'};

test('nearby adapter keeps runtime place IDs and rounds distance',()=>{
 const place=nearbyPlaceFromRow({
  id:'wawel-castle',name:'Wawel',category_id:'landmark',area:'Wawel',description:'Opis',is_top:true,
  image_url:'wawel.jpg',lat:50.054,lng:19.935,dist_meters:498.6,tags:['classic','history']
 },'krakow');
 assert.equal(place.id,'wawel-castle');
 assert.equal(place.cityId,'krakow');
 assert.equal(place.categoryId,'landmark');
 assert.equal(place.distanceMeters,499);
 assert.deepEqual(place.tags,['classic','history']);
});

test('nearby loader sends one city-scoped RPC with bounded arguments',async()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:[{id:'x',name:'X',lat:50,lng:20,category_id:'museum',dist_meters:120,tags:[]}],error:null};}};
 const rows=await loadNearbyPlaces(client,{city,lat:'50.0647',lng:'19.9450',radiusM:5,maxResults:999,categoryIds:['museum','museum','cafe']});
 assert.equal(rows[0].id,'x');
 assert.deepEqual(calls,[['catalogue_nearby_places',{
  p_city_slug:'krakow',p_lat:50.0647,p_long:19.945,p_radius_m:50,p_max_results:200,p_category_ids:['museum','cafe']
 }]]);
});

test('nearby loader rejects invalid coordinates before calling backend',async()=>{
 let called=false;
 const client={rpc:async()=>{called=true;return {data:[],error:null};}};
 await assert.rejects(()=>loadNearbyPlaces(client,{city,lat:95,lng:20}),/nearby-lat-out-of-range/);
 assert.equal(called,false);
});

test('nearby loader propagates backend errors',async()=>{
 const client={rpc:async()=>({data:null,error:new Error('rpc failed')})};
 await assert.rejects(()=>loadNearbyPlaces(client,{city,lat:50,lng:20}),/rpc failed/);
});

test('nearby migration exposes public catalogue IDs instead of internal UUIDs',async()=>{
 const sql=await readFile('supabase/migrations/008_nearby_read_api.sql','utf8');
 assert.match(sql,/coalesce\(p\.legacy_id,p\.slug\) as id/i);
 assert.match(sql,/p\.status='published'/i);
 assert.match(sql,/p\.visibility='public'/i);
 assert.match(sql,/st_dwithin/i);
 assert.match(sql,/p_category_ids/i);
 assert.match(sql,/grant execute on function public\.catalogue_nearby_places/i);
});
