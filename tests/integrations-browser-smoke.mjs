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
 await page.mouse.move(0,0);
 const manualStyle=await page.locator('.variant-d-route-actions').evaluate(async el=>{
  const buttons=[...el.children].filter(n=>n.matches('button,a'));
  await Promise.all(buttons.flatMap(n=>n.getAnimations().map(a=>a.finished)));
  return {labels:buttons.map(n=>n.textContent.trim()),colors:buttons.map(n=>getComputedStyle(n).backgroundColor)};
 });
 const manualActions=manualStyle.labels;
 assert.deepEqual(manualActions,['Rozpocznij trasę','Zapisz trasę','Udostępnij trasę'],'manual action order');
 const publish=page.locator('.variant-d-extra-actions [data-social-publish-button]');
 await publish.waitFor({state:'attached',timeout:15000});
 assert.equal(await publish.isVisible(),false,'Publish stays inside collapsed More options');
 await page.locator('.variant-d-more > summary').click();
 assert.equal(await publish.isVisible(),true,'Publish remains available inside More options');
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
 const brands=await modal.evaluate(el=>Object.fromEntries(['whatsapp','messenger','instagram','copy'].map(name=>{const s=getComputedStyle(el.querySelector('.route-share-'+name));return [name,{background:s.backgroundColor,image:s.backgroundImage,color:s.color}];})));
 assert.equal(brands.whatsapp.background,'rgb(18, 140, 74)');
 assert.equal(brands.messenger.background,'rgb(8, 102, 255)');
 assert.match(brands.instagram.image,/linear-gradient/);
 assert.equal(brands.copy.background,'rgb(109, 40, 217)');
 assert.equal(await modal.locator('.route-share-native').count(),0,'native route share is deferred');
 await page.screenshot({path:'p0-smoke-artifacts/share-destination-colors.png',fullPage:true});
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
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:812});
  await page.mouse.move(0,0);
  const parity=await page.locator('#main .variant-d-route-actions').evaluate(async el=>{
   const buttons=[...el.children].filter(n=>n.matches('button,a'));
   await Promise.all(buttons.flatMap(n=>n.getAnimations().map(a=>a.finished)));
   const more=el.querySelector('details'),edit=el.querySelector('[data-action="save-route"]');
   return {labels:buttons.map(n=>n.textContent.trim()),colors:buttons.map(n=>getComputedStyle(n).backgroundColor),
    moreOpen:more.open,editInsideMore:edit.closest('details')===more,
    next:el.nextElementSibling?.textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.deepEqual(parity.labels,manualActions,'editorial and manual action order match at '+width);
  assert.deepEqual(parity.colors,manualStyle.colors,'editorial colors match manual Start/Save/Share');
  assert.deepEqual(parity.colors.slice(1),['rgb(10, 102, 194)','rgb(109, 40, 217)'],'Save blue / Share purple');
  assert.equal(parity.moreOpen,false);
  assert.equal(parity.editInsideMore,true,'editorial editing is inside More options');
  assert.equal(await page.locator('[data-action="save-route"]').isVisible(),false,'editorial editing is collapsed initially');
  assert.equal(parity.next,'Dodaj kolejny przystanek');
  assert.equal(parity.overflow,false,'editorial view fits '+width+'px');
  await page.screenshot({path:'p0-smoke-artifacts/editorial-actions-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:375,height:812});
 await page.locator('#main .variant-d-more > summary').click();
 assert.equal(await page.locator('[data-action="save-route"]').isVisible(),true,'editorial editing remains available');
 const editorialExport=page.locator('[data-action="export-gpx"]');
 const editorialDownload=page.waitForEvent('download');
 await editorialExport.click();
 assert.match((await editorialDownload).suggestedFilename(),/^cityroute-.*\.gpx$/);
 await page.locator('#main .variant-d-more > summary').click();

 await editorial.click();
 const publicModal=page.locator('dialog.route-share-dialog');
 await publicModal.waitFor({state:'visible'});
 assert.match(await publicModal.locator('input[type="url"]').inputValue(),/\/r\/editorial\/warsaw\/old-warsaw$/);
 await publicModal.locator('button[type="submit"]').click();
 // Editorial routes can be saved without entering edit mode or signing in.
 await page.locator('button[data-action="save-editorial"][data-id="old-warsaw"]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').myRoutes?.some(r=>r.sourceRouteId==='old-warsaw'),{timeout:12000});
 // Reproduce the founder journey through Profile, not a synthetic direct hash.
 await page.locator('#navigation a[href="#profile"]').click();
 await page.locator('a.variant-d-collections-entry[href="#collections"]').click();
 await page.locator('.variant-d-collection-links a[href="#collections/places"]').waitFor({state:'visible',timeout:12000});
 assert.deepEqual(await page.locator('.variant-d-collection-links > a').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),
  ['#collections/places','#social-saved'],'Profile collections only offers Saved Places and Saved Routes');
 await page.locator('.variant-d-collection-links a[href="#social-saved"]').click();
 const archive=page.locator('[data-social-saved-root]');
 await archive.locator('article.card').filter({hasText:'Redakcja City Route'}).first().waitFor({state:'visible',timeout:12000});
 assert.ok(await archive.locator('[data-saved-routes-cards] article.card').count()>=1,'local archive must render even with Supabase unavailable');
 await page.reload({waitUntil:'domcontentloaded'});
 const editorialSaved=archive.locator('article.card').filter({hasText:'Redakcja City Route'}).first();
 await editorialSaved.waitFor({state:'visible',timeout:12000});
 // Trash is a separate action; removing this copy preserves the original editorial route.
 await editorialSaved.locator('button[data-action="remove-saved-local"]').click();
 await page.waitForFunction(()=>!(JSON.parse(localStorage.getItem('city-route-v1')||'{}').myRoutes||[]).some(r=>r.sourceRouteId==='old-warsaw'),{timeout:12000});
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await archive.locator('button[data-action="remove-saved-local"]').count(),0,'deleted editorial copy does not return after reload');
 await page.goto(ROOT+'/#route/old-warsaw',{waitUntil:'domcontentloaded'});
 await page.locator('button[data-action="save-editorial"][data-id="old-warsaw"]').waitFor({state:'visible',timeout:12000});

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
 await page.goto(ROOT+'/#social-saved',{waitUntil:'domcontentloaded'});
 await page.locator('[data-social-saved-root] a[href="#route/'+savedId+'"]').click();
 await page.locator('#main .variant-d-more > summary').click();
 await page.locator('button[data-action="rename-route"]').click();
 await saveModal.locator('#route-save-name').fill('Wieczorna Warszawa');
 await saveModal.locator('button[type="submit"]').click();
 await page.goto(ROOT+'/#social-saved',{waitUntil:'domcontentloaded'});
 await page.locator('[data-social-saved-root]').getByText('Wieczorna Warszawa').waitFor({state:'visible',timeout:12000}); // async account/local archive render
 await page.locator('[data-social-saved-root] a[href="#route/'+savedId+'"]').click();
 await page.locator('#main .variant-d-more > summary').click();
 await page.locator('button[data-action="archive-route"]').click();
 await page.goto(ROOT+'/#social-saved',{waitUntil:'domcontentloaded'});
 const arch=page.locator('[data-social-saved-root] article.card').filter({hasText:'Wieczorna Warszawa'});
 await arch.waitFor({state:'visible',timeout:12000});
 assert.match(await arch.textContent(),/Archiwum/,'archived route is accessible in the same saved list');
 await arch.locator('a[href="#route/'+savedId+'"]').click();
 await page.locator('#main .variant-d-more > summary').click();
 await page.locator('button[data-action="unarchive-route"]').click();
 await page.reload({waitUntil:'domcontentloaded'});
 const stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('city-route-v1')).myRoutes.find(r=>r.id===id),savedId);
 assert.equal(stored.name,'Wieczorna Warszawa');
 assert.equal(stored.description,'Spacer na spokojny wieczór');
 assert.equal(stored.archivedAt,null,'restored route remains in saved collection after reload');
 assert.equal(stored.stops.length,2,'archived route preserves the two ordered stops');

 // Adding a stop to an editorial route edits a private builder copy, never the source.
 const editorialSource=JSON.parse(await readFile('data/routes.json','utf8')).find(r=>r.id==='old-warsaw');
 await page.goto(ROOT+'/#route/old-warsaw',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="add-route-stop"][data-id="old-warsaw"]').click();
 await page.waitForFunction(()=>location.hash==='#places');
 const copied=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')));
 assert.deepEqual(copied.basket,editorialSource.stops,'add next stop starts from exactly the viewed route');
 assert.equal(copied.builderMetaByCity.warsaw.name,editorialSource.name);
 // The named route created earlier retains its independent stop list.
 assert.equal(copied.myRoutes.find(r=>r.id===savedId).stops.length,2);
 await page.goto(ROOT+'/#route/old-warsaw',{waitUntil:'domcontentloaded'});
 await page.locator('.stops li').first().waitFor({state:'visible',timeout:12000});
 assert.equal(await page.locator('.stops li').count(),editorialSource.stops.length,'original editorial route remains unchanged');

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
 // A newly added stop uses the single contextual route bar, without a duplicate toast.
 await page.locator('#toast').waitFor({state:'hidden',timeout:5000});
 const add=page.locator('.place-list button[data-action="add"]').first();
 await add.waitFor({state:'visible',timeout:12000});
 const addId=await add.getAttribute('data-id');
 await add.click();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('city-route-v1')).basket.includes(id),addId);
 const routeBar=page.locator('#active-route-bar');
 await routeBar.waitFor({state:'visible',timeout:12000});
 const routeColor=await routeBar.evaluate(el=>getComputedStyle(el).backgroundColor);
 const startColor=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());
 assert.equal(routeColor,'rgb(14, 26, 38)','My Route matches the dark Start action');
 assert.equal(startColor,'#0e1a26');
 assert.equal(await page.locator('#toast.show').count(),0,'no redundant added-stop toast');
 assert.equal(await page.locator('[data-toast-my-route]').count(),0,'no duplicate See route link');
 await page.screenshot({path:'p0-smoke-artifacts/dark-contextual-route-bar.png',fullPage:true});

 // An ordinary catalogue place with a licensed cover must still fetch missing ratings.
 const ratingCtx=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await ratingCtx.addInitScript(()=>{
  localStorage.setItem('city-route-first-launch-v1','1');
  localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'rating-qa',nickname:'QA'},cityId:'lisbon',basket:[],basketsByCity:{},events:[],session:null,userPlaces:[],myRoutes:[],savedPlacesByCity:{}}));
 });
 const ratedPlace={id:'qa-lisbon-with-cover',name:'Local com foto',lat:38.70844,lng:-9.13682,category_id:'landmark',
  area:'Baixa',description:'Opis testowy katalogu.',image_url:'place-boulevards.jpg',image_meta:{},metadata:{},ratings:[],tags:[],minutes:20};
 await ratingCtx.route(/supabase\.co/,route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/rpc/catalogue_places'))return route.fulfill({json:[ratedPlace]});
  if(path.endsWith('/rpc/catalogue_routes'))return route.fulfill({json:[{id:'qa-lisbon-route',name:'Trasa testowa',description:'',transport:'walking',stops:[ratedPlace.id],tags:[],metadata:{}}]});
  return route.abort();
 });
 const enrichmentCalls=[];
 const providerStatus={google:{photos:'ready',ratings:'ready'},tripadvisor:{content:'no-key',terra:'no-key'}};
 await ratingCtx.route(/\/api\/provider-status/,route=>route.fulfill({json:{status:'ok',providers:providerStatus}}));
 await ratingCtx.route(/\/api\/place-enrichment/,route=>{
  enrichmentCalls.push(new URL(route.request().url()));
  return route.fulfill({json:{status:'ok',providerStatus,ratings:[{source:'google',value:4.7,max:5,reviewCount:31,url:'https://maps.google.com/?cid=qa',listing:ratedPlace.name}],reviews:[],image:null}});
 });
 await ratingCtx.route(/commons\.wikimedia\.org/,route=>route.abort());
 const ratingPage=await ratingCtx.newPage(),ratingErrors=[];
 ratingPage.on('pageerror',e=>ratingErrors.push(e.message));
 await ratingPage.goto(ROOT+'/#route/qa-lisbon-route',{waitUntil:'domcontentloaded'});
 await ratingPage.locator('.stops .stop-main').waitFor({state:'visible',timeout:15000});
 assert.equal(enrichmentCalls.length,0,'ordinary catalogue ratings are not fetched in background');
 await ratingPage.evaluate(()=>{window.__qaStop=document.querySelector('.stops li');});
 await ratingPage.locator('.stops .stop-main').click();
 await ratingPage.locator('#place-dialog .breakdown a[data-source="google"]').waitFor({state:'visible',timeout:15000});
 assert.equal(enrichmentCalls.length,1,'existing cover does not suppress missing Google ratings');
 assert.equal(enrichmentCalls[0].searchParams.get('country'),'PT','active country reaches Worker');
 assert.equal(await ratingPage.evaluate(()=>window.__qaStop===document.querySelector('.stops li')),true,'provider response preserves route DOM');
 assert.match(await ratingPage.locator('#place-dialog .breakdown').textContent(),/31 opinii/);
 await ratingPage.locator('#place-dialog .close').click();
 await ratingPage.locator('.stops .stop-main').click();
 await ratingPage.locator('#place-dialog .breakdown a[data-source="google"]').waitFor({state:'visible'});
 assert.equal(enrichmentCalls.length,1,'reopening reuses session metadata');
 await ratingPage.reload({waitUntil:'domcontentloaded'});
 await ratingPage.locator('.stops .stop-main').click();
 await ratingPage.locator('#place-dialog .breakdown a[data-source="google"]').waitFor({state:'visible'});
 assert.equal(enrichmentCalls.length,2,'refresh can fetch fresh provider data on demand');
 assert.equal(await ratingPage.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).userPlaces.length),0,'provider data is not persisted as user places');
 assert.deepEqual(ratingErrors,[]);
 await ratingPage.screenshot({path:'p0-smoke-artifacts/catalogue-cover-missing-ratings.png',fullPage:true});
 await ratingCtx.close();
 assert.deepEqual(errors,[],'no uncaught browser errors: '+errors.join('; '));
 console.log('PASS integrations browser: GPX, share across transport, named save/rename/archive/restore, ratings template, disabled thumbnail and Takeout CSV');
}finally{
 if(browser)await browser.close();
 if(server)server.kill('SIGTERM');
}
