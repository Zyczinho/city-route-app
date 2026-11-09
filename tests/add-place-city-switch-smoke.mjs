import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
const BASE='http://127.0.0.1:4191',image=await readFile('assets/images/lisbon-a-brasileira-commons.jpg');
const server=spawn('python3',['-m','http.server','4191','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
await mkdir('p0-smoke-artifacts',{recursive:true});
try{
 for(let i=0;i<80;i++){try{if((await fetch(BASE+'/index.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
  try{
   for(const city of [{id:'warsaw',lat:52.2297,lng:21.0122,title:'Warszawa stadium QA'},{id:'lisbon',lat:38.7522,lng:-9.1849,title:'Estádio da Luz QA'}]){
    const ctx=await browser.newContext({viewport:{width:375,height:790},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    await ctx.route('**/*',route=>{
     const u=new URL(route.request().url());
     if(u.hostname==='nominatim.openstreetmap.org'){
      const code=u.searchParams.get('countrycodes'),wanted=city.id==='lisbon'?'pt':'pl';
      console.log('GEOCODE_CITY',city.id,code,u.searchParams.get('q'));
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
       body:JSON.stringify(code===wanted?[{lat:String(city.lat),lon:String(city.lng),name:city.title,display_name:city.title}]:[])});
     }
     if(u.origin!==BASE)return route.abort();
     if(u.pathname==='/api/place-suggest')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',suggestions:[{provider:'google',name:city.title,address:city.title,placeId:'ChIJCitySwitchTest987654',location:{lat:city.lat,lng:city.lng},photo:{available:true,authorName:'QA'}}]})});
     if(u.pathname==='/api/place-photo')return route.fulfill({status:200,contentType:'image/jpeg',body:image});
     if(u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'no-key',suggestions:[],image:null})});
     return route.continue();
    });
    await ctx.addInitScript(()=>{localStorage.setItem('city-route-first-launch-v1','1');localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'city-switch',nickname:'QA'},cityId:'warsaw',basket:[],basketsByCity:{warsaw:[],lisbon:[]},events:[],userPlaces:[],placeReviews:{}}));});
    const page=await ctx.newPage();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.goto(BASE+'/#plan',{waitUntil:'domcontentloaded'});
     await page.locator('#city-select').waitFor();
     if(city.id==='lisbon'){await page.locator('#city-select').selectOption('lisbon');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('city-route-v1')).cityId==='lisbon'&&document.title.includes('Lizbona'),null,{timeout:30000});}
     await page.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
     await page.locator('#pc-q').waitFor();
     assert.equal(await page.locator('#city-select').inputValue(),city.id);
     await page.locator('#pc-q').fill(city.title);
     const option=page.locator('#pc-list .pc-provider').first();
     await option.waitFor();await option.click();
     await page.locator('.pc-photo.is-accepted img').first().waitFor();
     await page.locator('.pc-photo img').first().evaluate(el=>el.decode());
     const rating=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="5"]')});
     await rating.scrollIntoViewIfNeeded();
     const ratingHit=await rating.evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return{ok:el.contains(hit),element:hit?.outerHTML?.slice(0,130),rect:b.toJSON()}});
     assert.ok(ratingHit.ok,'RATING_BLOCKED '+JSON.stringify(ratingHit));
     await rating.click();assert.equal(await page.locator('input[name="rating"][value="5"]').isChecked(),true);
     const button=page.locator('#place-form button.primary.big');await button.scrollIntoViewIfNeeded();
     const saveHit=await button.evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return{ok:el.contains(hit),element:hit?.outerHTML?.slice(0,130)}});
     assert.ok(saveHit.ok,'SAVE_BLOCKED '+JSON.stringify(saveHit));
     await button.click();await page.locator('#place-dialog[open]').waitFor({timeout:15000});
     const result=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('city-route-v1')),p=s.userPlaces[0];return{city:s.cityId,placeCity:p?.cityId,rating:s.placeReviews[p?.id],name:p?.name}});
     assert.equal(result.placeCity,city.id);assert.equal(result.rating,5);assert.deepEqual(errors,[]);
     // This is the city-specific path missed by earlier tests: handwritten venue address plus photo.
     await page.evaluate(()=>{location.hash='#add-place'});
     await page.locator('#place-form').waitFor();
     const manual=city.id==='lisbon'?'Rua Augusta 100':'Marszałkowska 1';
     await page.locator('#pc-q').fill(manual);
     await page.locator('#place-form input[name="name"]').fill(city.title+' address');
     await page.locator('#place-form input[name="photo"]').setInputFiles({name:'venue.jpg',mimeType:'image/jpeg',buffer:image});
     await page.locator('.place-photo-editor img').first().waitFor();
     const four=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="4"]')});
     await four.click();
     const save=page.locator('#place-form button.primary.big');
     await save.click();
     await page.locator('#place-dialog[open]').waitFor({timeout:20000});
     const manualResult=await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('city-route-v1')),p=s.userPlaces[0];
      return{city:s.cityId,placeCity:p?.cityId,rating:s.placeReviews[p?.id],photos:p?.images?.length};
     });
     assert.equal(manualResult.placeCity,city.id);assert.equal(manualResult.rating,4);assert.equal(manualResult.photos,1);
     console.log('CITY_MANUAL_ADDRESS_PASS',name,city.id,JSON.stringify(manualResult));
     console.log('CITY_SWITCH_PASS',name,city.id,JSON.stringify({ratingHit,saveHit,result}));
    }catch(e){
     console.log('CITY_SWITCH_FAIL',name,city.id,String(e),JSON.stringify(errors));
     await page.screenshot({path:'p0-smoke-artifacts/city-switch-'+name+'-'+city.id+'.png',fullPage:true}).catch(()=>{});
     console.log('CITY_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({url:location.href,city:document.querySelector('#city-select')?.value,form:document.querySelector('#place-form')?.innerText?.slice(0,1100)})).catch(()=>({}))));
     throw e;
    }finally{await ctx.close();}
   }
  }finally{await browser.close();}
 }
}finally{server.kill('SIGTERM');}
