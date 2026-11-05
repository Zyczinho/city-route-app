import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {commonsPhotoUrl,commonsNameConfidence,chooseCommonsPhoto,findCommonsPhoto} from '../commons-photo-source.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const place={id:'isaac-synagogue',name:'Synagoga Izaaka',lat:50.05119,lng:19.9479};
const page=(title='File:Synagoga Izaaka w Krakowie 2018.jpg',license='CC BY-SA 4.0',src='https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/isaac.jpg/960px-isaac.jpg')=>({
 ns:6,title,coordinates:[{lat:50.05120,lon:19.94792}],
 imageinfo:[{thumburl:src,width:2560,height:1700,mime:'image/jpeg',
 descriptionurl:'https://commons.wikimedia.org/wiki/File:Synagoga_Izaaka_w_Krakowie_2018.jpg',
 extmetadata:{LicenseShortName:{value:license},Artist:{value:'<a href="https://commons.wikimedia.org/wiki/User:Photographer">Photographer</a>'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]
});
test('geosearch requests nearby file namespace and license metadata only as needed',()=>{
 const u=new URL(commonsPhotoUrl(place));
 assert.equal(u.hostname,'commons.wikimedia.org');
 assert.equal(u.searchParams.get('ggsnamespace'),'6');
 assert.equal(u.searchParams.get('ggsradius'),'90');
 assert.equal(u.searchParams.get('origin'),'*');
 assert.equal(u.searchParams.get('iiprop'),'url|size|mime|extmetadata');
 assert.equal(commonsPhotoUrl({lat:NaN,lng:20}),null);
});
test('pick exact named geotagged, freely licensed photographs with transparent credit',()=>{
 assert.ok(commonsNameConfidence(place,'File:Synagoga Izaaka Kraków.jpg')>=.9);
 const selected=chooseCommonsPhoto(place,[page()]);
 assert.ok(selected);
 assert.equal(selected.license,'CC BY-SA 4.0');
 assert.equal(selected.author,'Photographer');
 assert.equal(selected.source.includes('commons.wikimedia.org'),true);
 assert.equal(selected.src.startsWith('https://upload.wikimedia.org/'),true);
});
test('reject mismatched buildings, unlicensed media, cross-host images and nonphotographic files',()=>{
 assert.equal(chooseCommonsPhoto(place,[page('File:Synagoga Wysoka.jpg')]),null);
 assert.equal(chooseCommonsPhoto(place,[page(undefined,'All Rights Reserved')]),null);
 assert.equal(chooseCommonsPhoto(place,[page(undefined,undefined,'https://example.org/photo.jpg')]),null);
 assert.equal(chooseCommonsPhoto(place,[page('File:Synagoga Izaaka - mapa.jpg')]),null);
 assert.equal(chooseCommonsPhoto(place,[{...page(),coordinates:[{lat:50.09,lon:19.99}]}]),null);
});
test('API adapter uses a real matching commons result, not a guessed stock image',async()=>{
 const photo=await findCommonsPhoto(place,{fetcher:async()=>({ok:true,json:async()=>({query:{pages:[page()]}})})});
 assert.equal(photo.author,'Photographer');
 const missing=await findCommonsPhoto(place,{fetcher:async()=>({ok:true,json:async()=>({query:{pages:[page('File:Ulica Krakowska.jpg')]}})})});
 assert.equal(missing,null);
});
test('all missing-image displays are lazy scoped, and source/renderer are included in PWA release',()=>{
 const app=read('app.js'),runtime=read('commons-photo-runtime.js'),html=read('index.html'),sw=read('service-worker.js'),build=read('scripts/build.mjs');
 for(const name of ['data-commons-photo','data-commons-name','data-commons-lat','data-commons-lng'])assert.match(app,new RegExp(name));
 assert.match(runtime,/IntersectionObserver/);
 assert.match(runtime,/MAX_REQUESTS=48/);
 assert.match(runtime,/commons-photo-credit/);
 assert.match(runtime,/photo\.license/);
 assert.match(runtime,/runTask/);
 for(const name of ['commons-photo-source.js','commons-photo-runtime.js','commons-photo.css']){
  for(const src of [sw,build])assert.ok(src.includes(name),name+' not included in distribution');
 }
 assert.match(html,/commons-photo-runtime\.js\?v=1/);
 assert.match(sw,/city-route-v57/);
 for(const name of ['commons-photo-source.js','commons-photo-runtime.js','app.js'])execFileSync(process.execPath,['--check',name],{stdio:'pipe'});
});
