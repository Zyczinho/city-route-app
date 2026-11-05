import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cacheNameFor,contentHash,CACHE_PATTERN} from '../scripts/cache-version.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const ROLES=['coordinator','auditor','ux-editor','api-integrator','source-scout','place-curator','qa-release','reviewer'];

test('every agent role has a Claude Code subagent file, a notes file and a row in TEAM.md',()=>{
 const team=read('docs/agents/TEAM.md');
 for(const role of ROLES){
  const file='.claude/agents/'+role+'.md';
  assert.ok(existsSync(new URL('../'+file,import.meta.url)),'missing '+file);
  const body=read(file);
  assert.match(body,new RegExp('^---\r?\nname: '+role+'\r?\ndescription: .{40,}','m'),role+' needs name + description frontmatter');
  assert.match(body,/## Never/,role+' must state its limits');
  assert.ok(existsSync(new URL('../docs/agents/'+role+'/NOTES.md',import.meta.url)),'missing notes for '+role);
  assert.ok(team.includes('.claude/agents/'+role+'.md'),'TEAM.md does not list '+role);
 }
});

test('v1.0 personas are canonical and wired to the auditor, AGENTS.md and the issue template',()=>{
 const personas=read('docs/personas/CITY_ROUTE_PERSONAS_V1.md');
 for(const p of ['THE NEWCOMER','THE TIME-LIMITED EXPLORER','THE AUTHENTICITY SEEKER','THE SPONTANEOUS SOCIAL EXPLORER'])assert.ok(personas.includes(p),p);
 assert.match(personas,/Scenariusz testowy Audytora/);
 assert.match(read('.claude/agents/auditor.md'),/docs\/personas\/CITY_ROUTE_PERSONAS_V1\.md/);
 assert.match(read('AGENTS.md'),/docs\/agents\/TEAM\.md/);
 const template=read('.github/ISSUE_TEMPLATE/audit-finding.yml');
 for(const f of ['Persona','Severity','Steps to reproduce','Expected result','Actual result','Proposed fix'])assert.ok(template.includes(f),f);
});

test('built service worker cache name gets a stable content hash, source keeps the base version',async()=>{
 const sw=read('service-worker.js');
 assert.match(sw,CACHE_PATTERN,'source keeps const CACHE=\'city-route-vNN\'');
 assert.equal(cacheNameFor("const CACHE='city-route-v64';x",'abcdef0123456789'),"const CACHE='city-route-v64-abcdef0123';x");
 assert.throws(()=>cacheNameFor('nothing here','abcdef0123'),/not found/);
 const dir=mkdtempSync(join(tmpdir(),'cr-hash-'));
 mkdirSync(join(dir,'a'));writeFileSync(join(dir,'a','x.js'),'one');writeFileSync(join(dir,'service-worker.js'),'ignored');
 const h1=await contentHash(dir);
 writeFileSync(join(dir,'service-worker.js'),'changed sw only');
 assert.equal(await contentHash(dir),h1,'the service worker itself is not part of the hash');
 writeFileSync(join(dir,'a','x.js'),'two');
 assert.notEqual(await contentHash(dir),h1,'any shipped file change gives a new cache name');
 assert.match(read('scripts/build.mjs'),/cacheNameFor\(sw,await contentHash\('dist'\)\)/);
});
