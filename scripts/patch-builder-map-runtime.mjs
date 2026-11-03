import {readFile,writeFile} from 'node:fs/promises';

function replaceOnce(text,from,to,label){
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw new Error(`${label}: expected exactly one anchor`);
  return text.replace(from,to);
}

let app=await readFile('app.js','utf8');
app=replaceOnce(
  app,
  "state.basketsByCity[nextDraft.cityId]=[...nextDraft.stops];if(eventType){",
  "state.basketsByCity[nextDraft.cityId]=[...nextDraft.stops];mapView?.setRouteStops(items(nextDraft.stops));if(eventType){",
  'builder live map sync'
);
app=replaceOnce(
  app,
  " mapView=view;\n}",
  " mapView=view;\n view.setRouteStops(items(builderDraft?.stops||[]));\n}",
  'builder map mount sync'
);
await writeFile('app.js',app);

let sw=await readFile('service-worker.js','utf8');
sw=replaceOnce(sw,"city-route-v27","city-route-v28",'service worker cache version');
await writeFile('service-worker.js',sw);

for(const path of ['tests/cover-wiring.test.js','tests/map-integration.test.js','tests/builder-runtime-wiring.test.js']){
  let text=await readFile(path,'utf8');
  text=text.replaceAll('city-route-v27','city-route-v28').replaceAll('PWA cache v27','PWA cache v28');
  await writeFile(path,text);
}

await writeFile('tests/builder-map-runtime.test.js',`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\n\ntest('Route Builder draft is synchronized to the map after mutations and mount',async()=>{\n const app=await readFile('app.js','utf8');\n assert.match(app,/mapView\\?\\.setRouteStops\\(items\\(nextDraft\\.stops\\)\\)/);\n assert.match(app,/mapView=view;\\s*view\\.setRouteStops\\(items\\(builderDraft\\?\\.stops\\|\\|\\[\\]\\)\\)/);\n});\n\ntest('builder-map integration invalidates the PWA cache',async()=>{\n const sw=await readFile('service-worker.js','utf8');\n assert.match(sw,/city-route-v28/);\n assert.match(sw,/map-view\\.js/);\n assert.match(sw,/route-builder-model\\.js/);\n});\n`);
