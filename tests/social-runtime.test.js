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

test('Social Routes UI and navigation modules ship in index, build and PWA cache v33',async()=>{
 const [index,build,sw]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('service-worker.js')]);
 for(const file of ['social-routes-client.js','social-routes-enhancements.js','social-routes.css','nav-enhancements.js','ux-cleanup.js','ux-cleanup.css']){
  const re=new RegExp(file.replaceAll('.','\\.'));
  assert.match(build,re);assert.match(sw,re);
 }
 assert.match(index,/social-routes\.css/);
 assert.match(index,/social-routes-enhancements\.js/);
 assert.match(index,/nav-enhancements\.js\?v=4/);
 assert.match(index,/ux-cleanup\.js\?v=5/);
 assert.match(index,/ux-cleanup\.css\?v=2/);
 assert.match(sw,/city-route-v64/);
});

test('Bottom navigation has Community and keeps My Route compact and central',async()=>{
 const [nav,ux]=await Promise.all([read('nav-enhancements.js'),read('ux-cleanup.css')]);
 assert.match(nav,/desiredNav=\['#plan','#routes','#my-route','#routes\/community','#places','#about'\]/);
 assert.match(nav,/Społeczność/);
 assert.match(nav,/users\.svg/);
 assert.match(nav,/book\?\.remove\(\)/);
 assert.match(nav,/dataset\.headerBook/);
 assert.match(nav,/Zobacz trasę/);
 const guideCss=await read('onboarding-guide.css'); assert.match(guideCss,/#navigation\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(ux,/a\[href="#my-route"\][\s\S]*min-height:56px/);
});

test('new browser modules are syntax-valid before deployment',()=>{
 for(const file of ['social-routes-enhancements.js','nav-enhancements.js','ux-cleanup.js'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});


test('core router recognizes Social Routes custom hashes',async()=>{
 const app=await read('app.js');
 for(const token of ["'community-route':'routes'","'social-profile':'routes'","'social-saved':'routes'"])assert.match(app,new RegExp(token));
});
