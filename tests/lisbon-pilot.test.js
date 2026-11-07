import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cityById,forCity,isInsideCity,routeTitle,searchQuery} from '../city-context.js';

const read=async path=>readFile(new URL(path,import.meta.url),'utf8');
const cities=JSON.parse(await read('../data/cities.json'));
const app=await read('../app.js');
const sql=await read('../supabase/migrations/020_register_lisbon_pilot.sql');

test('Lisbon is selectable as a pilot without altering Warsaw or Krakow',()=>{
 const city=cityById(cities,'lisbon');
 assert.equal(city.id,'lisbon');
 assert.equal(city.slug,'lisbon');
 assert.equal(city.name,'Lizbona');
 assert.equal(city.country,'Portugalia');
 assert.equal(city.countryCode,'PT');
 assert.equal(city.locale,'pt-PT');
 assert.equal(city.currency,'EUR');
 assert.equal(city.timezone,'Europe/Lisbon');
 assert.equal(city.radiusKm,25);
 assert.equal(city.status,'next');
 assert.deepEqual(city.center,{lat:38.7223,lng:-9.1393});
 assert.equal(cityById(cities,'warsaw').status,'launch');
 assert.equal(cityById(cities,'krakow').status,'next');
 assert.equal(cities.filter(c=>c.countryCode==='PL').length,7);
 assert.equal(new Set(cities.map(c=>c.id)).size,cities.length);
 assert.equal(new Set(cities.map(c=>c.slug)).size,cities.length);
 assert.match(app,/function cityPicker\(\)/);
 assert.match(app,/\['launch','next'\]\.includes\(c\.status\)/);
});

test('Lisbon coordinate validation, route titles, source search and city isolation',()=>{
 const city=cityById(cities,'lisbon');
 assert.equal(isInsideCity({lat:38.7077,lng:-9.1366},city),true,'Praça do Comércio should be inside Lisbon');
 assert.equal(isInsideCity({lat:38.7636,lng:-9.0939},city),true,'Parque das Nações should be inside Lisbon');
 assert.equal(isInsideCity({lat:38.7223,lng:-8.8},city),false,'far-away place should be rejected');
 assert.equal(searchQuery({name:'Castelo de São Jorge'},city),'Castelo de São Jorge Lizbona');
 assert.equal(routeTitle(city),'Lizbona po Twojemu');
 const mixed=[{id:'waw',cityId:'warsaw'},{id:'lx1',cityId:'lisbon'},{id:'krk',cityId:'krakow'}];
 assert.deepEqual(forCity(mixed,'lisbon').map(x=>x.id),['lx1']);
 assert.deepEqual(forCity(mixed,'warsaw').map(x=>x.id),['waw']);
});

test('Lisbon fallback datasets are empty and truthful before curation',async()=>{
 const [places,routes]=await Promise.all([
  read('../data/cities/lisbon/places.json').then(JSON.parse),
  read('../data/cities/lisbon/routes.json').then(JSON.parse)
 ]);
 assert.deepEqual(places,[]);
 assert.deepEqual(routes,[]);
 assert.match(app,/loadCityFallback\(next\)/);
 assert.match(app,/loadCatalogueWithFallback/);
 assert.match(app,/basketsByCity/);
});

test('hosted city registry migration is additive, geographic and idempotent',()=>{
 assert.match(sql,/insert into public\.cities\(/i);
 assert.match(sql,/'lisbon','Lizbona','Portugalia','PT','pt-PT','EUR','Europe\/Lisbon'/);
 assert.match(sql,/extensions\.st_point\(-9\.1393,38\.7223\)::extensions\.geography/);
 assert.match(sql,/12,25,'next'/);
 assert.match(sql,/on conflict\s*\(slug\)\s*do nothing/i);
 assert.doesNotMatch(sql,/\b(delete|truncate|drop|update)\s+(?:from\s+)?public\.(?:places|routes|cities)\b/i);
});
