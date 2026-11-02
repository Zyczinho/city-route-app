import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cityById,forCity,isInsideCity,routeTitle,searchQuery,withCityId,legacyCategory} from '../city-context.js';

const cities=JSON.parse(await readFile(new URL('../data/cities.json',import.meta.url),'utf8'));
const taxonomy=JSON.parse(await readFile(new URL('../data/taxonomy.json',import.meta.url),'utf8'));

test('Warsaw remains the launch city and Krakow is the next acceptance city',()=>{
 assert.equal(cityById(cities,'warsaw').status,'launch');
 assert.equal(cityById(cities,'krakow').status,'next');
 assert.equal(cities.filter(c=>c.countryCode==='PL').length,7);
});

test('legacy Warsaw data is assigned to Warsaw without rewriting every record',()=>{
 const items=withCityId([{id:'old-town'},{id:'krakow-test',cityId:'krakow'}]);
 assert.equal(items[0].cityId,'warsaw');
 assert.deepEqual(forCity(items,'warsaw').map(x=>x.id),['old-town']);
 assert.deepEqual(forCity(items,'krakow').map(x=>x.id),['krakow-test']);
});

test('city helpers remove Warsaw-specific search and radius assumptions',()=>{
 const krakow=cityById(cities,'krakow');
 assert.equal(searchQuery({name:'Wawel'},krakow),'Wawel Kraków');
 assert.equal(routeTitle(krakow),'Kraków po Twojemu');
 assert.equal(isInsideCity({lat:50.0619,lng:19.9368},krakow),true);
 assert.equal(isInsideCity({lat:52.2297,lng:21.0122},krakow),false);
});

test('global taxonomy separates category from city-specific collections',()=>{
 const ids=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
 for(const id of ['landmark','museum','restaurant','bar','club','hotel'])assert.equal(ids.has(id),true);
 assert.equal(ids.has('wisla'),false);
 assert.equal(legacyCategory({cats:['zabytki']},taxonomy.legacyAliases),'landmark');
 assert.equal(legacyCategory({cats:['jedzenie']},taxonomy.legacyAliases),'restaurant');
});
