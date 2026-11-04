import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('route cover module is wired into route cards, detail, build and PWA cache',async()=>{
 const [app,build,sw]=await Promise.all([readFile('app.js','utf8'),readFile('scripts/build.mjs','utf8'),readFile('service-worker.js','utf8')]);
 assert.match(app,/import \{assignRouteCovers\} from '\.\/route-covers\.js';/);
 assert.match(app,/const routeCoverAssignments=\(\)=>assignRouteCovers\(coverRoutes\(\),id=>all\[id\]\)/);
 assert.match(app,/function routeCard\(r,big=false,covers=routeCoverAssignments\(\)\)/);
 assert.match(app,/cover=covers\.get\(r\.id\)\|\|null/);
 assert.match(app,/cover=routeCoverAssignments\(\)\.get\(r\.id\)\|\|null/);
 assert.match(app,/\$\{credit\(cover\)\}/);
 assert.match(app,/function credit\(p\)\{const c=p\?\.imageCredit/,'missing cover must not crash attribution');
 assert.doesNotMatch(app,/detailView\(r\)[\s\S]{0,500}photo\(ps\.find\(p=>p\.image\)/);
 assert.match(build,/route-covers\.js/);
 assert.match(sw,/city-route-v41/);
 assert.match(sw,/route-covers\.js/);
});
