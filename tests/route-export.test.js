import test from 'node:test';
import assert from 'node:assert/strict';
import {routeGpx,routeGpxFilename} from '../route-export.js';

const places=[{name:'Pałac & <ogród>',lat:52.2297,lng:21.0122},{name:'Praga',lat:52.25,lng:21.04}];
test('GPX exports route waypoints with safe XML and stops in order',()=>{
 const xml=routeGpx({name:'Spacer <Warszawa>',places});
 assert.match(xml,/version="1.1"/);assert.match(xml,/<rte>/);assert.match(xml,/<rtept lat="52.229700" lon="21.012200"/);
 assert.match(xml,/Pałac &amp; &lt;ogród&gt;/);
 assert.ok(xml.indexOf('Pałac')<xml.indexOf('Praga'));
 assert.doesNotMatch(xml,/<trk>|<time>/,'not a fake completed activity or straight-line GPS track');
 assert.match(xml,/Brak rzeczywistego sladu GPS/);
});
test('GPX refuses one stop, invalid coordinates and empty route',()=>{
 assert.throws(()=>routeGpx({places:[]}),/minimum dwa/);
 assert.throws(()=>routeGpx({places:[places[0]]}),/minimum dwa/);
 assert.throws(()=>routeGpx({places:[places[0],{name:'Invalid',lat:999,lng:999}]}),/poprawnych współrzędnych/);
 assert.throws(()=>routeGpx({places:[places[0],{name:'Missing',lat:null,lng:21.1}]}),/poprawnych współrzędnych/,'null must not turn into zero');
 assert.throws(()=>routeGpx({places:[places[0],{name:'Missing',lng:21.1}]}),/poprawnych współrzędnych/,'missing latitude fails closed');
});
test('GPX file names are safe without path traversal',()=>{
 assert.equal(routeGpxFilename('Trasa: Łazienki / Stare Miasto'),'cityroute-trasa-lazienki-stare-miasto.gpx');
 assert.equal(routeGpxFilename('../../'),'cityroute-trasa.gpx');
});
