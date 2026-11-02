import test from 'node:test';
import assert from 'node:assert/strict';
import {mapsLabel,resolveMapsPreview,placePreview} from '../maps-preview.js';

test('mapsLabel reads a place name from a Google Maps place URL',()=>{
 const url='https://www.google.com/maps/place/Muzeum+Narodowe+w+Warszawie/@52.231,21.025,17z';
 assert.equal(mapsLabel(url),'Muzeum Narodowe w Warszawie');
});

test('resolveMapsPreview follows a safe short link and returns name plus destination coordinates',async()=>{
 const fetcher=async url=>{
  assert.equal(url,'https://maps.app.goo.gl/example');
  return new Response(null,{status:302,headers:{location:'https://www.google.com/maps/place/Muzeum+Neon%C3%B3w/@52.2521,21.0432,17z/data=!4m2!3m1!1s0x0:0x0'}});
 };
 const result=await resolveMapsPreview('https://maps.app.goo.gl/example',fetcher);
 assert.equal(result.status,'ok');
 assert.equal(result.name,'Muzeum Neonów');
 assert.deepEqual(result.location,{lat:52.2521,lng:21.0432});
});

test('placePreview keeps Maps data useful even when Google Places key is not configured',async()=>{
 const result=await placePreview('https://www.google.com/maps/place/Pa%C5%82ac+Kultury+i+Nauki/@52.2317,21.0060,17z','',async()=>{throw new Error('network should not be used');});
 assert.equal(result.status,'ok');
 assert.equal(result.name,'Pałac Kultury i Nauki');
 assert.deepEqual(result.location,{lat:52.2317,lng:21.006});
 assert.equal(result.photoEnabled,false);
 assert.equal(result.photo.available,false);
});
