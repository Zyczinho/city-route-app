import {readFile,writeFile} from 'node:fs/promises';

function replaceExact(source,from,to,label){
 const parts=source.split(from);
 if(parts.length!==2)throw new Error(`${label}: expected exactly one match, found ${parts.length-1}`);
 return parts[0]+to+parts[1];
}

let app=await readFile('app.js','utf8');
app=replaceExact(
 app,
 "import {DEFAULT_CITY_ID,cityById,cityPoint,forCity,isInsideCity,routeTitle,searchQuery,withCityId} from './city-context.js';",
 "import {DEFAULT_CITY_ID,cityById,cityPoint,forCity,isInsideCity,routeTitle,searchQuery,withCityId} from './city-context.js';\nimport {createRestRpcClient,loadCatalogueWithFallback} from './catalogue-client.js';\nimport {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';",
 'catalogue imports'
);

app=replaceExact(
 app,
 " [cities,taxonomy,places,quests,routes]=await Promise.all(['cities','taxonomy','places','sidequests','routes'].map(async n=>{const r=await fetch(`./data/${n}.json`);if(!r.ok)throw Error(n);return r.json();}));\n activeCity=cityById(cities,state.cityId);if(!activeCity)throw Error('city');state.cityId=activeCity.id;\n places=forCity(withCityId(places,DEFAULT_CITY_ID),activeCity.id);quests=forCity(withCityId(quests,DEFAULT_CITY_ID),activeCity.id);routes=forCity(withCityId(routes,DEFAULT_CITY_ID),activeCity.id);",
 " let staticPlaces,staticRoutes;\n [cities,taxonomy,staticPlaces,quests,staticRoutes]=await Promise.all(['cities','taxonomy','places','sidequests','routes'].map(async n=>{const r=await fetch(`./data/${n}.json`);if(!r.ok)throw Error(n);return r.json();}));\n activeCity=cityById(cities,state.cityId);if(!activeCity)throw Error('city');state.cityId=activeCity.id;\n const jsonCatalogue={places:forCity(withCityId(staticPlaces,DEFAULT_CITY_ID),activeCity.id),routes:forCity(withCityId(staticRoutes,DEFAULT_CITY_ID),activeCity.id)};\n const catalogueClient=createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});\n const catalogueData=await loadCatalogueWithFallback({client:catalogueClient,city:activeCity,fallback:jsonCatalogue});\n places=catalogueData.places;routes=catalogueData.routes;quests=forCity(withCityId(quests,DEFAULT_CITY_ID),activeCity.id);\n document.documentElement.dataset.catalogueSource=catalogueData.source;",
 'catalogue data loader'
);
await writeFile('app.js',app);

let sw=await readFile('service-worker.js','utf8');
sw=replaceExact(sw,"const CACHE='city-route-v22';","const CACHE='city-route-v23';",'service worker version');
sw=replaceExact(
 sw,
 "'./core.js', './city-context.js', './enhancements.js'",
 "'./core.js', './city-context.js', './catalogue-client.js', './supabase-config.js', './enhancements.js'",
 'service worker catalogue assets'
);
await writeFile('service-worker.js',sw);

console.log('Applied Supabase-first catalogue cutover with JSON fallback.');
