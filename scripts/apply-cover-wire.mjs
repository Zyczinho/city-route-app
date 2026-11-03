import {readFile,writeFile} from 'node:fs/promises';

const replaceOnce=(source,from,to,label)=>{
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Missing pattern: ${label}`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Pattern not unique: ${label}`);
  return source.slice(0,first)+to+source.slice(first+from.length);
};

let app=await readFile('app.js','utf8');
app=replaceOnce(app,
  "import {createMapView} from './map-view.js';\n",
  "import {createMapView} from './map-view.js';\nimport {assignRouteCovers} from './route-covers.js';\n",
  'route-covers import');
app=replaceOnce(app,
  "const findRoute=id=>routes.find(r=>r.id===id)||state.myRoutes.find(r=>r.id===id)||(generated?.id===id?generated:null);\n",
  "const findRoute=id=>routes.find(r=>r.id===id)||state.myRoutes.find(r=>r.id===id)||(generated?.id===id?generated:null);\nconst coverRoutes=()=>[...routes,...forCity(state.myRoutes,city().id),...(generated?[generated]:[])];\nconst routeCoverAssignments=()=>assignRouteCovers(coverRoutes(),id=>all[id]);\n",
  'route cover helpers');
app=replaceOnce(app,
  "function routeCard(r,big=false){const ps=items(r.stops),s=summary(ps,r.transport),cover=ps.find(p=>p.image);\n",
  "function routeCard(r,big=false,covers=routeCoverAssignments()){const ps=items(r.stops),s=summary(ps,r.transport),cover=covers.get(r.id)||null;\n",
  'routeCard cover');
app=replaceOnce(app,
  " const list=routes.filter(r=>(rcat==='all'||r.cats.includes(rcat))&&matches(hay(r),query)),mine=forCity(state.myRoutes,city().id).filter(r=>matches(hay(r),query));\n const placeHits=query?catalog().filter(p=>matches(placeHay(p),query)).length:0;\n",
  " const list=routes.filter(r=>(rcat==='all'||r.cats.includes(rcat))&&matches(hay(r),query)),mine=forCity(state.myRoutes,city().id).filter(r=>matches(hay(r),query));\n const covers=routeCoverAssignments();\n const placeHits=query?catalog().filter(p=>matches(placeHay(p),query)).length:0;\n",
  'routesView assignments');
app=replaceOnce(app,
  "${list.length?`<div class=\"route-grid\">${list.map((r,i)=>routeCard(r,i===0&&!query&&rcat==='all')).join('')}</div>`:`<div class=\"empty\"><p>Nie mamy trasy pasującej do „${esc(query)}”.</p><a class=\"button primary\" href=\"#plan\">${ic('wand-sparkles')}Ułóż własną trasę</a></div>`}",
  "${list.length?`<div class=\"route-grid\">${list.map((r,i)=>routeCard(r,i===0&&!query&&rcat==='all',covers)).join('')}</div>`:`<div class=\"empty\"><p>Nie mamy trasy pasującej do „${esc(query)}”.</p><a class=\"button primary\" href=\"#plan\">${ic('wand-sparkles')}Ułóż własną trasę</a></div>`}",
  'editorial card assignment');
app=replaceOnce(app,
  "${mine.length?`<div class=\"route-grid\">${mine.map(r=>routeCard(r)).join('')}</div>`:''}",
  "${mine.length?`<div class=\"route-grid\">${mine.map(r=>routeCard(r,false,covers)).join('')}</div>`:''}",
  'user card assignment');
app=replaceOnce(app,
  "function detailView(r){const ps=items(r.stops),own=state.myRoutes.some(x=>x.id===r.id);\n return `<section class=\"detail\"><a class=\"back\" href=\"#routes\">${ic('arrow-left')}Trasy</a><div class=\"cover\">${photo(ps.find(p=>p.image),'',true)}</div><p class=\"kicker\">",
  "function detailView(r){const ps=items(r.stops),own=state.myRoutes.some(x=>x.id===r.id),cover=routeCoverAssignments().get(r.id)||null;\n return `<section class=\"detail\"><a class=\"back\" href=\"#routes\">${ic('arrow-left')}Trasy</a><div class=\"cover\">${photo(cover,'',true)}</div>${credit(cover)}<p class=\"kicker\">",
  'detail cover and credit');
await writeFile('app.js',app);

let build=await readFile('scripts/build.mjs','utf8');
build=replaceOnce(build,"'map-view.js','map.css'","'map-view.js','map.css','route-covers.js'",'build route-covers');
await writeFile('scripts/build.mjs',build);

let sw=await readFile('service-worker.js','utf8');
sw=replaceOnce(sw,"const CACHE='city-route-v25';","const CACHE='city-route-v26';",'service worker version');
sw=replaceOnce(sw,"'./map-view.js', './map.css'","'./map-view.js', './map.css', './route-covers.js'",'service worker route-covers');
await writeFile('service-worker.js',sw);

const test=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\n\ntest('route cover module is wired into route cards, detail, build and PWA cache',async()=>{\n const [app,build,sw]=await Promise.all([readFile('app.js','utf8'),readFile('scripts/build.mjs','utf8'),readFile('service-worker.js','utf8')]);\n assert.match(app,/import \\{assignRouteCovers\\} from '\\.\\/route-covers\\.js';/);\n assert.match(app,/const routeCoverAssignments=\\(\\)=>assignRouteCovers\\(coverRoutes\\(\\),id=>all\\[id\\]\\)/);\n assert.match(app,/function routeCard\\(r,big=false,covers=routeCoverAssignments\\(\\)\\)/);\n assert.match(app,/cover=covers\\.get\\(r\\.id\\)\\|\\|null/);\n assert.match(app,/cover=routeCoverAssignments\\(\\)\\.get\\(r\\.id\\)\\|\\|null/);\n assert.match(app,/\\$\\{credit\\(cover\\)\\}/);\n assert.doesNotMatch(app,/detailView\\(r\\)[\\s\\S]{0,500}photo\\(ps\\.find\\(p=>p\\.image\\)/);\n assert.match(build,/route-covers\\.js/);\n assert.match(sw,/city-route-v26/);\n assert.match(sw,/route-covers\\.js/);\n});\n`;
await writeFile('tests/cover-wiring.test.js',test);
