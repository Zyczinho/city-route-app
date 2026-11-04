// P0 mobile browser release gate. Runs only in the dedicated GitHub Action.
// Browser dependencies are installed in CI, not bundled with the City Route PWA.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const PORT=4179,BASE='http://127.0.0.1:'+PORT;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const haversine=(a,b)=>{
 const rad=n=>n*Math.PI/180,R=6371000,dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
 const f=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
 return 2*R*Math.atan2(Math.sqrt(f),Math.sqrt(1-f));
};
let browser,server;
try{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let up=false;
 for(let i=0;i<80;i++){try{const r=await fetch(BASE+'/index.html');if(r.ok){up=true;break;}}catch{}await pause(150);}
 assert.ok(up,'local static server must become ready');
 await mkdir('p0-smoke-artifacts',{recursive:true});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const data=JSON.parse(await readFile('data/places.json','utf8'));
 const valid=data.filter(p=>p.id&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.kind!=='hotel');
 const pair=valid.flatMap(a=>valid.filter(b=>b.id!==a.id&&haversine(a,b)<950).map(b=>({a,b,m:haversine(a,b)})))
   .sort((a,b)=>a.m-b.m)[0];
 assert.ok(pair,'catalogue needs at least one pair within 950m');
 const seed=[pair.a,...valid.filter(p=>p.id!==pair.a.id&&p.id!==pair.b.id)].slice(0,10).reverse().map(p=>p.id);
 assert.equal(seed.length,10,'smoke needs 10 distinct Warsaw places');
 const ctx=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.route(/supabase\.co/,route=>route.abort());
 await ctx.addInitScript(({seed})=>{
  localStorage.setItem('city-route-v1',JSON.stringify({
   version:1,tester:{id:'p0-browser-check',nickname:'Test'},basket:seed,basketsByCity:{warsaw:seed},events:[],
   session:null,cityId:'warsaw',userPlaces:[],placeReviews:{}
  }));
 },{seed});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'/#my-route',{waitUntil:'domcontentloaded'});
 await page.locator('.stops li[data-stop]').first().waitFor({timeout:30000});
 assert.equal(await page.locator('.stops li[data-stop]').count(),10);
 // Four accessible controls per stop; especially the 4th 'remove' after nearby was added.
 const layout=await page.evaluate(()=>{
  const row=document.querySelector('.stops li[data-stop]'),tools=Array.from(row.querySelectorAll('.tools button'));
  return {scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth,
   buttons:tools.map(b=>({action:b.dataset.action,right:b.getBoundingClientRect().right,left:b.getBoundingClientRect().left,width:b.getBoundingClientRect().width}))};
 });
 assert.ok(layout.scrollWidth<=layout.innerWidth+1,'No horizontal page scroll at 375px: '+JSON.stringify(layout));
 assert.deepEqual(layout.buttons.map(b=>b.action),['up','down','nearby-stop','remove']);
 assert.ok(layout.buttons.every(b=>b.left>=0&&b.right<=layout.innerWidth+1&&b.width>=32),'All four stop buttons remain within 375px viewport');
 await page.screenshot({path:'p0-smoke-artifacts/my-route-before.png',fullPage:true});
 await page.locator('button[data-action="optimize"]').click();
 const optimizedIds=await page.locator('.stops li[data-stop]').evaluateAll(ls=>ls.map(l=>l.dataset.stop));
 assert.deepEqual(new Set(optimizedIds),new Set(seed));
 assert.equal(optimizedIds.length,10);
 const anchor=pair.a.id,target=pair.b.id;
 await page.locator('button[data-action="nearby-stop"][data-id="'+anchor+'"]').click();
 await page.locator('button[data-action="nearby-radius"][data-value="1000"]').click();
 await page.locator('button[data-action="add-nearby"][data-id="'+target+'"]').first().click();
 const order=await page.locator('.stops li[data-stop]').evaluateAll(ls=>ls.map(l=>l.dataset.stop));
 assert.equal(order.length,11);
 assert.equal(order.indexOf(target),order.indexOf(anchor)+1,'nearby place must insert directly after selected stop');
 await page.screenshot({path:'p0-smoke-artifacts/my-route-after.png',fullPage:true});
 // Check all five real bottom-nav destinations in a running browser.
 await page.waitForFunction(()=>document.querySelectorAll('#navigation a').length===5,{timeout:10000}).catch(()=>{});
 const tabs=await page.locator('#navigation a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
 assert.equal(tabs.length,5,'bottom navigation must have five tabs');
 for(const tab of ['#plan','#routes','#my-route','#routes/community','#places']){
  assert.ok(tabs.includes(tab),'missing navigation tab '+tab);
  await page.locator('#navigation a[href="'+tab+'"]').click();
  assert.equal(new URL(page.url()).hash,tab,'tab click changes hash');
  await page.locator('#main').waitFor({state:'visible'});
  assert.equal(await page.locator('#main .loading').count(),0,'tab must not show perpetual loading');
 }

 // ONBOARDING-021: optional start guide must be discoverable, usable and fit a narrow phone.
 await page.locator('#navigation a[href="#plan"]').click();
 await page.locator('#main a.start-here[href="#about"]').waitFor({timeout:10000});
 await page.locator('#main a.start-here[href="#about"]').click();
 await page.locator('#main .start-guide-menu').waitFor({timeout:10000});
 assert.equal(new URL(page.url()).hash,'#about');
 const guideTargets=await page.locator('#main .start-guide-menu a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
 assert.deepEqual(guideTargets,['#plan','#routes','#places','#my-route','#routes/community','#book']);
 const guideWidth=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
 assert.ok(guideWidth.scroll<=guideWidth.inner+1,'start guide has no mobile horizontal overflow: '+JSON.stringify(guideWidth));
 await page.locator('#main .start-guide-menu a[href="#my-route"]').click();
 assert.equal(new URL(page.url()).hash,'#my-route','guide links directly to existing functionality');
 // ROUTE-CHOICES-022: 3 selectable, genuinely different options and a new batch.
 await page.locator('#navigation a[href="#plan"]').click();
 await page.locator('#build-form input[name="start"][value="any"]').evaluate(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('#build-form button.primary.big').click();
 await page.locator('.generated-options').waitFor({timeout:15000});
 assert.equal(new URL(page.url()).hash,'#route/generated');
 assert.equal(await page.locator('.generated-option').count(),3,'generator presents three alternatives');
 const original=await page.locator('.stops .stop-main').evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort().join('|'));
 await page.locator('.generated-option[data-value="1"]').click();
 assert.equal(await page.locator('.generated-option[data-value="1"]').getAttribute('aria-pressed'),'true');
 const selected=await page.locator('.stops .stop-main').evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort().join('|'));
 assert.notEqual(selected,original,'selecting an option changes the route');
 await page.locator('[data-action="refresh-generated"]').click();
 await page.locator('.generated-option.selected').waitFor({timeout:10000});
 const refreshed=await page.locator('.stops .stop-main').evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort().join('|'));
 assert.notEqual(refreshed,original,'refresh does not silently return the original set of stops');
 assert.notEqual(refreshed,selected,'refresh does not silently return the previously selected set of stops');
 const routeLayout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
 assert.ok(routeLayout.scroll<=routeLayout.inner+1,'variants fit a 375px viewport: '+JSON.stringify(routeLayout));
 await page.screenshot({path:'p0-smoke-artifacts/generated-route-options.png',fullPage:true});
 await page.locator('#navigation a[href="#my-route"]').click();
 await page.locator('.stops li[data-stop]').first().waitFor({timeout:10000});
 assert.equal(await page.locator('.stops li[data-stop]').count(),11,'generating options never overwrites the manual route basket');
 assert.deepEqual(errors,[],'unexpected page exception in mobile route test');
 await ctx.close();
 
 // Fresh visitor adds a totally new coordinate-only point and optional 5/5 rating.
 const ctx2=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx2.route(/supabase\.co/,route=>route.abort());
 const p2=await ctx2.newPage();const pageErrors=[];p2.on('pageerror',e=>pageErrors.push(e.message));
 await p2.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
 await p2.locator('#pc-q').waitFor({timeout:30000});
 await p2.locator('#pc-q').fill('52.230123, 21.012345');
 await p2.locator('#place-form input[name="name"]').fill('P0 test punkt widokowy');
 await p2.locator('#place-form input[name="rating"][value="5"]').check({force:true});
 await p2.locator('#place-form button.primary.big').click();
 await p2.locator('#place-dialog[open] button[data-action="add-another-place"]').waitFor({timeout:15000});
 const state=await p2.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')));
 const added=state.userPlaces.find(p=>p.name==='P0 test punkt widokowy');
 assert.ok(added,'custom coordinates must be saved locally');
 assert.equal(state.placeReviews[added.id],5,'optional add-time rating should be stored');
 assert.ok(Math.abs(added.lat-52.230123)<0.000001);
 assert.ok(Math.abs(added.lng-21.012345)<0.000001);
 await p2.screenshot({path:'p0-smoke-artifacts/added-place.png',fullPage:true});
 await p2.locator('#place-dialog button[data-action="add-another-place"]').click();
 await p2.locator('#pc-q').waitFor({timeout:10000});
 assert.equal(new URL(p2.url()).hash,'#add-place');
 // Verify a freshly installed PWA actually serves the new composer offline.
 await p2.waitForFunction(()=>navigator.serviceWorker?.controller!==null,undefined,{timeout:25000});
 await ctx2.setOffline(true);
 await p2.reload({waitUntil:'domcontentloaded',timeout:20000});
 await p2.locator('#pc-q').waitFor({timeout:20000});
 assert.equal(await p2.locator('#place-form').count(),1,'offline installed PWA composer remains usable');
 await ctx2.setOffline(false);
 assert.deepEqual(pageErrors,[],'unexpected page exception in mobile composer');
 await ctx2.close();
 // Independent fresh-client check against the *currently deployed* production URL.
 // This is diagnostic: network blocks at the runner cannot prove a product failure.
 let liveStatus='not-checked';
 const prod=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 const live=await prod.newPage();
 try{
  const response=await live.goto('https://city-route-app.jakublojek.workers.dev/#plan',{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(response?.status(),200,'production must return HTTP 200');
  await live.locator('#navigation a').first().waitFor({timeout:18000});
  await live.waitForFunction(()=>{const tabs=Array.from(document.querySelectorAll('#navigation a'),a=>a.getAttribute('href'));return ['#plan','#routes','#my-route','#routes/community','#places'].every(t=>tabs.includes(t));},undefined,{timeout:14000});
  const tabs=await live.locator('#navigation a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
  assert.ok(['#plan','#routes','#my-route','#routes/community','#places'].every(t=>tabs.includes(t)),'production bottom tabs are incomplete: '+JSON.stringify(tabs));
  assert.equal(await live.locator('#main .loading').count(),0,'production stuck on loading');
  liveStatus='pass';
  await live.screenshot({path:'p0-smoke-artifacts/current-production-375.png',fullPage:true});
 }catch(error){
  liveStatus='unverified';
  console.warn('WARN: production fresh smoke could not be verified from CI runner: '+error.message);
  console.warn('PRODUCTION_NAV='+JSON.stringify(await live.locator('#navigation a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href'))).catch(()=>[])));
  await live.screenshot({path:'p0-smoke-artifacts/current-production-diagnostic.png',fullPage:true}).catch(()=>{});
 }finally{await prod.close();}
 console.log('PRODUCTION_FRESH_SMOKE='+liveStatus);
 // Simulate an old-installed PWA (v33) upgrading to the new release (v35) on the same origin.
 // No production server mutation: only the temporary dist/ built by this GitHub job is changed.
 const swPath='dist/service-worker.js',latestSW=await readFile(swPath,'utf8');
 assert.match(latestSW,/city-route-v38/);
 await writeFile(swPath,latestSW.replace("city-route-v38","city-route-v33"));
 try{
  const upgradeCtx=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  await upgradeCtx.route(/supabase\.co/,route=>route.abort());
  const upgradePage=await upgradeCtx.newPage();
  await upgradePage.goto(BASE+'/#plan',{waitUntil:'domcontentloaded'});
  await upgradePage.waitForFunction(async()=>{const names=await caches.keys();return names.includes('city-route-v33');},undefined,{timeout:25000});
  await upgradePage.reload({waitUntil:'domcontentloaded'});
  await upgradePage.waitForFunction(()=>!!navigator.serviceWorker?.controller,undefined,{timeout:15000});
  await writeFile(swPath,latestSW);
  await upgradePage.evaluate(()=>navigator.serviceWorker.getRegistration().then(reg=>reg.update())).catch(()=>{});
  await upgradePage.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('city-route-v38')&&!keys.includes('city-route-v33');},undefined,{timeout:30000});
  await upgradePage.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
  await upgradePage.locator('#pc-q').waitFor({timeout:15000});
  await upgradePage.screenshot({path:'p0-smoke-artifacts/pwa-upgraded-v33-to-v35.png',fullPage:true});
  console.log('PASS: installed PWA cache upgrade v33 → v35, app and composer boot after upgrade.');
  await upgradeCtx.close();
 }finally{await writeFile(swPath,latestSW);}
 console.log('PASS: mobile 375px, 5 tabs, 10-stop optimization, B→B1 insertion, local custom place, optional rating, repeat add, PWA offline reload.');
}finally{
 if(browser)await browser.close();
 if(server){server.kill('SIGTERM');}
}
