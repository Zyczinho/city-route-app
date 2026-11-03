import test from 'node:test';
import assert from 'node:assert/strict';
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

test('Social Routes UI ships in index, build and PWA cache v29',async()=>{
 const [index,build,sw]=await Promise.all([read('index.html'),read('scripts/build.mjs'),read('service-worker.js')]);
 for(const file of ['social-routes-client.js','social-routes-enhancements.js','social-routes.css']){
  const re=new RegExp(file.replaceAll('.','\\.'));
  assert.match(build,re);assert.match(sw,re);
 }
 assert.match(index,/social-routes\.css/);
 assert.match(index,/social-routes-enhancements\.js/);
 assert.match(sw,/city-route-v29/);
});

test('My Route is visually promoted to the centre of the five-tab mobile nav',async()=>{
 const css=await read('social-routes.css');
 assert.match(css,/#navigation a\[href="#my-route"\]\{order:3/);
 assert.match(css,/#navigation a\[href="#my-route"\][\s\S]*border:2px solid var\(--cyan\)/);
 assert.match(css,/#navigation a\[href="#my-route"\]\.live/);
});
