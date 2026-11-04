import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestRpcClient,loadCatalogueWithFallback,loadSupabaseCatalogue,placeFromCatalogue,routeFromCatalogue,mergeCuratedPhotos} from '../catalogue-client.js';

const city={id:'warsaw',slug:'warsaw',name:'Warszawa'};

test('place adapter preserves legacy app shape plus global category',()=>{
 const p=placeFromCatalogue({
  id:'old-town',name:'Rynek',lat:52.25,lng:21.01,category_id:'landmark',area:'Stare Miasto',description:'Opis',minutes:25,cost_minor:1500,currency:'PLN',tourist_level:'must',food_style:'none',partner:false,is_top:true,image_url:'x.jpg',image_meta:{caption:'Widok',credit:{author:'A'}},metadata:{kind:'place',outside:true},tags:['culture'],ratings:[{source:'google',value:4.7,max:5,reviewCount:10}]
 },'warsaw');
 assert.equal(p.id,'old-town');
 assert.equal(p.cityId,'warsaw');
 assert.equal(p.categoryId,'landmark');
 assert.deepEqual(p.cats,['zabytki']);
 assert.equal(p.cost,15);
 assert.equal(p.outside,true);
 assert.equal(p.imageCredit.author,'A');
 assert.equal(p.ratings[0].value,4.7);
});

test('route adapter keeps ordered stop slugs and route tags',()=>{
 const r=routeFromCatalogue({id:'old-warsaw',name:'Pierwszy raz',description:'x',transport:'walking',metadata:{legacy:{cats:['klasyka']}},tags:['klasyka'],stops:['castle','old-town']},'warsaw');
 assert.equal(r.cityId,'warsaw');
 assert.deepEqual(r.stops,['castle','old-town']);
 assert.deepEqual(r.cats,['klasyka']);
});

test('REST client calls Supabase RPC without depending on supabase-js CDN',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{calls.push([url,init]);return {ok:true,status:200,text:async()=>JSON.stringify([{id:'x'}])};};
 const client=createRestRpcClient({url:'https://example.supabase.co',key:'publishable',fetchImpl});
 const result=await client.rpc('catalogue_places',{city_slug:'warsaw'});
 assert.equal(result.error,null);
 assert.equal(result.data[0].id,'x');
 assert.equal(calls[0][0],'https://example.supabase.co/rest/v1/rpc/catalogue_places');
 assert.equal(calls[0][1].headers.apikey,'publishable');
 assert.equal(calls[0][1].body,JSON.stringify({city_slug:'warsaw'}));
});

test('Supabase loader calls only city-scoped catalogue RPCs',async()=>{
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push([name,args]);return name==='catalogue_places'?{data:[{id:'x',name:'X',lat:1,lng:2,category_id:'museum',tags:[],ratings:[]}],error:null}:{data:[{id:'r',name:'R',stops:['x'],tags:[]}],error:null};}};
 const data=await loadSupabaseCatalogue(client,city);
 assert.equal(data.source,'supabase');
 assert.deepEqual(calls,[['catalogue_places',{city_slug:'warsaw'}],['catalogue_routes',{city_slug:'warsaw'}]]);
 assert.equal(data.places[0].cityId,'warsaw');
});

test('fallback keeps production usable before migrations/cutover',async()=>{
 const client={rpc:async()=>({data:null,error:new Error('missing function')})};
 const data=await loadCatalogueWithFallback({client,city,fallback:{places:[{id:'json'}],routes:[{id:'json-route'}]}});
 assert.equal(data.source,'json');
 assert.equal(data.places[0].id,'json');
});

test('licensed curated images are reused only for exact place and nearby matching coordinates',()=>{
 const source={name:'Zamek Królewski',lat:52.247,lng:21.014,image:'castle.jpg',
  imageCredit:{via:'Wikimedia Commons',author:'Editor',license:'CC BY 4.0',source:'https://commons.wikimedia.org/wiki/File:Castle'}};
 const venue={...source,name:'Restauracja X',image:'venue.jpg',imageCredit:{via:'oficjalna strona',author:'Venue'}};
 const live=[
  {id:'same',name:'Zamek Królewski',lat:52.2472,lng:21.014,image:null},
  {id:'distant',name:'Zamek Królewski',lat:52.255,lng:21.020,image:null},
  {id:'similar',name:'Zamek Królewski II',lat:52.247,lng:21.014,image:null},
  {id:'venue',name:'Restauracja X',lat:52.247,lng:21.014,image:null},
  {id:'already',name:'Zamek Królewski',lat:52.247,lng:21.014,image:'owned.jpg'}
 ];
 const result=mergeCuratedPhotos(live,[source,venue]);
 assert.equal(result[0].image,'castle.jpg');
 assert.equal(result[0].imageCredit.author,'Editor');
 assert.equal(result[1].image,null);
 assert.equal(result[2].image,null);
 assert.equal(result[3].image,null,'venue-hosted image without permission is not borrowed');
 assert.equal(result[4].image,'owned.jpg');
});
