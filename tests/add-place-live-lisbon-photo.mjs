// Single-run real production Lisbon photo-source diagnostic. Uses an isolated local browser profile.
// No account login, no public submission, no test place sent to Supabase.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const URL='https://city-route-app.jakublojek.workers.dev';
await mkdir('p0-smoke-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'pl-PL',serviceWorkers:'block'});
 await ctx.addInitScript(()=>{
  localStorage.setItem('city-route-first-launch-v1','1');
  localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'photo-live-qa',nickname:'QA'},cityId:'warsaw',basket:[],basketsByCity:{warsaw:[],lisbon:[]},events:[],userPlaces:[],placeReviews:{}}));
 });
 const page=await ctx.newPage();page.setDefaultTimeout(23000);
 const errors=[],endpoints=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/api/place-')){try{endpoints.push({path:new URL(r.url()).pathname,status:r.status(),type:r.headers()['content-type']||''})}catch{}}});
 try{
  await page.goto(URL+'/#plan',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#city-select').waitFor();
  await page.locator('#city-select').selectOption('lisbon');
  await page.waitForFunction(()=>document.querySelector('#city-select')?.value==='lisbon'&&document.title.includes('Lizbona'),null,{timeout:30000});
  await page.evaluate(()=>{location.hash='#add-place'});
  await page.locator('#pc-q').waitFor();
  await page.locator('#pc-q').fill('Estádio da Luz');
  await page.locator('#pc-list .pc-provider').first().waitFor({timeout:25000});
  const options=await page.locator('#pc-list [role="option"]').evaluateAll(list=>list.map(el=>({type:el.className,title:el.innerText.slice(0,150)})));
  console.log('LIVE_LISBON_OPTIONS',JSON.stringify(options));
  await page.locator('#pc-list .pc-provider').first().click();
  await page.waitForTimeout(1200);
  await page.waitForFunction(()=>!document.querySelector('.pc-photo-state')?.textContent?.includes('Szukam zdjęcia'),null,{timeout:28000});
  const photo=await page.locator('#place-form').evaluate(form=>({text:form.innerText.slice(0,850),photo:form.querySelector('.pc-photo img')?.src||null,accepted:!!form.querySelector('.pc-photo.is-accepted'),where:form.querySelector('input[name="where"]')?.value}));
  console.log('LIVE_LISBON_PHOTO',JSON.stringify(photo));
  if(!photo.photo)throw new Error('NO_LIVE_PHOTO_PREVIEW');
  await page.locator('.pc-photo img').first().evaluate(el=>el.decode()).catch(()=>{});
  if(!photo.accepted&&await page.locator('[data-pc-photo="accept"]').count())await page.locator('[data-pc-photo="accept"]').click();
  const rating=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="5"]')});
  await rating.scrollIntoViewIfNeeded();
  const hit=await rating.evaluate(el=>{const b=el.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {hitOK:el.contains(h),hit:h?.outerHTML.slice(0,200),rect:b.toJSON()}});
  console.log('LIVE_LISBON_RATING_HIT',JSON.stringify(hit));
  assert.ok(hit.hitOK,'rating covered by '+hit.hit);
  await rating.click({timeout:10000});
  assert.equal(await page.locator('#place-form input[name="rating"][value="5"]').isChecked(),true);
  const button=page.locator('#place-form button.primary.big');
  await button.scrollIntoViewIfNeeded();
  const buttonHit=await button.evaluate(el=>{const b=el.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {hitOK:el.contains(h),hit:h?.outerHTML.slice(0,200)}});
  console.log('LIVE_LISBON_SAVE_HIT',JSON.stringify(buttonHit));
  assert.ok(buttonHit.hitOK,'save button covered');
  await button.click({timeout:10000});
  await page.locator('#place-dialog[open]').waitFor({timeout:16000});
  const saved=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('city-route-v1')),p=s.userPlaces?.[0];return {city:s.cityId,placeCity:p?.cityId,name:p?.name,rating:s.placeReviews?.[p?.id],photo:!!p?.image||!!p?.googlePlaceId}});
  console.log('LIVE_LISBON_SAVED',JSON.stringify(saved));
  assert.equal(saved.placeCity,'lisbon');
  assert.equal(saved.rating,5);
  console.log('LIVE_LISBON_PASS',JSON.stringify({endpoints,errors}));
 }catch(e){
  console.error('LIVE_LISBON_FAIL',String(e),'endpoints',JSON.stringify(endpoints),'errors',JSON.stringify(errors));
  await page.screenshot({path:'p0-smoke-artifacts/lisbon-real-photo.png',fullPage:true}).catch(()=>{});
  console.error('LIVE_LISBON_STATE',JSON.stringify(await page.evaluate(()=>({city:document.querySelector('#city-select')?.value,hash:location.hash,toast:document.querySelector('#toast')?.innerText,form:document.querySelector('#place-form')?.innerText.slice(0,1200)})).catch(()=>({}))));
  throw e;
 }
}finally{await browser.close();}
