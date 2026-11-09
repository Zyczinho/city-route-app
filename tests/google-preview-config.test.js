import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const raw=await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const config=JSON.parse(raw.replace(/^\s*\/\/.*$/gm,''));
const vars=config.previews?.vars||{};

test('preview has explicitly isolated, fail-closed provider flags',()=>{
 assert.ok(config.previews,'Cloudflare Worker Preview settings exist');
 assert.equal(vars.GOOGLE_PLACES_BETA_ENABLED,'off');
 assert.equal(vars.GOOGLE_PLACES_AUTOCOMPLETE,'off');
 assert.equal(vars.GOOGLE_PLACES_INCLUDE_REVIEWS,'off');
 assert.equal(vars.TRIPADVISOR_CONTENT_BETA_ENABLED,'off');
 assert.equal(vars.TRIPADVISOR_CONTENT_INCLUDE_REVIEWS,'off');
 assert.equal(vars.TRIPADVISOR_TERRA_INCLUDE_REVIEWS,'off');
});

test('preview limits are deliberately small; no provider keys are committed',()=>{
 for(const name of ['GOOGLE_PLACES_DAILY_CAP','GOOGLE_THUMBS_DAILY_CAP']){
  assert.ok(Number.isInteger(Number(vars[name])));
  assert.ok(Number(vars[name])>=1&&Number(vars[name])<=5,name+' must stay tiny before provider hard quota');
 }
 for(const name of ['GOOGLE_PLACES_API_KEY','TRIPADVISOR_CONTENT_API_KEY','TRIPADVISOR_TERRA_API_KEY']){
  assert.equal(vars[name],undefined,name+' should only be a Cloudflare secret');
  assert.equal(config.vars?.[name],undefined,'no production credentials in version control');
 }
 assert.equal(config.vars?.GOOGLE_PLACES_BETA_ENABLED,undefined,'no production override');
});
