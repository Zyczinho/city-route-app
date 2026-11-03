import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Social Routes runtime exposes the MVP interaction paths',async()=>{
 const runtime=await read('social-routes-enhancements.js');
 for(const token of ['loadCommunityRoutes','publishRoute','saveRoute','unsaveRoute','forkRoute','rateRoute','loadPublicProfile','archiveRoute','deleteOwnedRoute'])assert.match(runtime,new RegExp(token));
 assert.match(runtime,/community_route_publish/);
 assert.match(runtime,/community_route_save/);
 assert.match(runtime,/community_route_unsave/);
 assert.match(runtime,/community_route_fork/);
 assert.match(runtime,/community_route_rate/);
 assert.match(runtime,/confirm\('Twoja obecna trasa zostanie zastąpiona/,'fork replacement must be confirmed');
 assert.match(runtime,/forkedFrom/,'fork provenance must survive until publish');
});

test('Social custom views are idempotent and city-scoped',async()=>{
 const runtime=await read('social-routes-enhancements.js');
 assert.match(runtime,/data-social-route-root/);
 assert.match(runtime,/data-social-profile-root/);
 assert.match(runtime,/data-social-saved-root/);
 assert.match(runtime,/loadAuthorRoutes\(\{userId:id,citySlug:activeCity\}\)/);
 assert.match(runtime,/allSaved\.filter\(x=>x\.cityId===activeCity\)/);
 assert.doesNotMatch(runtime,/root\.dataset\.socialRoute=id/,'a persistent dataset marker would survive core innerHTML replacement');
});

test('Social Routes UI and navigation modules ship in index, build and PWA cache v29',async()=>{
 const [index,build,sw]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('service-worker.js')]);
 for(const file of ['social-routes-client.js','social-routes-enhancements.js','social-routes.css','nav-enhancements.js']){
  const re=new RegExp(file.replaceAll('.','\\.'));
  assert.match(build,re);assert.match(sw,re);
 }
 assert.match(index,/social-routes\.css/);
 assert.match(index,/social-routes-enhancements\.js/);
 assert.match(index,/nav-enhancements\.js/);
 assert.match(sw,/city-route-v29/);
});

test('Founder-approved A+B navigation leaves four bottom tabs and promotes My Route',async()=>{
 const [nav,css]=await Promise.all([read('nav-enhancements.js'),read('social-routes.css')]);
 assert.match(nav,/desiredNav=\['#plan','#routes','#my-route','#places'\]/);
 assert.match(nav,/book\?\.remove\(\)/);
 assert.match(nav,/dataset\.headerBook/);
 assert.match(nav,/Zobacz trasę/);
 assert.match(css,/#navigation\{grid-template-columns:repeat\(4,1fr\)\}/);
 assert.match(css,/#navigation a\[href="#my-route"\][\s\S]*border:2px solid var\(--cyan\)/);
 assert.match(css,/#navigation a\[href="#my-route"\]\.live/);
 assert.match(css,/\.header-book/);
});

test('new browser modules are syntax-valid before deployment',()=>{
 for(const file of ['social-routes-enhancements.js','nav-enhancements.js'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});


test('core router recognizes Social Routes custom hashes',async()=>{
 const app=await read('app.js');
 for(const token of ["'community-route':'routes'","'social-profile':'routes'","'social-saved':'routes'"])assert.match(app,new RegExp(token));
});
