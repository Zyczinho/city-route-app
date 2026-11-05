import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {titleMatch,wikiSearchUrl,pickWikiPages,commonsInfoUrl,googleCandidate,findPlacePhotoCandidates,acceptedPhotoRecord,readAcceptedPhoto} from '../place-photo-proposal.js';
import {licensedCommonsImage} from '../commons-photo-source.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

const sukiennice={name:'Sukiennice',location:{lat:50.0617,lng:19.9373},source:'photon-osm'};
const info=(title,{license='CC BY-SA 4.0',host='thumb.wikimedia.org',w=2500,h=2000}={})=>({ns:6,title:'File:'+title,imageinfo:[{
 thumburl:`https://${host}/wikipedia/commons/thumb/0/07/x.jpg/960px-x.jpg`,width:w,height:h,mime:'image/jpeg',
 descriptionurl:'https://commons.wikimedia.org/wiki/File:'+title.replace(/ /g,'_'),
 extmetadata:{LicenseShortName:{value:license},Artist:{value:'<a href="//commons.wikimedia.org/wiki/User:T">Tomasz Lewandowski</a>'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0'}}}]});
const wikiPages=[
 {title:'Rynek Główny w Krakowie',index:1,pageimage:'Rynek.jpg',coordinates:[{lat:50.06166,lon:19.93721}]},
 {title:'Sukiennice w Krakowie',index:2,pageimage:'20190218_075039_TL.jpg',coordinates:[{lat:50.061667,lon:19.937222}]},
 {title:'Kraków',index:3,pageimage:'Kolaż_Krakowa.JPG',coordinates:[{lat:50.061667,lon:19.9375}]},
 {title:'Ulica Sukiennice we Wrocławiu',index:4,pageimage:'Wroclaw.JPG',coordinates:[{lat:51.10997,lon:17.03212}]}
];
const json=body=>({ok:true,json:async()=>body});

test('title match needs a distinctive word of the place, not just the city or a generic noun',()=>{
 assert.equal(titleMatch('Sukiennice','Sukiennice w Krakowie'),1);
 assert.equal(titleMatch('Kościół Mariacki','Kraków'),0,'city article is not the church');
 assert.equal(titleMatch('Muzeum Narodowe','Muzeum Sztuki'),0,'generic word alone never matches');
 assert.ok(titleMatch('Pałac w Wilanowie','Wilanów Palace')>=.5,'Polish/English stems match');
});

test('Wikipedia search is scoped to the picked name and city and asks only for coordinates and lead image',()=>{
 const u=new URL(wikiSearchUrl({name:'Sukiennice'},{city:'Kraków'}));
 assert.equal(u.hostname,'pl.wikipedia.org');
 assert.equal(u.searchParams.get('gsrsearch'),'Sukiennice Kraków');
 assert.equal(u.searchParams.get('prop'),'coordinates|pageimages');
 assert.equal(u.searchParams.get('origin'),'*');
 assert.equal(wikiSearchUrl({name:'ab'}),null);
});

test('only nearby, name-matching articles with a lead image survive',()=>{
 const pages=pickWikiPages({name:'Sukiennice',lat:50.0617,lng:19.9373},wikiPages);
 assert.deepEqual(pages.map(p=>p.title),['Sukiennice w Krakowie']);
 assert.equal(pickWikiPages({name:'Sukiennice',lat:NaN,lng:1},wikiPages).length,0);
});

test('Commons licence gate accepts the current thumb.wikimedia.org host and still rejects others',()=>{
 assert.ok(licensedCommonsImage(info('A.jpg'),{}));
 assert.ok(licensedCommonsImage(info('A.jpg',{host:'upload.wikimedia.org'}),{}));
 assert.equal(licensedCommonsImage(info('A.jpg',{host:'example.org'}),{}),null);
 assert.equal(licensedCommonsImage(info('A.jpg',{license:'Fair use'}),{}),null,'non-free enwiki files are never proposed');
 assert.ok(licensedCommonsImage(info('A.jpg',{license:'CC BY-SA 3.0 pl'}),{}),'ported Polish CC licence is free');
 assert.equal(licensedCommonsImage(info('A.jpg',{license:'CC BY-NC 4.0'}),{}),null,'non-commercial is not accepted');
 assert.equal(licensedCommonsImage(info('A.jpg',{w:300,h:200}),{}),null);
 assert.match(commonsInfoUrl(['20190218_075039_TL.jpg']),/titles=File%3A20190218\+075039\+TL\.jpg/);
});

test('Add Place proposes the exact article photo first, with credit and licence',async()=>{
 const calls=[];
 const fetcher=async url=>{calls.push(url);const u=new URL(url);
  if(u.hostname==='pl.wikipedia.org')return json({query:{pages:wikiPages}});
  if(u.searchParams.get('titles'))return json({query:{pages:[info('20190218 075039 TL.jpg')]}});
  return json({query:{pages:[]}});
 };
 const r=await findPlacePhotoCandidates(sukiennice,{city:'Kraków',fetcher});
 assert.equal(r.status,'ok');
 assert.equal(r.candidates[0].kind,'wikipedia');
 assert.equal(r.candidates[0].article,'Sukiennice w Krakowie');
 assert.equal(r.candidates[0].author,'Tomasz Lewandowski');
 assert.equal(r.candidates[0].license,'CC BY-SA 4.0');
 assert.ok(!calls.some(u=>u.includes('en.wikipedia.org')),'English fallback is skipped once Polish found the place');
});

test('no photo is honest: "none" when nothing matches, "error" when sources cannot be reached',async()=>{
 const none=await findPlacePhotoCandidates({name:'Mała Kawiarnia',location:{lat:50.06,lng:19.93}},{fetcher:async()=>json({query:{pages:[]}})});
 assert.deepEqual(none,{status:'none',candidates:[]});
 const down=await findPlacePhotoCandidates({name:'Mała Kawiarnia',location:{lat:50.06,lng:19.93}},{fetcher:async()=>({ok:false,status:429})});
 assert.deepEqual(down,{status:'error',candidates:[]});
 const noName=await findPlacePhotoCandidates({name:'',location:{lat:50.06,lng:19.93}},{fetcher:async()=>{throw new Error('must not fetch');}});
 assert.equal(noName.status,'none');
});

test('Google photo is a preview only; only Wikimedia proposals are stored on the place',()=>{
 const google=googleCandidate({source:'google',placeId:'ChIJabcdefghijk',photo:{available:true,authorName:'Ann'}});
 assert.equal(google.src,'/api/place-photo?id=ChIJabcdefghijk');
 assert.equal(acceptedPhotoRecord(google),null);
 const commons={src:'https://thumb.wikimedia.org/a.jpg',author:'T',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0',source:'https://commons.wikimedia.org/wiki/File:a.jpg',via:'Wikimedia Commons'};
 const record=acceptedPhotoRecord(commons);
 assert.equal(record.image,commons.src);
 assert.equal(record.imageCredit.license,'CC BY 4.0');
 assert.deepEqual(readAcceptedPhoto(JSON.stringify(record)),record);
 assert.equal(readAcceptedPhoto(JSON.stringify({...record,image:'https://evil.example/x.jpg'})),null);
 assert.equal(readAcceptedPhoto(JSON.stringify({...record,imageCredit:{...record.imageCredit,source:'javascript:alert(1)'}})),null);
 assert.equal(readAcceptedPhoto('{broken'),null);
});

test('composer proposes automatically and the user decides; app.js stores it only without own photos',()=>{
 const composer=read('place-composer.js'),app=read('app.js'),sw=read('service-worker.js'),build=read('scripts/build.mjs');
 assert.match(composer,/proposePhoto\(form,selection\)/,'proposal starts right after a venue is chosen');
 for(const action of ['accept','next','skip','own'])assert.match(composer,new RegExp(`data-pc-photo="${action}"`));
 assert.match(composer,/Nie mamy pewnego zdjęcia tego miejsca/);
 assert.match(app,/const proposed=!localImages\.length&&!draft\.image\?readAcceptedPhoto\(f\.dataset\.pcPhoto\):null/);
 assert.match(app,/imageCredit:proposed\?\.imageCredit\|\|null/);
 assert.match(sw,/'\.\/place-photo-proposal\.js'/);
 assert.match(build,/'place-photo-proposal\.js'/);
});
