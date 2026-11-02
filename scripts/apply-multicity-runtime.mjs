import {readFile,writeFile} from 'node:fs/promises';

const file='app.js';
let s=await readFile(file,'utf8');

function replaceExact(from,to,label){
 const parts=s.split(from);
 if(parts.length!==2)throw new Error(`${label}: expected exactly one match, found ${parts.length-1}`);
 s=parts[0]+to+parts[1];
}

replaceExact(
 "import {summary,optimize,generate,advance,mapsUrl,routeMapsUrl,parseLocation,moveStop,distance,combinedRating,smoothedRating,matches} from './core.js';",
 "import {summary,optimize,generate,advance,mapsUrl,routeMapsUrl,parseLocation,moveStop,distance,combinedRating,smoothedRating,matches} from './core.js';\nimport {DEFAULT_CITY_ID,cityById,cityPoint,forCity,isInsideCity,routeTitle,searchQuery,withCityId} from './city-context.js';",
 'city-context import'
);

replaceExact(
 "state.profile={bio:'',...state.profile,socials:{instagram:'',tiktok:'',web:'',...state.profile?.socials}};",
 "state.profile={bio:'',...state.profile,socials:{instagram:'',tiktok:'',web:'',...state.profile?.socials}};\nstate.cityId=state.cityId||DEFAULT_CITY_ID;",
 'city state'
);

replaceExact(
 "let places=[],quests=[],routes=[],all={},cat='all',rcat='all',query='',cuisine='all',sort='default',pending=null,generated=null,editing=false,keepQuery=false,here=null,draft=null,bookTab=null,speaking=false,evScope='global',evWhen='week',evKind='all';const evCache={};",
 "let cities=[],taxonomy=null,activeCity=null,places=[],quests=[],routes=[],all={},cat='all',rcat='all',query='',cuisine='all',sort='default',pending=null,generated=null,editing=false,keepQuery=false,here=null,draft=null,bookTab=null,speaking=false,evScope='global',evWhen='week',evKind='all';const evCache={};",
 'runtime state'
);

replaceExact(
 "const isLive=()=>!!state.session&&!state.session.finished;",
 "const isLive=()=>!!state.session&&!state.session.finished;\nconst city=()=>activeCity||{id:DEFAULT_CITY_ID,slug:'warsaw',name:'Warszawa',center:{lat:52.2297,lng:21.0122},radiusKm:40,locale:'pl-PL',currency:'PLN'};",
 'active city helper'
);

replaceExact(
 "const catalog=()=>[...places,...state.userPlaces].filter(p=>p.kind!=='hotel');",
 "const catalog=()=>[...places,...forCity(state.userPlaces,city().id)].filter(p=>p.kind!=='hotel');",
 'city catalogue'
);

replaceExact(
 "const q=p=>encodeURIComponent(p.name+' Warszawa');",
 "const q=p=>encodeURIComponent(searchQuery(p,city()));",
 'provider search city'
);

replaceExact(
 "const list=routes.filter(r=>(rcat==='all'||r.cats.includes(rcat))&&matches(hay(r),query)),mine=state.myRoutes.filter(r=>matches(hay(r),query));",
 "const list=routes.filter(r=>(rcat==='all'||r.cats.includes(rcat))&&matches(hay(r),query)),mine=forCity(state.myRoutes,city().id).filter(r=>matches(hay(r),query));",
 'route city filter'
);

replaceExact(
 "'Gotowe spacery po Warszawie. Wybierz, ruszaj, a aplikacja poprowadzi Cię przystanek po przystanku.'",
 "`Gotowe spacery po ${esc(city().name)}. Wybierz, ruszaj, a aplikacja poprowadzi Cię przystanek po przystanku.`",
 'routes city copy'
);

replaceExact(
 "if(d.status==='loading')return '<div class=\"empty\"><p>Sprawdzamy, co dzieje się w Warszawie…</p></div>';",
 "if(d.status==='loading')return `<div class=\"empty\"><p>Sprawdzamy, co dzieje się w ${esc(city().name)}…</p></div>`;",
 'events loading copy'
);

replaceExact(
 "<h1>Co się dzieje w Warszawie?</h1>",
 "<h1>Co się dzieje w ${esc(city().name)}?</h1>",
 'events title'
);

replaceExact(
 "<h1>Kawałek Warszawy więcej.</h1>",
 "<h1>Kawałek ${esc(city().name)} więcej.</h1>",
 'finished route copy'
);

replaceExact(
 "<h2 class=\"h-sm\">Jak jesteś w Warszawie?</h2>",
 "<h2 class=\"h-sm\">Jak jesteś w ${esc(city().name)}?</h2>",
 'profile city copy'
);

replaceExact(
 "mam kilka godzin w Warszawie — co naprawdę warto zobaczyć i jak najprościej to obejść?",
 "mam kilka godzin w ${esc(city().name)} — co naprawdę warto zobaczyć i jak najprościej to obejść?",
 'about city thesis'
);

replaceExact(
 "Startujemy w Warszawie. Wspólne miejsca i wydarzenia od społeczności pojawią się razem z kontami.",
 "Aktualnie aktywne miasto: ${esc(city().name)}. Kolejne miasta uruchamiamy na tym samym City Route Core.",
 'about rollout copy'
);

replaceExact(
 "function saveRoute(r){const saved={id:'mine-'+uuid().slice(0,8),name:r.name,description:r.description,stops:r.stops.slice(),cats:[],transport:r.transport||'walking',createdAt:new Date().toISOString()};",
 "function saveRoute(r){const saved={id:'mine-'+uuid().slice(0,8),cityId:city().id,name:r.name,description:r.description,stops:r.stops.slice(),cats:[],transport:r.transport||'walking',createdAt:new Date().toISOString()};",
 'saved route city'
);

replaceExact(
 "if(distance(loc,{lat:52.2297,lng:21.0122})>40)return toast('To miejsce jest dalej niż 40 km od Warszawy.');",
 "if(!isInsideCity(loc,city()))return toast(`To miejsce jest dalej niż ${city().radiusKm} km od ${city().name}.`);",
 'place radius'
);

replaceExact(
 "const c=draft.cat||'okolice',p={id:'u-'+uuid().slice(0,8),kind:'user',visibility:draft.vis==='public'?'public':'private',",
 "const c=draft.cat||'okolice',p={id:'u-'+uuid().slice(0,8),cityId:city().id,categoryId:taxonomy?.legacyAliases?.[c]||c,kind:'user',visibility:draft.vis==='public'?'public':'private',",
 'user place city/category'
);

replaceExact(
 "if(start&&distance(start,{lat:52.2297,lng:21.0122})>25){toast('Jesteś daleko od Warszawy — układam trasę bez punktu startu.');start=null;}",
 "if(start&&distance(start,cityPoint(city()))>Math.min(25,city().radiusKm)){toast(`Jesteś daleko od ${city().name} — układam trasę bez punktu startu.`);start=null;}",
 'planner city radius'
);

replaceExact(
 "generated={id:'generated',name:'Warszawa po Twojemu',",
 "generated={id:'generated',cityId:city().id,name:routeTitle(city()),",
 'generated route city'
);

replaceExact(
 "[places,quests,routes]=await Promise.all(['places','sidequests','routes'].map(async n=>{const r=await fetch(`./data/${n}.json`);if(!r.ok)throw Error(n);return r.json();}));\n all=Object.fromEntries([...places,...quests,...state.userPlaces].map(p=>[p.id,p]));",
 "[cities,taxonomy,places,quests,routes]=await Promise.all(['cities','taxonomy','places','sidequests','routes'].map(async n=>{const r=await fetch(`./data/${n}.json`);if(!r.ok)throw Error(n);return r.json();}));\n activeCity=cityById(cities,state.cityId);if(!activeCity)throw Error('city');state.cityId=activeCity.id;\n places=forCity(withCityId(places,DEFAULT_CITY_ID),activeCity.id);quests=forCity(withCityId(quests,DEFAULT_CITY_ID),activeCity.id);routes=forCity(withCityId(routes,DEFAULT_CITY_ID),activeCity.id);\n state.userPlaces=withCityId(state.userPlaces,DEFAULT_CITY_ID);state.myRoutes=withCityId(state.myRoutes,DEFAULT_CITY_ID);\n all=Object.fromEntries([...places,...quests,...forCity(state.userPlaces,activeCity.id)].map(p=>[p.id,p]));",
 'city-aware data load'
);

replaceExact(
 "const result=generate([...places,...state.userPlaces],prefs);",
 "const result=generate([...places,...forCity(state.userPlaces,city().id)],prefs);",
 'planner city places'
);

await writeFile(file,s);
console.log('Applied guarded multi-city runtime refactor.');
