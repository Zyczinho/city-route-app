// Browser acceptance for 30-page Places on 320/375/390px without billable providers.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const PORT=4187,ROOT='http://127.0.0.1:'+PORT;
let server,browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let ready=false;
 for(let attempt=0;attempt<75;attempt++){try{const r=await fetch(ROOT+'/index.html');if(r.ok){ready=true;break;}}catch{}await sleep(160);}
 assert.ok(ready,'built application available');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await ctx.route(/supabase\.co/,route=>route.abort());
 await ctx.route(/\/api\/place-thumb/,route=>route.fulfill({status:404,headers:{'x-thumb-status':'no-key'},body:''}));
 await ctx.route(/\/api\/provider-status/,route=>route.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify({status:'ok',providers:{google:{photos:'no-key',ratings:'no-key'},tripadvisor:{content:'no-key',terra:'no-key'}}})}));
 await ctx.route(/commons\.wikimedia\.org/,route=>route.abort());
 await ctx.addInitScript(()=>{
  localStorage.setItem('city-route-first-launch-v1','1');
  localStorage.setItem('city-route-v1',JSON.stringify({
   version:1,tester:{id:'pagination-smoke',nickname:'Tester'},basket:[],basketsByCity:{warsaw:[]},
   events:[],session:null,cityId:'warsaw',userPlaces:[],savedPlacesByCity:{warsaw:[]},
   myRoutes:[],placeReviews:{}
  }));
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto(ROOT+'/#places',{waitUntil:'domcontentloaded'});
 await page.locator('.place-list .place').first().waitFor({timeout:25000});
 assert.equal(await page.locator('.place-list .place').count(),30,'only 30 Warsaw cards in document');
 const rangeText=await page.locator('[data-places-range]').textContent();
 const total=Number(rangeText.match(/z (\d+) miejsc/)?.[1]);
 assert.ok(total>30&&total<=50,'Warsaw fixture after hotel exclusion: '+rangeText);
 assert.match(rangeText,/^1–30 z /);
 assert.match(await page.locator('.places-pager-progress').first().textContent(),/Strona 1 z 2/);
 const initial=await page.locator('.place-list .place').evaluateAll(items=>items.map(x=>x.dataset.placeId));
 assert.equal(new Set(initial).size,30);
 assert.ok(await page.locator('.map-hint').count(),'map remains empty until category selection');
 await page.locator('#places-map').evaluate(el=>{el.dataset.identity='preserve-map-on-page-change';});
 await page.locator('.places-pager').first().getByRole('button',{name:'Następna strona'}).click();
 assert.equal(await page.locator('.place-list .place').count(),total-30,'only remaining non-hotel Warsaw places appear on second page');
 assert.equal(await page.locator('[data-places-range]').textContent(),'31–'+total+' z '+total+' miejsc');
 const second=await page.locator('.place-list .place').evaluateAll(items=>items.map(x=>x.dataset.placeId));
 assert.equal(second.length,total-30);assert.ok(second.every(id=>!initial.includes(id)),'no place repeated across pages');
 assert.equal(await page.locator('#places-map').getAttribute('data-identity'),'preserve-map-on-page-change','page change does not remount map');
 assert.ok(await page.locator('.map-hint').count(),'category opt-in for map is preserved');
 await page.locator('.places-pager').last().getByRole('button',{name:'Strona 1'}).click();
 assert.deepEqual(await page.locator('.place-list .place').evaluateAll(items=>items.map(x=>x.dataset.placeId)),initial);

 await page.locator('.places-pager').first().getByRole('button',{name:'Strona 2'}).click();
 await page.locator('#sort').selectOption('rating');
 assert.equal(await page.locator('[data-places-range]').textContent(),'1–30 z '+total+' miejsc','sort resets to page 1');
 await page.locator('.places-pager').first().getByRole('button',{name:'Strona 2'}).click();
 await page.locator('[data-action="cat"][data-value="saved"]').click();
 assert.equal(await page.locator('.place-list .place').count(),0);
 assert.equal(await page.locator('.places-pager').count(),0,'no page chooser for empty filtered list');
 assert.match(await page.locator('[data-places-range]').textContent(),/0 miejsc/);
 await page.locator('[data-action="cat"][data-value="all"]').click();
 assert.equal(await page.locator('.place-list .place').count(),30);

 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:812});
  const geom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(geom.scroll<=geom.inner+1,'no mobile horizontal overflow '+JSON.stringify({width,...geom}));
  const controls=await page.locator('.places-pager').first().locator('button').evaluateAll(bs=>bs.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})));
  assert.ok(controls.every(b=>b.height>=43.5&&b.width>=43.5),'pagination tap targets >=44px at '+width);
 }
 assert.deepEqual(errors,[],'no uncaught runtime errors');
 console.log('PASS 30/page pagination: all Warsaw records, filtering, sorting, map preservation and 320/375/390px QA');
}finally{
 if(browser)await browser.close();
 if(server)server.kill('SIGTERM');
}
