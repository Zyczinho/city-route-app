// PHOTO-LIBRARY-176: permanent licensed covers must be exact, credited and never replace an existing cover.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyPhotoLibrary,loadCatalogueWithFallback} from '../catalogue-client.js';
import {findGooglePlaceId} from '../place-thumb.js';

const CITIES=['warsaw','krakow','lisbon'];
const entry={name:'Panteão Nacional',lat:38.715,lng:-9.1247,
 image:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Panteao.jpg/960px-Panteao.jpg',
 imageThumb:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Panteao.jpg/330px-Panteao.jpg',
 imageCredit:{author:'Jan Kowalski',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0',source:'https://commons.wikimedia.org/wiki/File:Panteao.jpg',via:'Wikimedia Commons'}};
const place={id:'pantheon',name:'Panteão Nacional',lat:38.7151,lng:-9.1247,image:null};
const lib=photos=>({version:1,photos});

test('a library cover is applied to the same place with thumbnail and full credit',()=>{
 const [p]=applyPhotoLibrary([place],lib({pantheon:entry}));
 assert.equal(p.image,entry.image);assert.equal(p.imageThumb,entry.imageThumb);assert.equal(p.imageFromLibrary,true);
 assert.deepEqual(p.imageCredit,entry.imageCredit);
});

test('a library cover never replaces an existing cover or attaches to another place',()=>{
 const own={...place,image:'lisbon-own.jpg'};
 assert.equal(applyPhotoLibrary([own],lib({pantheon:entry}))[0],own);
 const renamed={...place,name:'Igreja de Santa Engrácia'};
 assert.equal(applyPhotoLibrary([renamed],lib({pantheon:entry}))[0],renamed);
 const moved={...place,lat:38.73};
 assert.equal(applyPhotoLibrary([moved],lib({pantheon:entry}))[0],moved);
 const otherId={...place,id:'other'};
 assert.equal(applyPhotoLibrary([otherId],lib({pantheon:entry}))[0],otherId);
});

test('entries without a Wikimedia file or a complete credit are ignored',()=>{
 for(const bad of [{...entry,image:'https://example.com/a.jpg'},{...entry,imageCredit:{...entry.imageCredit,author:''}},
  {...entry,imageCredit:{...entry.imageCredit,source:'https://example.com/x'}},{...entry,imageCredit:null}])
  assert.equal(applyPhotoLibrary([place],lib({pantheon:bad}))[0],place);
 assert.deepEqual(applyPhotoLibrary([place],null),[place]);
});

test('the library is applied on both the live catalogue and the JSON fallback',async()=>{
 const row={id:'pantheon',name:place.name,lat:place.lat,lng:place.lng,category_id:'landmark'};
 const client={rpc:async name=>({data:name==='catalogue_places'?[row]:[],error:null})};
 const live=await loadCatalogueWithFallback({client,city:{id:'lisbon'},fallback:{places:[],routes:[]},photoLibrary:lib({pantheon:entry})});
 assert.equal(live.source,'supabase');assert.equal(live.places[0].image,entry.image);
 const broken={rpc:async()=>({data:null,error:new Error('offline')})};
 const offline=await loadCatalogueWithFallback({client:broken,city:{id:'lisbon'},fallback:{places:[place],routes:[]},photoLibrary:lib({pantheon:entry})});
 assert.equal(offline.source,'json');assert.equal(offline.places[0].image,entry.image);
});

test('every shipped library entry is a credited Wikimedia Commons photo of a catalogue place',async()=>{
 let total=0;
 for(const city of CITIES){
  const library=JSON.parse(await readFile(new URL(`../data/photo-library/${city}.json`,import.meta.url),'utf8'));
  const catalogue=JSON.parse(await readFile(new URL(`../data/cities/${city}/places.json`,import.meta.url),'utf8'));
  const byId=new Map(catalogue.map(p=>[p.id,p]));
  assert.equal(library.city,city);
  for(const [id,e] of Object.entries(library.photos)){
   total++;
   for(const url of [e.image,e.imageThumb]){
    assert.match(url,/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/[^?]+$/,`${city}/${id}`);
   }
   assert.ok(e.imageCredit.author&&e.imageCredit.license,`${city}/${id} credit`);
   assert.match(e.imageCredit.license,/^(?:CC BY|CC0|Public domain|PD-)/i,`${city}/${id} licence`);
   assert.match(e.imageCredit.source,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,`${city}/${id} source`);
   assert.match(e.wikidata,/^Q[1-9]\d*$/,`${city}/${id} wikidata`);
   assert.ok(byId.has(id),`${city}/${id} is not a catalogue place`);
   assert.equal(applyPhotoLibrary([{...byId.get(id),image:null}],library)[0].image,e.image,`${city}/${id} does not pass the identity gate`);
  }
 }
 assert.ok(total>=200,`library shrank to ${total} photos`);
});

test('library files ship with the app, are precached and drive list thumbnails with a fallback',async()=>{
 const [app,sw,build]=await Promise.all(['app.js','service-worker.js','scripts/build.mjs'].map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
 for(const city of CITIES)assert.ok(sw.includes(`'./data/photo-library/${city}.json'`),city);
 assert.match(build,/'data'/);
 assert.match(app,/photoLibrary:await loadPhotoLibrary\(next\)/);
 assert.match(app,/photoLibrary:await loadPhotoLibrary\(activeCity\)/);
 assert.match(app,/data-library-for=/);
 assert.match(app,/if\(img\.dataset\.libraryFor\)\{/);
 assert.match(app,/lang:String\(c\.locale\|\|'pl'\)\.slice\(0,2\)/);
});

test('the Google place check asks for the name in the language of the city',async()=>{
 const ID='ChIJabcdefghijklmnop',calls=[];
 const fetcher=async(url,init={})=>{
  calls.push({url:String(url),body:init.body?JSON.parse(init.body):null});
  const ok=body=>({ok:true,json:async()=>body});
  if(String(url).endsWith('places:searchText'))return ok({places:[{id:ID}]});
  return ok(String(url).includes('languageCode=pt')?{id:ID,displayName:{text:'Panteão Nacional'},location:{latitude:38.715,longitude:-9.1247}}
   :{id:ID,displayName:{text:'National Pantheon'},location:{latitude:38.715,longitude:-9.1247}});
 };
 const params={name:'Panteão Nacional',lat:38.715,lng:-9.1247,cityName:'Lizbona',googleKey:'k',fetcher};
 assert.equal(await findGooglePlaceId({...params,languageCode:'pt',regionCode:'PT'}),ID);
 assert.equal(calls[0].body.languageCode,'pt');assert.equal(calls[0].body.regionCode,'PT');
 assert.ok(calls[1].url.endsWith(ID+'?languageCode=pt'));
 // Unsafe values fall back to the Polish defaults instead of reaching the provider URL.
 calls.length=0;await findGooglePlaceId({...params,languageCode:'x&y=1',regionCode:'??'});
 assert.equal(calls[0].body.languageCode,'pl');assert.equal(calls[0].body.regionCode,'PL');
});
