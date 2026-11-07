import test from 'node:test';
import assert from 'node:assert/strict';
import {routeShareUrl,sharedMapsRouteUrl} from '../share-links.js';
import {parseRouteSharePath,escapeShareHtml,safeShareImage,sharePreviewHtml,routeShareResponse} from '../share-preview.js';

const UID='123e4567-e89b-12d3-a456-426614174000';
const ORIGIN='https://city-route.example';
const record={id:UID,city_slug:'warsaw',name:'Nocna Praga',description:'Autentyczne bary i muzyka.',author_nickname:'Filip',
 status:'published',visibility:'public',stops:['bar-1','bar-2'],stop_count:2};
const fakeRpc=(row=record)=>({
 async rpc(name,params){
  if(name==='community_route')return {data:row?[row]:[],error:null};
  if(name==='catalogue_routes')return {data:[{id:'old-warsaw',name:'Stara Warszawa',description:'Stare Miasto',stops:['castle'],metadata:{legacy:{image:'route-old-warsaw.jpg'}}}],error:null};
  if(name==='catalogue_places')return {data:[{legacy_id:'bar-1',image_url:'https://demo.supabase.co/storage/v1/object/public/city-route-place-photos/a.jpg'}],error:null};
  throw Error('unexpected RPC: '+name+' '+JSON.stringify(params));
 }
});

test('canonical link creation rejects device-only, malformed and unsafe identifiers',()=>{
 assert.equal(routeShareUrl('community',UID,null,ORIGIN),ORIGIN+'/r/community/'+UID);
 assert.equal(routeShareUrl('editorial','old-warsaw','warsaw',ORIGIN),ORIGIN+'/r/editorial/warsaw/old-warsaw');
 assert.equal(routeShareUrl('editorial','../secret','warsaw',ORIGIN),null);
 assert.equal(routeShareUrl('editorial','old-warsaw','../foo',ORIGIN),null);
 assert.equal(routeShareUrl('community','mine-local',null,ORIGIN),null);
 assert.equal(routeShareUrl('editorial','old-warsaw','warsaw','javascript:alert(1)'),null);
});

test('server path parser never interprets private paths or traversal',()=>{
 assert.deepEqual(parseRouteSharePath('/r/community/'+UID),{kind:'community',id:UID});
 assert.deepEqual(parseRouteSharePath('/r/editorial/warsaw/old-warsaw'),{kind:'editorial',id:'old-warsaw',city:'warsaw'});
 assert.equal(parseRouteSharePath('/r/community/not-uuid'),null);
 assert.equal(parseRouteSharePath('/r/editorial/warsaw/../secret'),null);
 assert.equal(parseRouteSharePath('/r/editorial/warsaw/evil<script>'),null);
});

test('public route URL exposes real Open Graph title, summary, photo and visitor deep-link',async()=>{
 const response=await routeShareResponse(new Request(ORIGIN+'/r/community/'+UID),fakeRpc());
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/property="og:title" content="Nocna Praga · City Route"/);
 assert.match(html,/property="og:description" content="Autentyczne bary i muzyka\. · Autor: Filip"/);
 assert.match(html,/property="og:image" content="https:\/\/demo\.supabase\.co\/storage\/v1\/object\/public\//);
 assert.match(html,/shareCity=warsaw#community-route\/123e4567/);
 assert.match(html,/twitter:card" content="summary_large_image"/);
});

test('editorial route links use their own real hero and city-specific route target',async()=>{
 const response=await routeShareResponse(new Request(ORIGIN+'/r/editorial/warsaw/old-warsaw'),fakeRpc());
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/property="og:image" content="https:\/\/city-route\.example\/assets\/images\/route-old-warsaw\.jpg"/);
 assert.match(html,/shareCity=warsaw#route\/old-warsaw/);
});

test('unlisted published routes are noindex and never publicly cached',async()=>{
 const response=await routeShareResponse(new Request(ORIGIN+'/r/community/'+UID),fakeRpc({...record,visibility:'unlisted'}));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.match(await response.text(),/name="robots" content="noindex,nofollow"/);
});

test('missing, archived and malformed routes do not reveal metadata',async()=>{
 for(const row of [null,{...record,status:'archived'}]){
  const response=await routeShareResponse(new Request(ORIGIN+'/r/community/'+UID),fakeRpc(row));
  assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/Nocna Praga/);
 }
 assert.equal((await routeShareResponse(new Request(ORIGIN+'/r/community/not-uuid'),fakeRpc())).status,404);
 assert.equal((await routeShareResponse(new Request(ORIGIN+'/r/community/'+UID,{method:'POST'}),fakeRpc())).status,404);
});

test('unavailable catalogue returns a non-cacheable 503 instead of invented title/photo',async()=>{
 const response=await routeShareResponse(new Request(ORIGIN+'/r/community/'+UID),{rpc:async()=>({data:null,error:new Error('offline')})});
 assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
});

test('HTML escapes hostile route strings and rejects unlicensed image proxies',()=>{
 const html=sharePreviewHtml({kind:'community',id:UID,city:'warsaw',name:'<img onerror=1>',description:'" > <script>',author:'tester',unlisted:false,image:ORIGIN+'/assets/logo.png'},ORIGIN+'/r/community/'+UID);
 assert.doesNotMatch(html,/<img onerror=1>/);assert.doesNotMatch(html,/<script>"/);
 assert.match(html,/&lt;img onerror=1&gt;/);
 assert.equal(safeShareImage('/api/place-photo?id=123',ORIGIN),null);
 assert.equal(safeShareImage('https://maps.googleapis.com/photo',ORIGIN),null);
 assert.equal(safeShareImage('javascript:alert(1)',ORIGIN),null);
 assert.equal(safeShareImage('route-old-warsaw.jpg',ORIGIN),ORIGIN+'/assets/images/route-old-warsaw.jpg');
 assert.equal(escapeShareHtml('a&b'),'a&amp;b');
});

test('private route share only accepts legitimate Google Maps directions links',()=>{
 const good='https://www.google.com/maps/dir/?api=1&destination=52.2297,21.0122&waypoints=52.24,21.02';
 assert.equal(sharedMapsRouteUrl(good),good);
 assert.equal(sharedMapsRouteUrl('https://evil.example/maps/dir/?api=1&destination=52.2,21.0'),null);
 assert.equal(sharedMapsRouteUrl('javascript:alert(1)'),null);
 assert.equal(sharedMapsRouteUrl('https://www.google.com/maps/@52.2,21.0,15z'),null);
});
test('all requested social channels are visible in share chooser, without private City Route link fiction',async()=>{
 const fs=await import('node:fs/promises');
 const text=await fs.readFile(new URL('../share-links.js',import.meta.url),'utf8');
 const app=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
 for(const word of ['WhatsApp','Instagram','Messenger','Udostępnij przez aplikację'])assert.match(text,new RegExp(word));
 assert.match(app,/data-route-share=\\"maps\\"/);
 assert.match(app,/data-route-share=\\"editorial\\"/);
 assert.match(app,/data-action=\\"export-gpx\\"/);
});
