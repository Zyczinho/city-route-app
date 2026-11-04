import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('visit rating stays local and never inflates Google/Tripadvisor weighted mean',async()=>{
 const [app,core]=await Promise.all([read('app.js'),read('core.js')]);
 assert.match(app,/data-action="arrival-rating"/);
 assert.match(app,/data-action="arrival-skip-rating"/);
 assert.match(app,/state\.placeReviews\[stop\]=rating/);
 assert.match(app,/verified:false/,'arrivals are not geolocated or externally verified');
 assert.match(app,/Ocena jest dobrowolna/);
 assert.match(app,/City Route.*Twoja ocena/);
 const start=core.indexOf('export function combinedRating'),end=core.indexOf('export function smoothedRating',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(core.slice(start,end),/placeReviews|cityroute/,'City Route ratings must stay out of external-weighted score');
});

test('completion CTA and publisher share the finished stop list, never overwrite draft',async()=>{
 const [app,social]=await Promise.all([read('app.js'),read('social-routes-enhancements.js')]);
 assert.match(app,/data-action="publish-finished"/);
 assert.match(app,/data-action="arrival-rating"/);
 assert.match(app,/cityroute:publish-completed/);
 assert.match(social,/document\.addEventListener\('cityroute:publish-completed'/);
 assert.match(social,/completedDraft\|\|currentDraft\(\)/);
 assert.match(social,/publishDialog\(\{cityId:d\.cityId/);
 assert.match(app,/href="#community-route\/\$\{esc\(s\.routeId\)\}"/,'completed community route has a review CTA');
 for(const path of ['app.js','social-routes-enhancements.js'])execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
});
