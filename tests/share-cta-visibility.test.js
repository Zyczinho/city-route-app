import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('route share CTA is rendered consistently across all major view states',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const social=await readFile(new URL('../social-routes-enhancements.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../route-share-ui.css',import.meta.url),'utf8');
 assert.match(app,/function shareRouteButton\(ps,transport,title,/);
 assert.match(app,/kind==='editorial'/);
 assert.match(app,/class="route-share-trigger" data-route-share="maps"/);
 assert.match(app,/shareRouteButton\(ps,r\.transport,r\.name,own\|\|r\.id==='generated'/,
  'generated, saved and editorial route detail share CTA stays visible');
 assert.match(app,/shareRouteButton\(ps,transport,builderDraft\?\.name/,
  'basket share CTA does not disappear for transit and mixed transport');
 assert.match(app,/shareRouteButton\(items\(s\.stops\),s\.transport,s\.name\)/,
  'finished and live route share CTA available');
 const communityButtons=social.match(/class="route-share-trigger" data-route-share="community"/g)||[];
 assert.equal(communityButtons.length,2,'community list and detail both have share buttons');
 assert.match(social,/iconMarkup\("send"\)\}Udostępnij trasę/);
 assert.match(css,/background:var\(--blue-soft\);color:var\(--blue\)/);
 assert.match(css,/\.route-share-trigger:focus-visible/);
});
test('route sharing remains visible but safe when imported stops have invalid coordinates',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/if\(!valid\)return '<button type="button" class="route-share-trigger" disabled/);
 assert.match(app,/Uzupełnij współrzędne przystanków/);
 assert.match(app,/Number\.isFinite\(Number\(p\.lat\)\)/);
 assert.match(app,/Math\.abs\(Number\(p\.lng\)\)<=180/);
});
