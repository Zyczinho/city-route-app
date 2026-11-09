import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePlaceSnapshot,decodePlaceSnapshot,placeSnapshotUrl} from '../place-share-model.js';

const base='https://city-route.example',place={
 id:'u-private-42',name:'Łąka przy domu',cityId:'warsaw',kind:'user',visibility:'private',
 lat:52.229712,lng:21.012233,cats:['zielen'],description:'PRIVATE NOTE: hasło 12345',
 images:['data:image/jpeg;base64,SECRET'],image:'https://example.com/photo-with-secret.jpg',
 ratings:[{value:5}],contact:'personal@example.com'
};
test('private place is shareable without public catalogue, but only minimal opted-in fields travel in URL',()=>{
 const token=encodePlaceSnapshot(place,'warsaw'),url=placeSnapshotUrl(token,base);
 assert.ok(token);assert.ok(url.startsWith(base+'/?shareCity=warsaw#places/s-'));
 assert.deepEqual(decodePlaceSnapshot(token),{cityId:'warsaw',name:'Łąka przy domu',lat:52.229712,lng:21.012233,category:'zielen'});
 for(const secret of ['PRIVATE NOTE','12345','SECRET','personal@example.com','u-private-42','photo-with-secret'])assert.ok(!url.includes(secret),secret);
});
test('Unicode name, Lisbon and valid zero coordinates round-trip',()=>{
 const token=encodePlaceSnapshot({name:'Praça do Comércio',lat:38.7079,lng:-9.1368,cats:['okolice']},'lisbon');
 assert.equal(decodePlaceSnapshot(token).name,'Praça do Comércio');
 assert.equal(decodePlaceSnapshot(token).lng,-9.1368);
 assert.deepEqual(decodePlaceSnapshot(encodePlaceSnapshot({name:'Zero',lat:0,lng:0},'warsaw')),{cityId:'warsaw',name:'Zero',lat:0,lng:0,category:'okolice'});
});
test('invalid tokens, unsupported origins and out-of-range coordinates cannot create share links',()=>{
 for(const token of ['','x','../../private','<img>','A'.repeat(800),'____'])assert.equal(decodePlaceSnapshot(token),null);
 for(const [lat,lng] of [[91,0],[0,181],[NaN,1],[1,Infinity]])assert.equal(encodePlaceSnapshot({...place,lat,lng},'warsaw'),null);
 assert.equal(encodePlaceSnapshot({...place,lat:null},'warsaw'),null);
 assert.equal(encodePlaceSnapshot({...place,name:'<script>\nunsafe'},'warsaw'),null);
 const token=encodePlaceSnapshot(place,'warsaw');
 for(const bad of ['javascript:alert(1)','https://city-route.example.evil.com/path','https://city-route.example/evil'])assert.equal(placeSnapshotUrl(token,bad),null);
 assert.equal(placeSnapshotUrl('bad',base),null);
});
