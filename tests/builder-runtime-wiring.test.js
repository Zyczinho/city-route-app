import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Route Builder model is wired into runtime persistence and mutations',async()=>{
 const app=await readFile('app.js','utf8');
 assert.match(app,/from '.\/route-builder-model\.js'/);
 assert.match(app,/builderMetaByCity/);
 assert.match(app,/hydrateBuilderDraft/);
 assert.match(app,/addStop\(builderDraft/);
 assert.match(app,/removeStop\(builderDraft/);
 assert.match(app,/moveStopBy\(builderDraft/);
 assert.match(app,/moveStopToTargetIndex\(builderDraft/);
 assert.match(app,/toRoute\(builderDraft/);
 assert.doesNotMatch(app,/state\.basket\.push\(/);
 assert.match(app,/isLive\(\).*Najpierw zakończ aktywną trasę/);
 assert.match(app,/builderDraft=createDraft\(city\(\)\.id/);
});

test('Route Builder model ships in build and PWA cache v32',async()=>{
 const build=await readFile('scripts/build.mjs','utf8'),sw=await readFile('service-worker.js','utf8');
 assert.match(build,/route-builder-model\.js/);
 assert.match(sw,/city-route-v35/);
 assert.match(sw,/route-builder-model\.js/);
});
