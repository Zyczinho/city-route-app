import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {licensedPhotoCredit,shouldBankCommunityPhoto,commonsPhotoJpeg,MAX_PHOTO_EDGE} from '../community-photo-bank.js';
import {createPlaceContributionsClient,BUCKET} from '../place-contributions-client.js';

const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const uid='8b799adb-3328-4f93-a833-c8c1938c6000',submission='4b799adb-3328-4f93-a833-c8c1938c6001';
const source='https://commons.wikimedia.org/wiki/File:Sample_venue.jpg';
const licensed={id:'u-test',visibility:'public',
 image:'https://thumb.wikimedia.org/venue/sample.jpg',
 imageCredit:{author:'Photography Example',via:'Wikimedia Commons',license:'CC BY-SA 4.0',
  licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',source}};

test('only a public, licensed Wikimedia image can enter the shared bank',()=>{
 const c=licensedPhotoCredit(licensed);
 assert.deepEqual(c,{via:'Wikimedia Commons',source,author:'Photography Example',license:'CC BY-SA 4.0',
  licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'});
 assert.equal(shouldBankCommunityPhoto(licensed),true);
 assert.equal(licensedPhotoCredit({...licensed,visibility:'private'}),null);
 assert.equal(shouldBankCommunityPhoto({...licensed,photoUploaded:true}),false);
 assert.equal(licensedPhotoCredit({...licensed,image:'https://lh3.googleusercontent.com/photo'}),null);
 assert.equal(licensedPhotoCredit({...licensed,imageCredit:{...licensed.imageCredit,via:'Tripadvisor'}}),null);
 assert.equal(licensedPhotoCredit({...licensed,imageCredit:{...licensed.imageCredit,source:'https://evil.example/venue.jpg'}}),null);
 assert.equal(licensedPhotoCredit({...licensed,imageCredit:{...licensed.imageCredit,license:'All rights reserved'}}),null);
 assert.equal(licensedPhotoCredit({...licensed,imageCredit:{...licensed.imageCredit,author:''}}),null);
 assert.equal(licensedPhotoCredit({...licensed,imageCredit:{...licensed.imageCredit,licenseUrl:'https://evil.example'}}),null);
 const missingLink={...licensed,imageCredit:{...licensed.imageCredit,licenseUrl:null,license:'CC BY 4.0'}};
 assert.equal(licensedPhotoCredit(missingLink)?.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');
});

test('import safely resizes a previously accepted Commons file to JPEG once',async()=>{
 let width=0,height=0,closed=false,fetches=0;
 const jpeg=await commonsPhotoJpeg(licensed,{
  fetcher:async(url,opts)=>{fetches++;assert.equal(url,licensed.image);assert.equal(opts.mode,'cors');return {
   ok:true,headers:{get:()=>String(350)},blob:async()=>new Blob(['tiny'],{type:'image/png'})
  }},
  makeBitmap:async()=>({width:2000,height:1000,close(){closed=true}}),
  makeCanvas:()=>({getContext:()=>({fillRect(){},drawImage(){}}),
   set width(n){width=n},get width(){return width},
   set height(n){height=n},get height(){return height},
   toDataURL:()=> 'data:image/jpeg;base64,AA=='})
 });
 assert.equal(jpeg,'data:image/jpeg;base64,AA==');
 assert.equal(width,MAX_PHOTO_EDGE);assert.equal(height,480);
 assert.equal(fetches,1);assert.equal(closed,true);
 await assert.rejects(()=>commonsPhotoJpeg({...licensed,visibility:'private'},{fetcher:()=>{throw Error('should not fetch')}}),/unlicensed-or-private/);
});

test('shared licensed photo upload reuses secured bucket and attaches verified metadata',async()=>{
 const calls=[],client={
  storage:{from(bucket){assert.equal(bucket,BUCKET);return {
   async upload(path,blob,options){calls.push({kind:'upload',path,bytes:blob.size,options});return {error:null};}
  }}},
  async rpc(name,args){calls.push({kind:'rpc',name,args});return {data:submission,error:null}}
 };
 const api=createPlaceContributionsClient({client});
 const result=await api.uploadLicensedCommonsPhoto(uid,submission,'data:image/jpeg;base64,AA==',licensed);
 assert.equal(result.uploaded,true);
 assert.equal(calls[0].path,uid+'/'+submission+'.jpg');
 assert.equal(calls[0].options.upsert,false,'bank never overwrites existing submitted photo');
 assert.equal(calls[1].name,'attach_place_submission_licensed_photo');
 assert.equal(calls[1].args.p_credit.author,'Photography Example');
 await assert.rejects(()=>api.uploadLicensedCommonsPhoto(uid,submission,'data:image/jpeg;base64,AA==',{...licensed,visibility:'private'}),/photo-rights-required/);
 assert.equal(calls.length,2,'private upload rejected before any storage request');
});

test('only moderator-approved public places show banked image, attribution survives publishing',()=>{
 const sql=read('supabase/migrations/032_accepted_commons_photo_bank.sql');
 assert.match(sql,/alter table public\.place_submissions[\s\S]*licensed_photo_credit jsonb/);
 assert.match(sql,/p_credit->>'via' <> 'Wikimedia Commons'/);
 assert.match(sql,/storage\.objects where bucket_id='city-route-place-photos'/);
 assert.match(sql,/where id=p_submission_id and submitted_by=v_user and status='pending'/);
 assert.match(sql,/if not public\.is_app_admin\(\)/);
 assert.match(sql,/when v\.licensed_photo_credit is not null then 'Zdjęcie Wikimedia Commons \(zmniejszone i przekonwertowane do JPEG\)'/);
 assert.match(sql,/'credit',v\.licensed_photo_credit/);
 const runtime=read('place-contributions.js');
 assert.match(runtime,/if\(!place\|\|place\.visibility!=='public'\)return/);
 assert.match(runtime,/if\(!coverReady&&shouldBankCommunityPhoto\(place\)\)/);
 assert.match(runtime,/await api\.uploadLicensedCommonsPhoto\(/);
 const catalog=read('catalogue-client.js');
 assert.match(catalog,/imageCredit:imageMeta\.credit\|\|null/);
 const build=read('scripts/build.mjs'),sw=read('service-worker.js');
 assert.match(build,/'community-photo-bank\.js'/);
 assert.match(sw,/\.\/community-photo-bank\.js/);
});
