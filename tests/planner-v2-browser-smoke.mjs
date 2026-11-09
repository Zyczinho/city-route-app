import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

async function runPlannerBrowserSmoke(){
 const PORT=4193,BASE='http://127.0.0.1:'+PORT;
 const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let browser=null;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch(BASE+'/');if(r.ok){ready=true;break;}}catch{}await pause(150);}
  assert.ok(ready,'static server must start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await ctx.route(/supabase\.co/,route=>route.abort());
  await ctx.addInitScript(()=>localStorage.setItem('city-route-first-launch-v1','1'));
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/#plan',{waitUntil:'domcontentloaded'});
  await page.locator('#build-form').waitFor({timeout:30000});
  await page.locator('input[name="start"][value="any"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('input[name="time"][value="240"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#build-form button.primary.big').click();
  await page.waitForURL(/#route\/generated$/,{timeout:30000});
  await page.locator('.generated-option').first().waitFor({timeout:30000});
  assert.ok(await page.locator('.generated-option').count()>=2,'V2 provides alternative routes');
  const text=await page.locator('#main').innerText();
  assert.match(text,/Planner V2/,'new engine is actually selected');
  assert.match(text,/Łącznie około/,'full duration appears in the itinerary');
  assert.match(text,/przerwy|odpoczynek/,'rest budget is visible');
  assert.match(text,/Czasy przemieszczania są orientacyjne/,'geodesic estimate is disclosed');
  const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(layout.scrollWidth<=layout.width+1,'mobile route must not overflow '+JSON.stringify(layout));
  await page.locator('.generated-option').nth(1).click();
  assert.equal(await page.locator('.generated-option.selected').count(),1,'choosing a variant updates selection');
  await page.locator('button[data-action="refresh-generated"]').click();
  assert.ok(await page.locator('.generated-option').count()>=1,'reroll should provide at least one new route');
  await page.locator('button[data-action="save-generated"]').click();
  // Integrated #154 intentionally asks for a route name before persisting it.
  await page.locator('#route-save-dialog[open]').waitFor({timeout:10000});
  await page.locator('#route-save-form .route-save-submit').click();
  await page.waitForURL(/#routes$/,{timeout:10000});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').myRoutes||[]);
  assert.ok(saved.some(route=>route.id.startsWith('mine-')&&route.stops.length>=2),'named generated route was really persisted');
  await page.goto(BASE+'/#plan',{waitUntil:'domcontentloaded'});
  await page.locator('#build-form').waitFor({timeout:10000});
  await page.locator('input[name="start"][value="any"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('input[name="time"][value="240"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('input[name="transport"][value="transit"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#build-form button.primary.big').click();
  await page.waitForURL(/#route\/generated$/,{timeout:30000});
  await page.locator('summary').filter({hasText:'Komunikacja miejska — sprawdź odcinki'}).waitFor({timeout:10000});
  const routes=await page.locator('details[aria-label="Komunikacja miejska etapami"] a[href*="travelmode=transit"]').count();
  assert.ok(routes>=1,'transit navigation has independently routable A→B legs');
  assert.deepEqual(errors,[],'no browser uncaught errors');
  console.log('PLANNER_V2_BROWSER_QA '+JSON.stringify({alternatives:true,fullBudget:true,reroll:true,saved:true,transitLegs:routes,mobile375:true}));
 }finally{
  await browser?.close();server.kill('SIGTERM');
 }
}
await runPlannerBrowserSmoke();
