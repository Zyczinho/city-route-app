// Integrations preview smoke: real 375px browser actions, no provider credentials or production writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const PORT=4184,ROOT='http://127.0.0.1:'+PORT;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server,browser;
try{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let ready=false;
 for(let n=0;n<70;n++){try{if((await fetch(ROOT+'/index.html')).ok){ready=true;break;}}catch{}await sleep(160);}
 assert.ok(ready,'local server starts');
 const places=JSON.parse(await readFile('data/places.json','utf8'));
 const first=places.find(x=>x.id==='old-town');
 const second=places.find(x=>x.id==='castle');
 assert.ok(first&&second,'Warsaw route seed');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,acceptDownloads:true});
 await context.route(/supabase\.co/,route=>route.abort());
 await context.route(/\/api\/provider-status/,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',providers:{google:{photos:'no-key',ratings:'no-key'},tripadvisor:{content:'no-key',terra:'no-key'}}})}));
 await context.route(/\/api\/place-thumb/,route=>route.fulfill({status:404,headers:{'x-thumb-status':'no-key'},body:''}));
 await context.route(/commons\.wikimedia\.org/,route=>route.abort());

 await context.addInitScript(({a,b})=>{
  // Seed once: re-seeding during reload would destroy the archived route under test.
  if(localStorage.getItem('city-route-v1'))return;
  localStorage.setItem('city-route-first-launch-v1','1');
  localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'integration-browser',nickname:'Tester'},
   basket:[a,b],basketsByCity:{warsaw:[a,b]},events:[],session:null,cityId:'warsaw',
   userPlaces:[],savedPlacesByCity:{warsaw:[]},myRoutes:[],placeReviews:{}}));
 },{a:first.id,b:second.id});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(ROOT+'/#my-route',{waitUntil:'domcontentloaded'});
 await page.locator('.variant-d-more > summary').click();
 const exportBtn=page.locator('button[data-action="export-gpx"][data-id="basket"]');
 await exportBtn.waitFor({state:'visible',timeout:30000});
 const downloadPromise=page.waitForEvent('download',{timeout:12000});
 await exportBtn.click();
 const dl=await downloadPromise;
 assert.match(dl.suggestedFilename(),/^cityroute-.*\.gpx$/);
 const xml=await readFile(await dl.path(),'utf8');
 assert.ok(xml.includes('<rtept lat="'+first.lat.toFixed(6)+'"'),'export contains first stop');
 assert.ok(xml.includes('<rtept lat="'+second.lat.toFixed(6)+'"'),'export contains second stop');
 assert.ok(!xml.includes('<trkpt'),'no falsified actual GPS recording');

 await page.locator('button[data-route-share="maps"]').click();
 const modal=page.locator('dialog.route-share-dialog');
 await modal.waitFor({state:'visible'});
 const shareUrl=await modal.locator('input[type="url"]').inputValue();
 const modalStyle=await modal.evaluate(el=>({
  blue:getComputedStyle(el.querySelector('.route-share-emblem')).backgroundColor,
  grid:getComputedStyle(el.querySelector('.route-share-choices')).display,
  icons:el.querySelectorAll('.route-share-choices .i').length,
  rawHidden:!el.querySelector('.route-share-raw').open,
  title:el.querySelector('.route-share-preview span:not(.i)')?.textContent
 }));
 assert.equal(modalStyle.blue,'rgb(109, 40, 217)','modal uses founder-approved purple for community sharing');
 assert.equal(modalStyle.grid,'grid','sharing options use a mobile responsive grid');
 assert.ok(modalStyle.icons>=4,'all destinations have local Lucide icons');
 assert.ok(modalStyle.rawHidden,'long technical URL stays collapsed by default');

 assert.match(shareUrl,/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
 for(const label of ['WhatsApp','Instagram','Messenger','Kopiuj link']){
  assert.ok(await modal.getByText(label,{exact:false}).count()>0,'visible share option: '+label);
 }
 await modal.locator('button[type="submit"]').click();
 // Regression: share action must remain present after switching any transport,
 // including transit and mix (previously deliberately hidden).
 for(const [transport,travelmode] of [['walking','walking'],['bike','bicycling'],['transit','transit'],['mix','walking']]){
  await page.locator('#builder-transport').selectOption(transport);
  const trigger=page.locator('#main .detail-actions .route-share-trigger[data-route-share="maps"]');
  await trigger.waitFor({state:'visible',timeout:10000});
  const visuals=await trigger.evaluate(el=>({
   label:el.textContent.trim(),background:getComputedStyle(el).backgroundColor,
   border:getComputedStyle(el).borderColor,hasIcon:!!el.querySelector('.i'),
   height:el.getBoundingClientRect().height
  }));
  assert.equal(visuals.label,'Udostępnij trasę');
  assert.equal(visuals.background,'rgb(109, 40, 217)','CityRoute share trigger retains purple across transport modes');
  assert.ok(visuals.hasIcon,'local Lucide send icon accompanies CTA');
  assert.ok(visuals.height>=44,'share CTA is accessible on mobile');
  await trigger.click();
  const sharing=page.locator('dialog.route-share-dialog');
  await sharing.waitFor({state:'visible'});
  const link=await sharing.locator('input[type="url"]').inputValue();
  const parsed=new URL(link);
  assert.equal(parsed.searchParams.get('travelmode'),travelmode);
  assert.equal(parsed.hostname,'www.google.com');
  await sharing.locator('button[type="submit"]').click();
 }
 // Published editorial cards must expose their genuine CityRoute /r/ links.
 await page.evaluate(()=>{location.hash='#route/old-warsaw';});
 const editorial=page.locator('#main .detail-actions .route-share-trigger[data-route-share="editorial"]');
 await editorial.waitFor({state:'visible',timeout:12000});
 assert.ok(await editorial.locator('.i').count()>0,'editorial share uses a Lucide icon');
 await editorial.click();
 const publicModal=page.locator('dialog.route-share-dialog');
 await publicModal.waitFor({state:'visible'});
 assert.match(await publicModal.locator('input[type="url"]').inputValue(),/\/r\/editorial\/warsaw\/old-warsaw$/);
 await publicModal.locator('button[type="submit"]').click();

 // Named saved-route archive: no login required for local, device-scoped archive.
 await page.goto(ROOT+'/#my-route',{waitUntil:'domcontentloaded'});
 await page.locator('#builder-name').fill('Spacer po Warszawie');
 await page.locator('button[data-action="save-basket"]').click();
 const saveModal=page.locator('#route-save-dialog');
 await saveModal.waitFor({state:'visible'});
 await saveModal.locator('#route-save-name').fill('Moje ulubione zakątki');
 await saveModal.locator('#route-save-description').fill('Spacer na spokojny wieczór');
 await saveModal.locator('button[type="submit"]').click();
 await page.waitForFunction(()=>{
  const saved=JSON.parse(localStorage.getItem('city-route-v1')||'{}').myRoutes||[];
  return saved.some(r=>r.name==='Moje ulubione zakątki');
 },{timeout:12000});
 const savedId=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).myRoutes.find(r=>r.name==='Moje ulubione zakątki').id);
 await page.goto(ROOT+'/#collections',{waitUntil:'domcontentloaded'});
 await page.locator('.variant-d-owned-list a[href="#route/'+savedId+'"]').click();
 await page.locator('button[data-action="rename-route"]').click();
 await saveModal.locator('#route-save-name').fill('Wieczorna Warszawa');
 await saveModal.locator('button[type="submit"]').click();
 await page.goto(ROOT+'/#collections',{waitUntil:'domcontentloaded'});
 assert.ok(await page.locator('#main').getByText('Wieczorna Warszawa').count()>0,'renamed route appears in Profile collections');
 await page.goto(ROOT+'/#collections',{waitUntil:'domcontentloaded'});
 await page.locator('.variant-d-owned-list a[href="#route/'+savedId+'"]').click();
 await page.locator('button[data-action="archive-route"]').click();
 await page.goto(ROOT+'/#collections',{waitUntil:'domcontentloaded'});
 const arch=page.locator('.route-archive');
 await arch.waitFor({state:'attached'});
 await arch.locator('summary').click();
 assert.ok(await arch.getByText('Wieczorna Warszawa').count()>0,'archived route is accessible');
 await arch.locator('button[data-action="unarchive-route"]').click();
 await page.reload({waitUntil:'domcontentloaded'});
 const stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('city-route-v1')).myRoutes.find(r=>r.id===id),savedId);
 assert.equal(stored.name,'Wieczorna Warszawa');
 assert.equal(stored.description,'Spacer na spokojny wieczór');
 assert.equal(stored.archivedAt,null,'restored route remains in saved collection after reload');
 assert.equal(stored.stops.length,2,'archived route preserves the two ordered stops');

 await page.goto(ROOT+'/#profile',{waitUntil:'domcontentloaded'});
 const details=page.locator('.profile-integrations');
 await details.locator('summary').click();
 const importer=details.locator('input[data-action="google-saved-import"]');
 await importer.waitFor({state:'attached'});
 const csv='Title,Note,item_content_url\n'+
   '"'+first.name+'","from my saved list","https://www.google.com/maps/place/old-town"\n'+
   '"Kawiarnia integracyjna","my private coffee","https://www.google.com/maps?q=52.235,21.025"\n'+
   '"Unmatched without coordinates","","https://www.google.com/maps/place/no-location"\n';
 await importer.setInputFiles({name:'Saved.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')});
 await page.waitForFunction(()=>{
  const s=JSON.parse(localStorage.getItem('city-route-v1')||'{}');
  return s.userPlaces?.some(x=>x.name==='Kawiarnia integracyjna');
 },{timeout:20000});
 const finalState=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')));
 const own=finalState.userPlaces.filter(x=>x.name==='Kawiarnia integracyjna');
 assert.equal(own.length,1);
 assert.equal(own[0].visibility,'private');
 assert.equal(own[0].cityId,'warsaw');
 assert.ok(finalState.savedPlacesByCity.warsaw.includes(first.id),'catalogue place saved');
 assert.ok(finalState.savedPlacesByCity.warsaw.includes(own[0].id),'private place saved locally');
 assert.ok(finalState.events.some(x=>x.type==='google_saved_import'&&x.unresolved===1),'unmatched disclosed');
 await page.goto(ROOT+'/#places',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.querySelector('[data-provider-health]:not([hidden])'),{timeout:15000});
 const providerText=await page.locator('[data-provider-health]').textContent();
 assert.match(providerText,/Zdjęcia Google.*brak aktywnego dostępu/);
 assert.match(providerText,/Oceny Google.*nieaktywna/);
 const listingText=await page.locator('.place-list').textContent();
 assert.ok(!listingText.includes('esc(providerMessage(p))'),'raw template source must never appear in ratings');
 assert.equal(await page.locator('.place-list img[data-thumb-for]').count(),0,'disabled Google does not start doomed thumbnail network requests');

 const importedRow=page.locator('.place-list article.place').filter({hasText:'Kawiarnia integracyjna'});
 await importedRow.waitFor({state:'visible',timeout:15000});
 await importedRow.locator('[data-commons-photo]').waitFor({state:'attached',timeout:15000});
 assert.ok(await importedRow.locator('[data-commons-name]').count()>0,'failed Google thumbnail preserves exact Commons fallback metadata');
 const bounds=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
 assert.ok(bounds.scrollWidth<=bounds.width+1,'375px profile has no horizontal overflow: '+JSON.stringify(bounds));
 assert.deepEqual(errors,[],'no uncaught browser errors: '+errors.join('; '));
 console.log('PASS integrations browser: GPX, share across transport, named save/rename/archive/restore, ratings template, disabled thumbnail and Takeout CSV');
}finally{
 if(browser)await browser.close();
 if(server)server.kill('SIGTERM');
}
