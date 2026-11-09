import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const uiIcons=['bookmark','plus','minus','check','heart','chevron-right','users','map-pin','navigation','route','message-circle','compass','camera','image-plus','pencil','search','sliders-horizontal','star','ticket-percent'];
test('City Route uses real local Lucide assets for core UI actions',()=>{
 for(const icon of uiIcons){
  const path=new URL('../assets/icons/ui/'+icon+'.svg',import.meta.url);
  assert.ok(existsSync(path),'missing icon '+icon);
  const svg=read('assets/icons/ui/'+icon+'.svg');
  assert.match(svg,/<svg/);
  assert.match(svg,/viewBox="0 0 24 24"/);
  assert.match(svg,/stroke="currentColor"/);
 }
});
test('design contract is mandatory for future UI work and forbids mixing icon families',()=>{
 const agents=read('AGENTS.md'),design=read('docs/CITY_ROUTE_DESIGN_SYSTEM_V1.md');
 assert.match(agents,/CITY_ROUTE_DESIGN_SYSTEM_V1\.md/);
 assert.match(design,/Lucide/);
 assert.match(design,/Obserwujący/);
 assert.match(design,/friends/);
 assert.match(design,/Wikimedia Commons/);
});
