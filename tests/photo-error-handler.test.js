import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const match=app.match(/function handlePhotoError\(img\)\{[\s\S]*?\n\}\ndocument\.addEventListener\('error'/);
assert.ok(match,'one shared error handler must be declared near the photo renderer');
const source=match[0].slice(0,match[0].lastIndexOf('\ndocument.addEventListener'));

class FakeImage {
 constructor(dataset={},isConnected=true){
  this.dataset={...dataset};this.isConnected=isConnected;this.parentNode=isConnected?{}:null;
  this.className='sheet-photo';this.outerHTML='<img>';
 }
}
const calls=[];
const ctx={
 HTMLImageElement:FakeImage,
 all:{'test-place':{name:'Example venue',categoryId:'bar'}},
 catTile:(p,cls)=>{calls.push({p,cls});return '<div class="category '+cls+'">'+(p?.name||'No place')+'</div>';},
 ic:()=>'<svg class="camera"></svg>',
 esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;')
};
vm.runInNewContext(source+'\nthis.handlePhotoError=handlePhotoError;',ctx);

test('exactly one delegated image error listener owns every broken image',()=>{
 assert.equal((app.match(/document\.addEventListener\('error'/g)||[]).length,1);
});
test('Google thumbnail uses category tile, preserves card class and only updates once',()=>{
 const img=new FakeImage({thumbFor:'test-place',thumbCls:'sheet-photo'});
 assert.equal(ctx.handlePhotoError(img),true);
 assert.match(img.outerHTML,/category sheet-photo/);
 assert.match(img.outerHTML,/Example venue/);
 assert.equal(img.dataset.failed,'1');
 assert.equal(ctx.handlePhotoError(img),false);
 assert.equal(calls.length,1);
 assert.match(app,/img\.outerHTML=catTile\(p,esc\(img\.dataset\.thumbCls\|\|''\),geo\)/,'Google errors must retry Commons');
});
test('ordinary broken image retains neutral camera fallback',()=>{
 const img=new FakeImage();
 img.className='cover-photo';
 assert.equal(ctx.handlePhotoError(img),true);
 assert.match(img.outerHTML,/class="ph cover-photo"/);
 assert.match(img.outerHTML,/class="camera"/);
});
test('detached, already handled and unrelated event targets are safe no-ops',()=>{
 for(const img of [new FakeImage({thumbFor:'test-place'},false),new FakeImage({failed:'1'})]){
  const old=img.outerHTML;
  assert.equal(ctx.handlePhotoError(img),false);
  assert.equal(img.outerHTML,old);
 }
 assert.equal(ctx.handlePhotoError({dataset:{thumbFor:'test-place'}}),false);
});
test('fallback CSS class attribute is escaped before injection',()=>{
 const img=new FakeImage();
 img.className='photo" onload="alert(1)';
 assert.equal(ctx.handlePhotoError(img),true);
 assert.doesNotMatch(img.outerHTML,/class="ph photo" onload=/);
 assert.match(img.outerHTML,/&quot;/);
});
