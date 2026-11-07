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

test('catalogue rows use the cheap thumbnail path; only community places use the full lookup from lists',()=>{
 assert.match(app,/const needsProvider=p=>!!p&&\(p\.origin==='community'\|\|p\.kind==='user'\)&&!providerOverlay\.has\(p\.id\)/);
 assert.match(app,/<div class="thumb">\$\{photo\(p,'',false,true\)\}/,'place list rows ask for a thumbnail');
 assert.match(app,/'\/api\/place-thumb\?'\+new URLSearchParams\(/);
 assert.match(app,/loading="\$\{eager\?'eager':'lazy'\}" decoding="async" referrerpolicy="no-referrer" data-thumb-for=/,'list rows are lazy, so only rows near the screen are requested');
 assert.match(app,/function handlePhotoError\(img\)\{/,'there is a single shared image-error handler');
 assert.match(app,/if\(img\.dataset\.thumbFor\)\{/,'Google thumbnails get the category fallback');
 assert.match(app,/img\.outerHTML=catTile\(p,esc\(img\.dataset\.thumbCls\|\|''\),''\);/,'Google tile preserves the thumbnail class');
 assert.match(app,/img\.dataset\.failed==='1'\|\|!img\.isConnected\|\|!img\.parentNode/,'already-handled or detached images are ignored');
 assert.equal((app.match(/document\.addEventListener\('error'/g)||[]).length,1,'never attach competing image-error handlers');
 assert.match(app,/\|\|p\.kind==='sidequest'\)return null;/,'side quests have no venue photo');
 assert.doesNotMatch(app,/p\.kind==='user'\|\|p\.kind==='sidequest'\)return null;/,'own places also get a photo');
 assert.match(app,/<div class="sheet-media">\$\{photo\(p,'sheet-photo',true,800\)\}/,'the place card falls back to an 800 px photo');
 assert.match(app,/while\(enrichActive<3&&enrichQueue\.length\)/);
 assert.match(app,/providerObserver\?\.disconnect\(\);providerObserver=null;enrichQueue\.length=0;/,'a list change drops unseen work');
 assert.match(app,/if\(row\)row\.outerHTML=placeRow\(all\[p\.id\]\);else render\(\);/);
 assert.doesNotMatch(app,/THUMBS|ph-letter|ph-nightlife/);
});
