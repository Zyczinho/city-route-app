// Browser acceptance: deep-link to a public place must open the exact City Route place.
// No billable APIs or credentials; catalogue fallback is used when Supabase is unavailable.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const PORT=4187,BASE='http://127.0.0.1:'+PORT;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server,browser;
try{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let ready=false;
 for(let i=0;i<90;i++){
  try{const r=await fetch(BASE+'/index.html');if(r.ok){ready=true;break;}}catch{}
  await pause(150);
 }
 assert.ok(ready,'static preview server must start');
 await mkdir('p0-smoke-artifacts',{recursive:true});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await context.route(/supabase\.co/,route=>route.abort());
 await context.addInitScript(()=>{
  Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
  const own={id:'u-share-private',cityId:'warsaw',name:'Mój tajny punkt',kind:'user',visibility:'private',
   cats:['okolice'],categoryId:'hidden_gem',area:'Prywatne',description:'Not public',
   lat:52.2300,lng:21.0100,ratings:[],images:[],minutes:15,cost:0};
  localStorage.setItem('city-route-v1',JSON.stringify({
   version:1,tester:{id:'place-share-browser',nickname:'Tester'},basket:[],basketsByCity:{warsaw:[],lisbon:[]},
   events:[],session:null,cityId:'lisbon',userPlaces:[own],myRoutes:[],placeReviews:{}
  }));
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'/?shareCity=warsaw#places/old-town',{waitUntil:'domcontentloaded'});
 await page.locator('#place-dialog[open] #sheet-title').waitFor({timeout:20000});
 assert.equal(await page.locator('#city-select').inputValue(),'warsaw','shared Warsaw place must select Warsaw, despite stored Lisbon');
 assert.equal(await page.locator('#place-dialog [data-place-share]').getAttribute('data-place-share'),'old-town');
 assert.equal(await page.locator('#place-dialog [data-place-share]').isDisabled(),false);
 const color=await page.locator('#place-dialog [data-place-share]').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(color,'rgb(109, 40, 217)','share place CTA must use City Route plum purple');
 await page.locator('#place-dialog [data-place-share]').click();
 await page.locator('dialog.route-share-dialog[open]').waitFor({timeout:7000});
 assert.equal(await page.locator('dialog.route-share-dialog h2').textContent(),'Udostępnij miejsce');
 assert.equal(await page.locator('dialog.route-share-dialog input[type="url"]').inputValue(),BASE+'/?shareCity=warsaw#places/old-town');
 const wa=await page.locator('dialog.route-share-dialog a[href^="https://wa.me/"]').getAttribute('href');
 assert.ok(wa.includes(encodeURIComponent(BASE+'/?shareCity=warsaw#places/old-town')),'WhatsApp passes the real City Route URL');
 await page.screenshot({path:'p0-smoke-artifacts/place-share-purple-375.png'});
 await page.goto(BASE+'/?shareCity=lisbon#places/osm-node-10253764125',{waitUntil:'domcontentloaded'});
 await page.locator('#place-dialog[open] #sheet-title').waitFor({timeout:20000});
 assert.equal(await page.locator('#city-select').inputValue(),'lisbon');
 assert.equal(await page.locator('#place-dialog [data-place-share]').getAttribute('data-place-share'),'osm-node-10253764125');
 await page.goto(BASE+'/?shareCity=warsaw#places/u-share-private',{waitUntil:'domcontentloaded'});
 await page.locator('#main .note[role="status"]').waitFor({timeout:20000});
 assert.equal(await page.locator('#place-dialog[open]').count(),0,'no public deep-link for device-only private place');
 await page.goto(BASE+'/#places',{waitUntil:'domcontentloaded'});
 await page.locator('article.place[data-place-id="u-share-private"]').waitFor({timeout:20000});
 await page.locator('article.place[data-place-id="u-share-private"] [data-action="place"]').click();
 assert.equal(await page.locator('#place-dialog [data-place-share]').isDisabled(),false,'a private place with a name and coordinates must be shareable');
 await page.locator('#place-dialog [data-place-share]').click();
 await page.locator('dialog.route-share-dialog[open]').waitFor({timeout:7000});
 const privateLink=await page.locator('dialog.route-share-dialog input[type="url"]').inputValue();
 assert.ok(privateLink.startsWith(BASE+'/?shareCity=warsaw#places/s-'),'private place must use the minimal snapshot link');
 assert.ok(!privateLink.includes('Not public'),'private notes must not be embedded in share URL');
 const recipient=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await recipient.route(/supabase\.co/,route=>route.abort());
 const otherPage=await recipient.newPage();
 const recipientErrors=[];otherPage.on('pageerror',e=>recipientErrors.push(e.message));
 await otherPage.goto(privateLink,{waitUntil:'domcontentloaded'});
 await otherPage.locator('#place-dialog[open] #sheet-title').waitFor({timeout:20000});
 assert.equal(await otherPage.locator('#city-select').inputValue(),'warsaw');
 assert.equal(await otherPage.locator('#place-dialog #sheet-title').textContent(),'Mój tajny punkt');
 assert.equal(await otherPage.locator('#place-dialog [data-action="import-shared-place"]').count(),1);
 assert.equal((await otherPage.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').userPlaces||[])).length,0,'opening a link must not automatically save the place');
 await otherPage.locator('#place-dialog [data-action="import-shared-place"]').click();
 await otherPage.locator('#place-dialog [data-place-share]').waitFor({timeout:7000});
 const imported=await otherPage.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').userPlaces||[]);
 assert.equal(imported.length,1);
 assert.equal(imported[0].visibility,'private','receiving a link must not publish a place');
 assert.equal(imported[0].name,'Mój tajny punkt');
 assert.equal(imported[0].description.includes('Not public'),false,'private note must remain on the original device');
 assert.deepEqual(recipientErrors,[]);
 await otherPage.screenshot({path:'p0-smoke-artifacts/private-place-saved-recipient-375.png'});
 await recipient.close();
 assert.deepEqual(errors,[],'no browser runtime errors: '+JSON.stringify(errors));
 console.log('PASS: public links, private share snapshots, cross-device preview and private import');
 await context.close();
}finally{
 await browser?.close();
 if(server){server.kill('SIGTERM');}
}
