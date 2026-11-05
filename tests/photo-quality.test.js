import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {photoQuality,choosePlacePhoto,bestGooglePhoto,parsePhotoSourceUrl,photoSourceKind} from '../photo-quality.js';

test('wide crisp venue photo beats a small poster or thumbnail, irrespective of provider order',()=>{
 const portraits=[{name:'small',widthPx:300,heightPx:280},{name:'poster',widthPx:800,heightPx:1800},{name:'venue',widthPx:1800,heightPx:1150}];
 assert.equal(bestGooglePhoto(portraits).photo.name,'venue');
 assert.equal(bestGooglePhoto(portraits).index,2);
});
test('publisher permission and place identity always outrank visual quality',()=>{
 const candidate=(src,rights,placeId,widthPx=1400)=>({src,credit:{source:'https://example.com/credits',author:'Venue owner',license:'Owner approval'},displayPermitted:rights,rightsVerified:rights,placeId,widthPx,heightPx:950});
 const photo=choosePlacePhoto([
 candidate('https://instagram.com/huge',false,'p-1',3000),
 candidate('https://example.com/wrong',true,'p-2',3000),
 candidate('https://example.com/correct',true,'p-1',1600)
 ],{placeId:'p-1'});
 assert.equal(photo.src,'https://example.com/correct');
 assert.equal(choosePlacePhoto([candidate('https://example.com/unknown',false,'p-1')]),null);
});
test('source URLs exclude embedded credentials, private hosts and non HTTPS schemes',()=>{
 for(const url of ['http://example.com','https://localhost/','https://192.168.1.1/x','https://user:pass@example.com/','javascript:alert(1)'])assert.equal(parsePhotoSourceUrl(url),null);
 assert.equal(photoSourceKind('https://www.instagram.com/p/abc'),'instagram');
 assert.equal(photoSourceKind('https://facebook.com/some-page'),'facebook');
 assert.equal(photoSourceKind('https://example.org'),'website');
});

test('new browser module is bundled and precached in the production PWA',async()=>{
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
 assert.match(build,/'photo-quality\.js'/);
 assert.match(sw,/'\.\/photo-quality\.js'/);
});

test('Google main photo (first in Google order) wins over a sharper visitor shot',()=>{
 const photos=[{name:'main-cover',widthPx:1200,heightPx:900},{name:'dance-floor',widthPx:4032,heightPx:2600},{name:'menu',widthPx:3000,heightPx:4000}];
 assert.equal(bestGooglePhoto(photos).photo.name,'main-cover');
 assert.equal(bestGooglePhoto(photos).index,0);
 assert.equal(bestGooglePhoto([{name:'tiny-logo',widthPx:250,heightPx:250},...photos]).photo.name,'main-cover','an unusable first photo is skipped, order still respected');
 assert.equal(bestGooglePhoto([{name:'no-size'}]).photo.name,'no-size');
 assert.equal(bestGooglePhoto([]),null);
});
