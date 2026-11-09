import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {placeFromCatalogue} from '../catalogue-client.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const photos=JSON.parse(read('scripts/data/lisbon-first30-photos-20261109.json'));
const places=JSON.parse(read('data/cities/lisbon/places.json'));
const sql=read('scripts/staged-lisbon-photos-20261109.sql').toString();
const payload=JSON.parse(sql.split('$lisbon_photos$')[1]);
test('permanent Lisbon covers ship exact reviewed JPEG bytes with reusable source and attribution',()=>{
 assert.equal(photos.length,8);assert.equal(new Set(photos.map(x=>x.id)).size,8);
 assert.equal(new Set(photos.map(x=>x.image)).size,8);
 for(const x of photos){
  assert.match(x.image,/^lisbon-[a-z-]+-commons\.jpg$/);
  const bytes=read('assets/images/'+x.image);
  assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(bytes.length,x.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),x.sha256);
  assert.equal(x.width,960);assert.ok(x.height>=400);
  assert.ok(x.credit.author);assert.equal(x.credit.via,'Wikimedia Commons');
  assert.equal(new URL(x.credit.source).hostname,'commons.wikimedia.org');
  assert.equal(new URL(x.downloadUrl).hostname,'thumb.wikimedia.org');
  assert.match(x.credit.license,/^CC BY(-SA)? [234]\.0$/);
  assert.equal(new URL(x.credit.licenseUrl).hostname,'creativecommons.org');
  assert.match(x.identityReview,/manual exact-entity/);assert.ok(x.identityEvidence.length>70);
  assert.match(x.changes,/unmodified/);
  assert.ok(read('service-worker.js').toString().includes("'./assets/images/"+x.image+"'"),'offline precache includes asset');
 }
});
test('hosted adapter and offline catalogue preserve identical image and visible credits',()=>{
 for(const x of photos){
  const fallback=places.find(p=>p.id===x.id),hosted=payload.find(p=>p.id===x.id);
  assert.ok(fallback);assert.ok(hosted);
  assert.equal(fallback.image,x.image);assert.equal(fallback.imageCaption,x.caption);
  assert.deepEqual(fallback.imageCredit,x.credit);
  const mapped=placeFromCatalogue({...hosted,name:fallback.name},'lisbon');
  assert.equal(mapped.image,fallback.image);assert.equal(mapped.imageCaption,fallback.imageCaption);
  assert.deepEqual(mapped.imageCredit,fallback.imageCredit);
  assert.ok(!['identity-unverified','historical','temporarily-closed'].includes(fallback.metadata?.editorial?.visitStatus));
 }
 assert.equal(places.filter(p=>p.image).length,8,'coverage is eight, not the entire first30');
});
test('photo DML rejects conflicting images and metadata, bounds both writes and rollback',()=>{
 assert.equal(payload.length,8);assert.equal(new Set(payload.map(p=>p.id)).size,8);
 assert.equal((sql.match(/coalesce\(p.image_meta,'\{\}'::jsonb\)=u.before_image_meta/g)||[]).length,2);
 assert.equal((sql.match(/p.image_url is not distinct from u.before_image_url/g)||[]).length,2);
 assert.equal((sql.match(/@> u.image_meta/g)||[]).length,2);
 assert.match(sql,/if matched<>8/);assert.match(sql,/if changed<>8/);assert.match(sql,/c.slug='lisbon'/);
 assert.doesNotMatch(sql,/delete from|alter table|truncate|description\s*=|metadata\s*=|ratings\s*=/i);
 const rollback=read('scripts/rollback-lisbon-photos-20261109.sql').toString();
 assert.match(rollback,/p.image_url=u.image_url and p.image_meta=\(u.before_image_meta\|\|u.image_meta\)/);
 assert.match(rollback,/if changed<>8/);assert.match(rollback,/c.slug='lisbon'/);
 assert.deepEqual(JSON.parse(rollback.split('$lisbon_photos$')[1]),payload);
});
