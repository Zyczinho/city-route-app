import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,parseGoogleSaved,coordinatesFromGoogleUrl,planGoogleSavedImport} from '../google-saved-import.js';
const warsaw={id:'warsaw',status:'launch',center:{lat:52.2297,lng:21.0122},radiusKm:40};
const krakow={id:'krakow',status:'next',center:{lat:50.0647,lng:19.945},radiusKm:35};
const catalogue=[{id:'place-1',cityId:'warsaw',name:'Pałac Kultury',lat:52.2318,lng:21.0067}];
test('Google Takeout Saved CSV handles optional description and quoted names',()=>{
 const csv='Moje ulubione miejsca\n\nTitle,Note,item_content_url,Tags\n"Pałac Kultury","Byłem tu, fajnie",https://www.google.com/maps/place/palace,\n"Nocny bar",Sprawdź,"https://www.google.com/maps?q=52.235,21.023",\n';
 const entries=parseGoogleSaved(csv,'favourites.csv');
 assert.equal(entries.length,2);assert.equal(entries[0].name,'Pałac Kultury');
 assert.equal(entries[0].note,'Byłem tu, fajnie');assert.equal(entries[0].lat,null);
 assert.equal(entries[1].lat,52.235);assert.equal(entries[1].lng,21.023);
});
test('CSV protects quoted delimiters and multiline notes',()=>{
 const r=parseCsv('title,url,note\n"A, B","https://google.com/maps","first\nsecond"\n');
 assert.equal(r[1][0],'A, B');assert.equal(r[1][2],'first\nsecond');
 assert.throws(()=>parseCsv('title,url\n"broken,https://x'),/niedomknięty/);
});
test('coordinates from Google URL never infer location from map viewport /@lat,lng',()=>{
 assert.deepEqual(coordinatesFromGoogleUrl('https://www.google.com/maps?q=52.2297,21.0122'),{lat:52.2297,lng:21.0122});
 assert.deepEqual(coordinatesFromGoogleUrl('https://www.google.com/maps/place/Powisle/data=!4m2!3d52.2395!4d21.0458'),{lat:52.2395,lng:21.0458});
 assert.equal(coordinatesFromGoogleUrl('https://www.google.com/maps/@52.2297,21.0122,13z'),null);
 assert.equal(coordinatesFromGoogleUrl('https://evil.com/maps?q=52.2297,21.0122'),null);
});
test('GeoJSON imports only Point features with valid coordinates',()=>{
 const json=JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Plac Zbawiciela'},geometry:{type:'Point',coordinates:[21.018,52.219]}},{type:'Feature',properties:{name:'Shape'},geometry:{type:'LineString',coordinates:[[21,52],[21.1,52.1]]}}]});
 const entries=parseGoogleSaved(json,'map.geojson');
 assert.equal(entries[0].lat,52.219);assert.equal(entries[0].lng,21.018);
 assert.equal(entries[1].lat,null);
});
test('import matches catalogue names and duplicates once; unknown coordinates create private drafts',()=>{
 const entries=[{name:'Pałac Kultury',lat:null,lng:null},{name:'Pałac Kultury',lat:null,lng:null},
 {name:'Nocny bar',lat:52.235,lng:21.023},{name:'Odwiedzić kiedyś',lat:null,lng:null},
 {name:'Wrocław',lat:51.1079,lng:17.0385}];
 const p=planGoogleSavedImport(entries,{cities:[warsaw,krakow],catalogue});
 assert.deepEqual(p.matched.map(x=>x.placeId),['place-1']);
 assert.equal(p.created.length,1);assert.equal(p.created[0].name,'Nocny bar');
 assert.equal(p.unresolved.length,2);
});
test('only active supported city can receive new locations',()=>{
 const out=planGoogleSavedImport([{name:'Kraków bar',lat:50.065,lng:19.94}],{cities:[warsaw],catalogue});
 assert.equal(out.created.length,0);assert.equal(out.unresolved.length,1);
});
test('Google My Maps KML imports only point placemarks and decodes XML names',()=>{
 const kml='<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>'+
 '<Placemark><name>Żoliborz &amp; kawa</name><description><![CDATA[Warto odwiedzić]]></description><Point><coordinates>20.98,52.27,0</coordinates></Point></Placemark>'+
 '<Placemark><name>Spacer</name><LineString><coordinates>21.0,52.2 21.1,52.3</coordinates></LineString></Placemark></Document></kml>';
 const places=parseGoogleSaved(kml,'google-mymaps.kml');
 assert.equal(places.length,1);
 assert.equal(places[0].name,'Żoliborz & kawa');
 assert.equal(places[0].note,'Warto odwiedzić');
 assert.equal(places[0].lat,52.27);
 assert.equal(places[0].lng,20.98);
});
test('malformed or excessively large files are rejected',()=>{
 assert.throws(()=>parseGoogleSaved('not CSV','bad.csv'),/Nie rozpoznano/);
 assert.throws(()=>parseGoogleSaved('x'.repeat(2_000_001),'bad.csv'),/2 MB/);
 assert.throws(()=>parseGoogleSaved('[]','export.zip'),/CSV/);
});
