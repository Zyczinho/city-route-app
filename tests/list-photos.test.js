// Lists load provider photos for visible rows; places without an authorised photo get a category tile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ICON_NAMES,iconMarkup} from '../ui-icons.js';

const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../ui-icons.css',import.meta.url),'utf8');
const taxonomy=JSON.parse(await readFile(new URL('../data/taxonomy.json',import.meta.url),'utf8'));
const lines=app.split('\n'),from=lines.findIndex(l=>l.startsWith('const CAT_TILE=')),to=lines.findIndex(l=>l.startsWith('function catTile('));
const ctx={ic:iconMarkup};
vm.runInNewContext(`${lines.slice(from,to+1).join('\n')}\nthis.CAT_TILE=CAT_TILE;this.catTile=catTile;`,ctx);

test('every taxonomy category has a tile with a shipped Lucide icon and a styled mood',()=>{
 for(const id of taxonomy.groups.flatMap(g=>g.types.map(t=>t.id))){
  const tile=ctx.CAT_TILE[id];
  if(!tile)continue; // unmapped categories fall back to the city tile
  assert.ok(ICON_NAMES.includes(tile[0]),`${id}: ${tile[0]}`);
  assert.match(css,new RegExp(`\\.ph-${tile[1]}\\{`),`${id}: .ph-${tile[1]}`);
 }
 for(const id of ['bar','pub','club','cafe','restaurant','museum','park'])assert.ok(ctx.CAT_TILE[id],id);
});

test('tile is an honest placeholder, not a photo',()=>{
 const html=ctx.catTile({categoryId:'pub',name:'Jabeerwocky'},'','');
 assert.match(html,/class="ph ph-cat ph-night /);
 assert.match(html,/aria-label="Brak fotografii lokalu"/);
 assert.match(html,/beer\.svg/);
 assert.doesNotMatch(html,/<img/);
 assert.match(ctx.catTile({cats:['nocne']},'',''),/wine\.svg/,'legacy JSON places map through their old category');
 assert.match(ctx.catTile({},'',''),/map-pin\.svg/);
});

test('visible catalogue rows are enriched in a bounded queue and patched in place',()=>{
 assert.match(app,/const needsProvider=p=>!!p&&!providerOverlay\.has\(p\.id\)&&\(!p\.image\|\|!providerRatings\(p\)\.length\)/);
 assert.doesNotMatch(app,/origin==='community'\|\|p\?\.kind==='user'\)&&!providerOverlay/,'no longer limited to community places');
 assert.match(app,/while\(enrichActive<3&&enrichQueue\.length\)/);
 assert.match(app,/providerObserver\?\.disconnect\(\);providerObserver=null;enrichQueue\.length=0;/,'a list change drops unseen work');
 assert.match(app,/if\(row\)row\.outerHTML=placeRow\(all\[p\.id\]\);else render\(\);/);
 assert.doesNotMatch(app,/THUMBS|ph-letter|ph-nightlife/);
});
