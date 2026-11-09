// Regression for founder's actual sequence: a real venue photo preview OR a real JPEG upload,
// then rating chips and Add Place submission must remain clickable. No real account/DB writes.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile, mkdir} from 'node:fs/promises';
const BASE='http://127.0.0.1:4186';
const jpeg=await readFile(new URL('../assets/images/lisbon-a-brasileira-commons.jpg',import.meta.url));
assert.ok(jpeg.length>100000,'use a realistic image, never the previous 1-pixel fixture');
const fakePlace={name:'Estádio da Luz QA',placeId:'ChIJLuzPhotoTest987654',provider:'google',
 location:{lat:38.7522,lng:-9.1849},address:'Lisboa, Portugal',
 photo:{available:true,authorName:'Tester'},types:['stadium']};
const server=spawn('python3',['-m','http.server','4186','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
try{
 for(let i=0;i<80;i++){try{if((await fetch(BASE+'/index.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 await mkdir('p0-smoke-artifacts',{recursive:true});
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}: {})});
  try{
   for(const width of [375,1220]){
    const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width<700,hasTouch:width<700,serviceWorkers:'block'});
    await ctx.route('**/*',route=>{
     const u=new URL(route.request().url());
     if(u.origin===BASE&&u.pathname==='/api/place-suggest')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',suggestions:[fakePlace]})});
     if(u.origin===BASE&&u.pathname==='/api/place-photo')return route.fulfill({status:200,contentType:'image/jpeg',body:jpeg});
     if(u.origin===BASE&&u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'disabled',suggestions:[],candidates:[],ratings:[],reviews:[]})});
     if(u.origin===BASE)return route.continue();
     return route.abort();
    });
    await ctx.addInitScript(()=>{
     localStorage.setItem('city-route-first-launch-v1','1');
     localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'photo-regression',nickname:'QA'},cityId:'lisbon',
      basket:[],basketsByCity:{lisbon:[]},events:[],session:null,userPlaces:[],placeReviews:{}}));
    });
    const page=await ctx.newPage();page.setDefaultTimeout(10000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const method of ['google-proposal','jpeg-upload']){
     try{
      await page.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
      await page.locator('#pc-q').waitFor();
      if(method==='google-proposal'){
       await page.locator('#pc-q').fill('Estádio da Luz QA');
       const option=page.locator('#pc-list .pc-provider').filter({hasText:'Estádio da Luz QA'});
       await option.waitFor({timeout:12000});await option.click();
       await page.locator('#place-form .pc-photo.is-accepted img').waitFor({timeout:12000});
       await page.locator('#place-form .pc-photo img').evaluate(el=>el.decode());
       assert.ok((await page.locator('#place-form').getAttribute('data-pc-google-place-id'))?.includes('LuzPhotoTest'));
      }else{
       await page.locator('#pc-q').fill('38.720123, -9.140123');
       await page.locator('#place-form input[name="name"]').fill('QA realistic JPG '+engine+' '+width);
       await page.waitForFunction(()=>document.querySelector('#place-form input[name="where"]')?.value.includes('38.720123'));
       const filePicker=page.waitForEvent('filechooser');
       await page.locator('#place-form label.file').click();
       await (await filePicker).setFiles({name:'stadium-photo.jpg',mimeType:'image/jpeg',buffer:jpeg});
       await page.locator('.place-photo-editor img').first().waitFor({timeout:12000});
       const controlsBeforeEditor=await page.locator('#place-form').evaluate(form=>{
        const rating=form.querySelector('input[name="rating"]')?.closest('fieldset');
        const save=form.querySelector('button.primary.big');
        const gallery=form.querySelector('.place-photo-editor');
        return !!(rating&&save&&gallery&&(rating.compareDocumentPosition(gallery)&Node.DOCUMENT_POSITION_FOLLOWING)&&(save.compareDocumentPosition(gallery)&Node.DOCUMENT_POSITION_FOLLOWING));
       });
       assert.equal(controlsBeforeEditor,true,'photo editor must not push rating and save below mobile navigation');
      }
      for(const value of ['1','3','5']){
       const radio=page.locator('#place-form input[name="rating"][value="'+value+'"]');
       const label=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="'+value+'"]')});
       await label.scrollIntoViewIfNeeded();
       // Do not force-center in the test: it previously masked navigation intercepting taps.
       await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
       const hit=await label.evaluate(el=>{
        const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,
          found=document.elementFromPoint(x,y);
        return {expected:el.outerHTML.slice(0,120),hit:found?.outerHTML.slice(0,180),
          hitOK:el.contains(found),disabled:el.querySelector('input')?.disabled};
       });
       assert.ok(hit.hitOK,'PHOTO_BLOCKS_RATING '+engine+' '+width+' '+method+' '+value+' '+JSON.stringify(hit));
       await label.click();assert.equal(await radio.isChecked(),true,'rating click failed after '+method);
      }
      const submit=page.locator('#place-form button.primary.big');await submit.scrollIntoViewIfNeeded();
      const hit=await submit.evaluate(el=>{const r=el.getBoundingClientRect();
       return {hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.outerHTML?.slice(0,180),
        hitOK:el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};
      });
      assert.ok(hit.hitOK,'PHOTO_BLOCKS_SUBMIT '+engine+' '+width+' '+method+' '+JSON.stringify(hit));
      await submit.click();await page.locator('#place-dialog[open]').waitFor({timeout:12000});
      const saved=await page.evaluate(()=>{
       const s=JSON.parse(localStorage.getItem('city-route-v1'));const p=s.userPlaces[0];
       return {name:p?.name,rating:s.placeReviews?.[p?.id],photos:p?.images?.length,googlePlaceId:p?.googlePlaceId};
      });
      assert.equal(saved.rating,5);if(method==='jpeg-upload')assert.equal(saved.photos,1);
      else assert.equal(saved.googlePlaceId,fakePlace.placeId);
      assert.deepEqual(errors,[]);
      console.log('PHOTO_REGRESSION_PASS',engine,width,method,JSON.stringify(saved));
     }catch(error){
      console.error('PHOTO_REGRESSION_FAIL',engine,width,method,String(error),errors);
      await page.screenshot({path:'p0-smoke-artifacts/photo-regression-'+engine+'-'+width+'-'+method+'.png',fullPage:true}).catch(()=>{});
      const snapshot=await page.evaluate(()=>{const f=document.querySelector('#place-form');return {form:f?.innerText?.slice(0,1000),photo:!!document.querySelector('.pc-photo.is-accepted'),gallery:!!document.querySelector('.place-photo-editor'),url:location.href}}).catch(()=>({}));
      console.error('PHOTO_REGRESSION_STATE',JSON.stringify(snapshot));throw error;
     }
    }
    await ctx.close();
   }
  }finally{await browser.close();}
 }
}finally{server.kill('SIGTERM');}
