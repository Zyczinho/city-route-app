import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createPlaceContributionsClient,galleryPhotoPath,galleryPhotoPublicUrl} from '../place-contributions-client.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const U='11111111-2222-4333-8444-555555555555',S='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const jpg='data:image/jpeg;base64,/9j/2Q==';
test('gallery path slots 2..5 do not change the legacy cover path',()=>{
 assert.equal(galleryPhotoPath(U,S,2),U+'/'+S+'-2.jpg');
 assert.equal(galleryPhotoPath(U,S,5),U+'/'+S+'-5.jpg');
 assert.throws(()=>galleryPhotoPath(U,S,1),e=>e.code==='invalid-photo-position');
 assert.throws(()=>galleryPhotoPath(U,S,6),e=>e.code==='invalid-photo-position');
 const base='https://example.supabase.co';
 assert.equal(galleryPhotoPublicUrl(base,U+'/'+S+'-3.jpg'),base+'/storage/v1/object/public/city-route-place-photos/'+U+'/'+S+'-3.jpg');
 assert.equal(galleryPhotoPublicUrl(base,U+'/'+S+'.jpg'),null);
 assert.equal(galleryPhotoPublicUrl(base,'../../secret.jpg'),null);
 assert.equal(galleryPhotoPublicUrl('https://evil.org',U+'/'+S+'-2.jpg'),null);
});
test('multi-gallery upload writes only extras with exact per-submission RPC attachment and rights',async()=>{
 const calls=[];
 const client={
  storage:{from:bucket=>({upload:async(path,blob,opts)=>{calls.push({kind:'upload',bucket,path,size:blob.size,opts});return {error:null};}})},
  rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});return {data:S,error:null};}
 };
 const api=createPlaceContributionsClient({client});
 const result=await api.uploadGalleryPhotos(U,S,[jpg,jpg,jpg],true);
 assert.deepEqual(result,{uploaded:[2,3],failed:[]});
 const ups=calls.filter(x=>x.kind==='upload'),rpcs=calls.filter(x=>x.kind==='rpc');
 assert.deepEqual(ups.map(x=>x.path),[U+'/'+S+'-2.jpg',U+'/'+S+'-3.jpg']);
 assert.ok(ups.every(x=>x.bucket==='city-route-place-photos'&&x.opts.upsert===false&&x.opts.contentType==='image/jpeg'));
 assert.deepEqual(rpcs.map(x=>x.name),['attach_place_submission_gallery_photo','attach_place_submission_gallery_photo']);
 assert.deepEqual(rpcs.map(x=>x.args.p_position),[2,3]);
 assert.ok(rpcs.every(x=>x.args.p_confirm_rights===true));
});
test('gallery cannot upload without explicit rights, and retry skips uploaded slots',async()=>{
 const called=[];
 const client={storage:{from:()=>({upload:async(path)=>{called.push(path);return {error:null};}})},rpc:async()=>({data:S,error:null})};
 const api=createPlaceContributionsClient({client});
 assert.deepEqual(await api.uploadGalleryPhotos(U,S,[jpg,jpg,jpg],false),{uploaded:[],failed:[]});
 assert.equal(called.length,0);
 const result=await api.uploadGalleryPhotos(U,S,[jpg,jpg,jpg],true,[2]);
 assert.deepEqual(result,{uploaded:[2,3],failed:[]});
 assert.deepEqual(called,[U+'/'+S+'-3.jpg']);
});
test('admin can only use restricted RPC to exclude or reinstate a photo',async()=>{
 const calls=[],client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='admin_place_submission_gallery'?[]:'rejected',error:null};}};
 const api=createPlaceContributionsClient({client});
 assert.deepEqual(await api.reviewGallery('krakow','pending'),[]);
 assert.equal(await api.moderateGalleryPhoto(S,4,false),'rejected');
 assert.deepEqual(calls.map(c=>c.name),['admin_place_submission_gallery','admin_moderate_place_gallery_photo']);
 assert.equal(calls[1].args.p_allow,false);
 await assert.rejects(()=>api.moderateGalleryPhoto(S,7,true),e=>e.code==='invalid-photo-position');
});
test('staged SQL enforces ownership, moderation, RLS and no direct writes',()=>{
 const sql=read('scripts/staged-place-public-gallery-20261105.sql');
 for(const marker of [
 'STAGED','create table if not exists public.place_submission_gallery',
 'position between 2 and 5','constraint place_gallery_exact_owner_path',
 'alter table public.place_submission_gallery enable row level security',
 'revoke all on table public.place_submission_gallery from public,anon,authenticated',
 'create policy place_gallery_public_select','moderation_status=\'approved\'',
 'p.status=\'published\'','p.visibility=\'public\'',
 'create policy city_route_place_gallery_insert_own on storage.objects',
 's.submitted_by=(select auth.uid())','s.status=\'pending\'',
 'create or replace function public.attach_place_submission_gallery_photo',
 'if p_confirm_rights is distinct from true',
 'create or replace function public.admin_moderate_place_gallery_photo',
 'if not public.is_app_admin()',
 'create trigger place_submission_gallery_approval',
 'where submission_id=new.id and moderation_status=\'pending\''
 ])assert.ok(sql.includes(marker),'missing SQL guard '+marker);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete) on table public\.place_submission_gallery to (?:anon|authenticated)/i);
 assert.match(sql,/p\.metadata->>'communitySubmissionId'=place_submission_gallery\.submission_id::text/,'public must read through the canonical published place, not through owner-only pending submission RLS');
});
test('user place and published place detail have independent, staged gallery views',()=>{
 const app=read('app.js'),runtime=read('place-contributions.js'),gallery=read('place-public-gallery.js'),admin=read('admin/place-submissions.js');
 assert.match(app,/d\.dataset\.gallerySubmissionId=p\.communitySubmissionId/);
 assert.match(app,/Ponów przesyłanie zdjęć/);
 assert.match(runtime,/uploadGalleryPhotos/);
 assert.match(runtime,/coverReady&&place\.imageRightsConfirmed/);
 assert.match(gallery,/\.eq\('moderation_status','approved'\)/);
 assert.match(gallery,/data-public-gallery/);
 assert.match(gallery,/aria-pressed/);
 assert.match(admin,/moderateGalleryPhoto/);
 assert.match(admin,/admin-gallery/);
 for(const file of ['place-public-gallery.js','place-contributions-client.js','place-contributions.js','admin/place-submissions.js','app.js'])execFileSync(process.execPath,['--check',file]);
});
test('PWA, build and moderator assets include gallery and bump cache',()=>{
 const html=read('index.html'),sw=read('service-worker.js'),build=read('scripts/build.mjs'),admin=read('admin/place-submissions.html');
 for(const item of ['place-public-gallery.js','place-public-gallery.css']){
  assert.ok(sw.includes(item),item+' not cached');
  assert.ok(build.includes(item),item+' not distributed');
 }
 assert.match(html,/place-public-gallery\.js\?v=1/);
 assert.match(sw,/city-route-v\d+/);
 assert.match(admin,/place-public-gallery\.css/);
});
