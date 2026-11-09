import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const css=read('ui-icons.css');

test('PHOTO FIRST #178: every fallback class has a real bundled photograph, not a category glyph',()=>{
 const classes=['food','night','culture','nature','stay','city'];
 const covers={
  food:'place-koszyki.jpg',
  night:'place-17131946.jpg',
  culture:'place-35839613.jpg',
  nature:'place-12028385.jpg',
  stay:'place-17131946.jpg',
  city:'place-31495562.jpg'
 };
 for(const klass of classes){
  assert.ok(css.includes('.ph.ph-cat.ph-'+klass+'{--cr-illustration:url(./assets/images/'+covers[klass]+')}'),
    'fallback source missing for '+klass);
  assert.ok(existsSync(new URL('../assets/images/'+covers[klass],import.meta.url)),'photo asset missing: '+covers[klass]);
 }
 const app=read('app.js');
 assert.match(app,/return catTile\(p,cls,geo\)/,'no-photo path must still call shared tile');
 assert.match(app,/img\.outerHTML=catTile\(p/,'provider photo errors must fall back to a photographic tile');
 assert.match(css,/\.ph\.ph-cat::before\{/);
});

test('PHOTO FIRST #178: fallback is visibly identified as illustrative and never impersonates a venue',()=>{
 assert.match(css,/content:"Zdjęcie ilustracyjne"/);
 assert.match(css,/\.ph\.ph-cat \.ph-cat-glyph,\.ph\.ph-cat \.ph-cat-ghost\{display:none\}/);
 assert.match(css,/--cr-illustration:url\(\.\/assets\/images\/place-31495562\.jpg\)/);
 const catalog=JSON.parse(read('data/places.json'));
 for(const filename of ['place-koszyki.jpg','place-17131946.jpg','place-35839613.jpg','place-12028385.jpg','place-31495562.jpg']){
  const source=catalog.find(p=>p.image===filename);
  assert.ok(source?.imageCredit?.source,'source details missing: '+filename);
  assert.ok(['Pexels License','CC0'].includes(source.imageCredit.license),'only zero-attribution local covers: '+filename);
 }
});
