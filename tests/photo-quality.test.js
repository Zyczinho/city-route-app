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
