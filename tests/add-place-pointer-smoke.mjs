// Real pointer regression: never force radio/input clicks past browser hit testing.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const BASE='http://127.0.0.1:4185';
const server=spawn('python3',['-m','http.server','4185','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(BASE+'/index.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 await mkdir('p0-smoke-artifacts',{recursive:true});
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  browser=await type.launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}: {})});
  for(const width of [375,1220]){
   const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width<700,hasTouch:width<700,serviceWorkers:'block'});
   await ctx.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===BASE&&!url.pathname.startsWith('/api/'))return route.continue();
    if(url.origin===BASE)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.pathname==='/api/photo-capabilities'?{googleThumbnails:false}:{status:'disabled',suggestions:[],candidates:[],ratings:[],reviews:[]})});
    return route.abort();
   });
   await ctx.addInitScript(()=>{
    localStorage.setItem('city-route-first-launch-v1','1');
    localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'pointer-test',nickname:'Test'},cityId:'lisbon',basket:['editorial-lisbon-se','editorial-lisbon-jeronimos'],basketsByCity:{lisbon:['editorial-lisbon-se','editorial-lisbon-jeronimos']},events:[],session:null,userPlaces:[],placeReviews:{}}));
   });
   const page=await ctx.newPage();page.setDefaultTimeout(8000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
   await page.locator('#pc-q').fill('38.720123, -9.140123');
   await page.locator('#place-form input[name=name]').fill('QA pointer '+engine+' '+width);
   await page.waitForFunction(()=>document.querySelector('#place-form input[name=where]')?.value.includes('38.720123'),{timeout:8000});
   // Every visible rating chip must own its whole pointer area, not a shifted/overlapping invisible input.
   for(const value of ['none','1','2','3','4','5']){
    const radio=page.locator('#place-form input[name=rating][value="'+value+'"]');
    const choice=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="'+value+'"]')});
    await choice.scrollIntoViewIfNeeded();
    const hit=await choice.evaluate(el=>{
     const r=el.getBoundingClientRect(),input=el.querySelector('input');
     const ir=input.getBoundingClientRect();
     const inside=ir.left>=r.left-.5&&ir.right<=r.right+.5&&ir.top>=r.top-.5&&ir.bottom<=r.bottom+.5;
     const points=[.18,.5,.82].map(p=>el.contains(document.elementFromPoint(r.left+r.width*p,r.top+r.height/2)));
     return {inside,points};
    });
    assert.equal(hit.inside,true,engine+' '+width+' '+value+' radio remains inside visual label');
    assert.ok(hit.points.every(Boolean),engine+' '+width+' '+value+' rating chip hit targets');
    await choice.click();
    assert.equal(await radio.isChecked(),true,engine+' '+width+' '+value+' should be selectable by pointer');
   }
   // Upload triggers app re-render; pointer targets must survive the restored draft.
   const upload=await page.locator('#place-form label.file').evaluate(el=>{
    const r=el.getBoundingClientRect(),i=el.querySelector('input[type=file]').getBoundingClientRect();
    return i.left>=r.left-.5&&i.right<=r.right+.5&&i.top>=r.top-.5&&i.bottom<=r.bottom+.5;
   });
   assert.equal(upload,true,engine+' '+width+' upload input contained in its visible label');
   await page.locator('#place-form input[type=file]').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4ZkAAAAASUVORK5CYII=','base64')});
   await page.locator('.place-photo-editor').waitFor();
   const last=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="5"]')});
   await last.click();assert.equal(await page.locator('#place-form input[name=rating][value="5"]').isChecked(),true);
   const submit=page.locator('#place-form button.primary.big');await submit.scrollIntoViewIfNeeded();
   assert.equal(await submit.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,engine+' '+width+' submit center receives pointer');
   await page.screenshot({path:'p0-smoke-artifacts/add-pointer-'+engine+'-'+width+'.png',fullPage:true});
   await submit.click();await page.locator('#place-dialog[open]').waitFor();
   const saved=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('city-route-v1'));const p=s.userPlaces.find(p=>p.name.startsWith('QA pointer'));return {name:p?.name,rating:s.placeReviews[p?.id],photos:p?.images?.length};});
   assert.equal(saved.rating,5);assert.equal(saved.photos,1);
   assert.deepEqual(errors,[]);console.log('ADD_POINTER_PASS '+engine+' '+width+' '+JSON.stringify(saved));
   await ctx.close();
  }
  await browser.close();browser=null;
 }
}finally{await browser?.close();server.kill('SIGTERM');}
