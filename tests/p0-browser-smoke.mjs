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
 // Check all six real bottom-nav destinations; leave Places last for the following map check.
 await page.waitForFunction(()=>document.querySelectorAll('#navigation a').length===6,{timeout:10000}).catch(()=>{});
 const tabs=await page.locator('#navigation a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
 assert.equal(tabs.length,6,'bottom navigation must have six tabs including Poradnik');
 for(const tab of ['#plan','#routes','#my-route','#routes/community','#about','#places']){
  assert.ok(tabs.includes(tab),'missing navigation tab '+tab);
  await page.locator('#navigation a[href="'+tab+'"]').click();
  assert.equal(new URL(page.url()).hash,tab,'tab click changes hash');
  await page.locator('#main').waitFor({state:'visible'});
  assert.equal(await page.locator('#main .loading').count(),0,'tab must not show perpetual loading');
 }


 // MAP-SCROLL-037: protect mobile vertical scrolling with a short inset map and an explicit gesture toggle.
 try{
  await page.locator('#places-map.cr-map').waitFor({state:'attached',timeout:12000});
 }catch(error){
  const debug=await page.evaluate(()=>({hash:location.hash,mapHost:!!document.querySelector('#places-map'),map:!!document.querySelector('#places-map.cr-map'),mainText:document.querySelector('#main')?.textContent?.slice(0,250)}));
  throw new Error('Map mount missing in mobile browser: '+JSON.stringify({...debug,errors}),{cause:error});
 }
 const mapLayout=await page.locator('#places-map.cr-map').evaluate(el=>{
  const rect=el.getBoundingClientRect(),canvas=el.querySelector('.cr-map-canvas'),button=el.querySelector('.cr-map-interaction');
  return {left:rect.left,right:rect.right,height:rect.height,viewport:innerWidth,
   touchAction:getComputedStyle(canvas).touchAction,scrollMode:el.classList.contains('is-scroll-mode'),
   panToggle:button?.getAttribute('aria-pressed'),overflow:document.documentElement.scrollWidth};
 });
 assert.ok(mapLayout.left>=16&&mapLayout.right<=mapLayout.viewport-16,'map leaves a finger-scroll corridor at both edges: '+JSON.stringify(mapLayout));
 assert.ok(mapLayout.height>=330&&mapLayout.height<=460,'mobile map does not occupy most of the page: '+JSON.stringify(mapLayout));
 console.log('MAP_SCROLL_QA '+JSON.stringify(mapLayout));
 assert.equal(mapLayout.scrollMode,true,'narrow map defaults to page scroll');
 assert.equal(mapLayout.touchAction,'pan-y','map canvas must allow vertical page touch scrolling');
 assert.equal(mapLayout.panToggle,'false','user must explicitly enable map panning');
 assert.ok(mapLayout.overflow<=mapLayout.viewport+1,'map toolbar does not create horizontal overflow');
 const popup=await page.locator('#places-map .cr-map-card').evaluate(card=>{
  card.hidden=false;
  card.innerHTML='<div class="cr-map-card-head"><h3>Przykładowe miejsce</h3></div><div class="cr-map-card-actions"><button>Do trasy</button><button>Szczegóły</button></div>';
  const box=card.getBoundingClientRect(),map=card.closest('.cr-map').getBoundingClientRect();
  const result={popupHeight:box.height,mapHeight:map.height,top:box.top-map.top,bottom:box.bottom-map.top};
  card.hidden=true;return result;
 });
 assert.ok(popup.popupHeight<=130&&popup.bottom<popup.mapHeight-25,
  'map place popup should remain a short card, preserving visible map and attribution: '+JSON.stringify(popup));
 await page.screenshot({path:'p0-smoke-artifacts/places-mobile-scroll.png',fullPage:true});

 // PLACES-UX-038: own creations remain discoverable after unbookmarking.
 // Use a separate mobile session so the existing route-smoke fixture stays unchanged.
 const placesCtx=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await placesCtx.route(/supabase\\.co/,route=>route.abort());
 await placesCtx.addInitScript(()=>{
  const own={id:'u-spoco-smoke',cityId:'warsaw',name:"S'poco Loco",kind:'user',categoryId:'restaurant',
   cats:['jedzenie'],area:'Twoje miejsce',description:'Dodane przez testera',
   lat:52.2301,lng:21.0131,minutes:45,cost:0,ratings:[],createdAt:'2026-11-04T12:00:00.000Z',
   visibility:'private'};
  localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'places-ux-smoke',nickname:'Test'},
   basket:[],basketsByCity:{warsaw:[]},events:[],session:null,cityId:'warsaw',
   userPlaces:[own],savedPlacesByCity:{warsaw:['u-spoco-smoke']},placeReviews:{},myRoutes:[]}));
 });
 const placesPage=await placesCtx.newPage();
 await placesPage.goto(BASE+'/#places',{waitUntil:'domcontentloaded'});
 await placesPage.locator('article.place[data-place-id="u-spoco-smoke"]').waitFor({timeout:15000});

 const placeMobileLayout=await placesPage.locator('.place-list article.place').evaluateAll(nodes=>nodes.slice(0,8).map(card=>{
  const info=card.querySelector('.info').getBoundingClientRect(),actions=card.querySelector('.side').getBoundingClientRect(),save=card.querySelector('.save-place').getBoundingClientRect();
  const rating=card.querySelector('.srcs')?.getBoundingClientRect(),main=card.getBoundingClientRect();
  return {infoBottom:info.bottom,actionsTop:actions.top,actionsRight:actions.right,ratingsBottom:rating?.bottom,saveWidth:save.width,mainRight:main.right};
 }));
 assert.ok(placeMobileLayout.every(c=>c.actionsTop>=c.infoBottom-1&&(c.ratingsBottom==null||c.actionsTop>=c.ratingsBottom-1)&&c.actionsRight<=375+1&&c.mainRight<=375+1&&c.saveWidth>=84),'place rating/actions are separate on 375px: '+JSON.stringify(placeMobileLayout));
 const createdFirst=await placesPage.locator('.place-list article.place').first().getAttribute('data-place-id');
 assert.equal(createdFirst,'u-spoco-smoke','new place is near the top, not buried at the end');
 assert.equal(await placesPage.locator('[data-request-generic], [data-request-search], [data-request-category]').count(),0,
  'Places should not duplicate the primary add CTA with requests everywhere');
 await placesPage.locator('article.place[data-place-id="u-spoco-smoke"] [data-action="bookmark"]').click();
 const removed=await placesPage.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).savedPlacesByCity.warsaw);
 assert.ok(!removed.includes('u-spoco-smoke'),'unbookmark removes only the bookmark, never the created place');
 await placesPage.locator('#me').click();
 await placesPage.locator('.profile-statistics > summary').click();
 await placesPage.locator('[data-action="show-my-places"]').waitFor();
 await placesPage.locator('[data-action="show-my-places"]').click();
 assert.equal(await placesPage.locator('[data-action="cat"][data-value="mine"]').getAttribute('aria-pressed'),'true');
 await placesPage.locator('article.place[data-place-id="u-spoco-smoke"]').waitFor();
 await placesPage.locator('article.place[data-place-id="u-spoco-smoke"] [data-action="bookmark"]').click();
 await placesPage.locator('#navigation a[href="#routes/community"]').click();
 await placesPage.locator('[data-community-tabs] .community-hub-links a[href="#social-saved-places"]').click();
 await placesPage.locator('[data-community-tabs] [data-saved-switch] a[href="#social-saved-places"]').waitFor();
 await placesPage.locator('[data-community-tabs] [data-saved-switch] a[href="#social-saved-places"]').click();
 await placesPage.locator('h1').getByText('Zapisane miejsca').waitFor();
 assert.equal(await placesPage.locator('[data-community-tabs] .community-hub-links a[href="#social-saved-places"]').getAttribute('aria-current'),'page');
 assert.equal(await placesPage.locator('[data-community-tabs] [data-saved-switch] a[href="#social-saved-places"]').getAttribute('aria-current'),'page');
 // Unauthenticated users can browse locally saved places; routes require account sign-in.
 assert.equal(await placesPage.locator('[data-community-tabs] [data-saved-switch] a[href="#social-saved"]').count(),1,
  'Routes remains a visible second-level choice');
 await placesPage.locator('article.place[data-place-id="u-spoco-smoke"]').waitFor();
 await placesPage.locator('#navigation a[href="#places"]').click();
 await placesPage.locator('#search').fill('poco');
 await placesPage.locator('.place-suggest button[data-id="u-spoco-smoke"]').waitFor();
 await placesPage.locator('.place-suggest button[data-id="u-spoco-smoke"]').click();
 assert.equal(await placesPage.locator('#place-dialog').getAttribute('open'),'');
 await placesPage.locator('#place-dialog .close').click();
 await placesPage.locator('.add-place').click();
 await placesPage.locator('#place-form select[name="cat"]').waitFor();
 assert.equal(await placesPage.locator('input[name="photo_source_url"]').count(),1,'owner can provide a website or official Instagram/Facebook profile for photo research');
 assert.equal(await placesPage.locator('#place-form select[name="cat"] option[value="club"]').count(),1,
  'nightclub must be a selectable real category');
 assert.ok(await placesPage.locator('a[data-request-entry][href="#places/request"]').count()>=1,
  'editorial request is reachable as an alternative in the add-place flow');
 await placesPage.screenshot({path:'p0-smoke-artifacts/add-place-mobile-clean.png',fullPage:true});
 // PRZEMEK-BETA-UX-054: first-time journey search -> missing place -> two photo crop -> save.
 await placesPage.evaluate(()=>{location.hash='#places';});
 await placesPage.locator('#search').waitFor();
 await placesPage.locator('#search').fill('Nieistniejacy Punkt Beta 987654321');
 await placesPage.locator('[data-action="suggest-add-place"]').waitFor({state:'visible',timeout:12000});
 await placesPage.locator('[data-action="suggest-add-place"]').click();
 await placesPage.locator('#place-form input[name="name"]').waitFor();
 assert.equal(await placesPage.locator('#place-form input[name="name"]').inputValue(),'Nieistniejacy Punkt Beta 987654321');
 const samplePng=await placesPage.evaluate(()=>{
  const c=document.createElement('canvas');c.width=320;c.height=240;
  const ctx=c.getContext('2d');ctx.fillStyle='#1978cc';ctx.fillRect(0,0,320,240);
  ctx.fillStyle='#f8f9fc';ctx.fillRect(32,30,100,100);
  return c.toDataURL('image/png').split(',')[1];
 });
 const fileBuffer=Buffer.from(samplePng,'base64');
 await placesPage.locator('#place-form input[name="photo"]').setInputFiles([
  {name:'pierwsze.png',mimeType:'image/png',buffer:fileBuffer},
  {name:'drugie.png',mimeType:'image/png',buffer:fileBuffer}
 ]);
 await placesPage.locator('.place-photo-item').first().waitFor();
 assert.equal(await placesPage.locator('.place-photo-item').count(),2);
 assert.equal(await placesPage.locator('[data-photo-rights]').isVisible(),false,'rights must not be prechecked or shown for private notes');
 await placesPage.locator('[data-photo-crop="ratio"]').selectOption('1:1');
 await placesPage.locator('[data-action="edit-place-photo"]').nth(1).click();
 await placesPage.locator('[data-action="cover-place-photo"]').click();
 assert.ok(await placesPage.locator('.place-photo-item').first().textContent().then(s=>s.includes('Główne')));
 await placesPage.locator('#place-form input[name="vis"][value="public"]').evaluate(input=>input.click());
 assert.equal(await placesPage.locator('#place-form input[name="vis"][value="public"]').isChecked(),true);
 assert.equal(await placesPage.locator('[data-photo-rights]').isVisible(),true);
 assert.equal(await placesPage.locator('input[name="image_rights"]').isChecked(),false);
 await placesPage.locator('#place-form input[name="vis"][value="private"]').evaluate(input=>input.click());
 assert.equal(await placesPage.locator('#place-form input[name="vis"][value="private"]').isChecked(),true);
 await placesPage.locator('#place-form input[name="where"]').evaluate(el=>{el.value='52.2322, 21.0111';});
 await placesPage.locator('#place-form button.primary.big').click();
 await placesPage.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('city-route-v1')||'null');return s?.userPlaces?.some(p=>p.name==='Nieistniejacy Punkt Beta 987654321')},{timeout:15000});
 const savedGallery=await placesPage.evaluate(()=>{
  const p=JSON.parse(localStorage.getItem('city-route-v1')).userPlaces.find(p=>p.name==='Nieistniejacy Punkt Beta 987654321');
  return {count:p.images?.length,source:p.image?.startsWith('data:image/jpeg;base64,'),rights:p.imageRightsConfirmed,visibility:p.visibility};
 });
 assert.deepEqual(savedGallery,{count:2,source:true,rights:false,visibility:'private'});
 await placesPage.screenshot({path:'p0-smoke-artifacts/place-gallery-first-visit.png',fullPage:true});
 await placesCtx.close();

 // COMMUNITY-DETAIL-FREEZE-044: a real mobile route detail must paint and remain interactive.
 // The server RPCs resolve successfully; a redundant textContent assignment in the
 // UX MutationObserver previously created an endless microtask loop after response.
 const detailCtx=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const testRouteId='11111111-2222-4333-8444-555555555555';
 await detailCtx.route(/supabase\.co/,async route=>{
  const path=new URL(route.request().url()).pathname;
  const data=path.endsWith('/rpc/community_route')?[{
   id:testRouteId,city_slug:'krakow',name:'Kraków — test trasy',description:'Trasa testowa',
   author_id:'11111111-2222-4333-8444-666666666666',author_nickname:'Tester',
   visibility:'public',status:'published',transport:'walking',
   stops:['krakow-smoke-a','krakow-smoke-b'],stop_count:2,save_count:1,rating_count:0,fork_count:0
  }]:path.endsWith('/rpc/catalogue_places')?[
   {id:'krakow-smoke-a',name:'Rynek Główny',image_url:null},
   {id:'krakow-smoke-b',name:'Planty',image_url:null}
  ]:null;
  if(data){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});return;}
  await route.abort();
 });
 await detailCtx.addInitScript(()=>localStorage.setItem('city-route-v1',JSON.stringify({
  version:1,tester:{id:'route-detail-smoke',nickname:'Test'},basket:[],basketsByCity:{krakow:[]},
  events:[],session:null,cityId:'krakow',userPlaces:[],placeReviews:{}
 })));
 const detailPage=await detailCtx.newPage();
 await detailPage.goto(BASE+'/#community-route/'+testRouteId,{waitUntil:'domcontentloaded'});
 await detailPage.locator('[data-social-route-root="'+testRouteId+'"] .social-stops li').first().waitFor({timeout:20000});
 assert.equal(await detailPage.locator('.social-stops li').count(),2,'detail shows published route stops');
 assert.equal(await detailPage.locator('.social-detail h1').textContent(),'Kraków — test trasy');
 assert.equal(await detailPage.locator('.social-detail .back').textContent(),'Społeczność');
 assert.equal(await detailPage.locator('.social-detail .back').getAttribute('href'),'#routes/community');
 const alive=await detailPage.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve('responsive'),100)));
 assert.equal(alive,'responsive','browser event loop must not be starved by a recursive MutationObserver');
 await detailPage.locator('.social-detail .back').click();
 assert.equal(new URL(detailPage.url()).hash,'#routes/community');
 await detailPage.goto(BASE+'/#community-route/'+testRouteId,{waitUntil:'domcontentloaded'});
 try{
  await detailPage.locator('.social-detail h1').waitFor({timeout:12000});
 }catch(error){
  const state=await detailPage.evaluate(()=>({
   url:location.href,ready:document.readyState,
   root:document.querySelector('#main')?.innerHTML?.slice(0,1800),
   swController:!!navigator.serviceWorker?.controller,
   cached:performance.getEntriesByType('resource').filter(x=>x.name.includes('ui-icons')||x.name.includes('social-routes-enhancements')).map(x=>({name:x.name,duration:x.duration}))
  })).catch(e=>({error:String(e)}));
  console.log('SOCIAL_SECOND_RELOAD_DIAGNOSTIC',JSON.stringify(state));
  await detailPage.screenshot({path:'p0-smoke-artifacts/social-second-reload-debug.png',fullPage:true}).catch(()=>{});
  throw error;
 }
 await detailCtx.close();

 // COMMUNITY-HUB-023: four accessible community subviews are reachable without altering bottom tabs.
 await page.locator('#navigation a[href="#routes/community"]').click();
 await page.locator('[data-community-tabs] .community-hub-links').waitFor({timeout:12000});
 const subTabs=await page.locator('[data-community-tabs] .community-hub-links a').evaluateAll(nodes=>nodes.map(a=>({label:a.textContent.trim(),href:a.getAttribute('href')})));
 assert.deepEqual(subTabs,[
  {label:'Trasy',href:'#routes/community'},
  {label:'Grupy',href:'#routes/community/groups'},
  {label:'Czaty',href:'#routes/community/chats'},
  {label:'Znajomi',href:'#routes/community/friends'},
  {label:'Zapisane',href:'#social-saved-places'}
 ]);
 assert.ok(await page.locator('[data-community-tabs]').isVisible(),'inner community tabs must not be hidden by feed focus');
 const eventsEntry=page.locator('[data-community-tabs] .community-events-entry[href="#events"]');
 await eventsEntry.waitFor({timeout:10000});
 await eventsEntry.click();
 await page.locator('h1').getByText('Co się dzieje w Warszawie?').waitFor({timeout:10000});
 await page.locator('[data-action="ev-scope"][data-value="community"]').click();
 await page.getByText('Spacery grupowe, spotkania i wydarzenia od społeczności').waitFor({timeout:10000});
 assert.ok(await page.getByText('Obecnie nie można jeszcze utworzyć publicznego wydarzenia',{exact:false}).isVisible(),
  'do not promise RSVP/creator actions without a live backend');
 await page.locator('#navigation a[href="#routes/community"]').click();
 await page.locator('[data-community-tabs] .community-hub-links').waitFor({timeout:10000});

 await page.locator('[data-community-tabs] a[href="#routes/community/groups"]').click();
 await page.locator('.community-page h1').getByText('Grupy odkrywców').waitFor({timeout:10000});
 assert.equal(await page.locator('[data-community-tabs] a[href="#routes/community/groups"]').getAttribute('aria-current'),'page');
 await page.locator('[data-community-tabs] a[href="#routes/community/friends"]').click();
 await page.locator('[data-friends-page]').waitFor({timeout:10000});
 assert.ok(await page.getByText('Znajomi po zalogowaniu').isVisible(),'guest friends gate must not expose private contacts');
 assert.equal(await page.locator('[data-community-tabs] a[href="#routes/community/friends"]').getAttribute('aria-current'),'page');
 await page.locator('[data-community-tabs] a[href="#routes/community/chats"]').click();
 await page.locator('.community-page h1').getByText('Czaty').waitFor({timeout:10000});
 assert.ok(await page.locator('.community-page').getByText('Zaloguj się, aby zobaczyć czaty').isVisible(),'guest chat view has a real authentication gate');
 assert.equal(await page.locator('[data-community-tabs] a[href="#routes/community/chats"]').getAttribute('aria-current'),'page');
 const communityWidth=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
 assert.ok(communityWidth.scroll<=communityWidth.inner+1,'community tabs have no 375px horizontal overflow: '+JSON.stringify(communityWidth));
 // A 320px phone must still show all five top links without clipping or horizontal scrolling.
 await page.setViewportSize({width:320,height:700});
 const compactNav=await page.locator('[data-community-tabs] .community-hub-links').evaluate(nav=>{
  const bounds=nav.getBoundingClientRect();
  const links=[...nav.querySelectorAll('a')].map(a=>({label:a.textContent.trim(),left:a.getBoundingClientRect().left,right:a.getBoundingClientRect().right}));
  return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,navScrollWidth:nav.scrollWidth,navClientWidth:nav.clientWidth,
    left:bounds.left,right:bounds.right,links};
 });
 assert.equal(compactNav.links.length,5,'Community top navigation has exactly five links at 320px');
 const bottom=await page.locator('#navigation').evaluate(nav=>{
  const rect=nav.getBoundingClientRect();
  const me=document.querySelector('.top #me')?.getBoundingClientRect();
  const top=document.querySelector('.top')?.getBoundingClientRect();
  return {avatarRight:me?.right,topRight:top?.right,screenWidth:window.screen.width,innerWidth:window.innerWidth,clientWidth:document.documentElement.clientWidth,
   scrollWidth:document.documentElement.scrollWidth,left:rect.left,right:rect.right,tabCount:nav.querySelectorAll('a').length,
   overflowCandidates:[...document.querySelectorAll('body *')].filter(e=>{
     const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
     return r.width>0&&r.height>0&&cs.display!=='none'&&cs.position!=='fixed'&&r.right>window.screen.width+1;
   }).slice(0,18).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cls:String(e.className||'').slice(0,65),id:e.id,left:Math.round(r.left),right:Math.round(r.right),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};})};
 });
 assert.ok(bottom.tabCount===6&&bottom.scrollWidth<=bottom.screenWidth+1&&bottom.innerWidth<=bottom.screenWidth+1&&bottom.right<=bottom.screenWidth+1&&bottom.avatarRight<=bottom.screenWidth+1,
  '320px bottom navigation must never widen screen to 324px: '+JSON.stringify(bottom));
 assert.ok(compactNav.navScrollWidth<=compactNav.navClientWidth+1&&compactNav.scrollWidth<=compactNav.viewport+1&&compactNav.links.every(link=>link.left>=compactNav.left-1&&link.right<=compactNav.right+1),
  'Community 320px grid must not overflow: '+JSON.stringify(compactNav));
 await page.screenshot({path:'p0-smoke-artifacts/community-saved-nav-320.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});
 await page.screenshot({path:'p0-smoke-artifacts/community-hub-chats-guest.png',fullPage:true});
 await page.locator('[data-community-tabs] a[href="#routes/community"]').click();
 await page.locator('[data-community-tabs] a[href="#routes/community"]').waitFor({state:'visible'});
 // ONBOARDING-021: optional start guide must be discoverable, usable and fit a narrow phone.
 await page.locator('#navigation a[href="#plan"]').click();
 await page.locator('#main a.start-here[href="#about"]').waitFor({timeout:10000});
 await page.locator('#main a.start-here[href="#about"]').click();
 await page.locator('#main .start-guide-menu').waitFor({timeout:10000});
 assert.equal(new URL(page.url()).hash,'#about');
 assert.equal(await page.locator('#navigation a[href="#about"]').getAttribute('aria-current'),'page','Poradnik should be active in main bottom menu');
 assert.equal(await page.locator('#main .guide-feature').count(),34,'every important feature should have a standalone explanation');
 assert.equal(await page.locator('#main .guide-group').count(),6,'guide groups should cover each core area');
 await page.locator('#main #guide-search').fill('znajomego');
 assert.ok(await page.locator('#main .guide-feature:not([hidden])').count()>=1,'search finds relevant feature');
 assert.ok(await page.locator('#main .guide-feature:not([hidden])').count()<34,'guide search filters unrelated items');
 await page.locator('#main #guide-search').fill('brak-takiej-funkcji-001');
 assert.ok(await page.locator('[data-guide-count]').textContent().then(s=>s.includes('Nie znaleziono tematu')));
 await page.locator('#main #guide-search').fill('');
 await page.setViewportSize({width:320,height:700});
 const guideNav320=await page.locator('#navigation').evaluate(nav=>({n:nav.querySelectorAll('a').length,right:nav.getBoundingClientRect().right,scroll:document.documentElement.scrollWidth,w:innerWidth}));
 assert.ok(guideNav320.n===6&&guideNav320.right<=guideNav320.w+1&&guideNav320.scroll<=guideNav320.w+1,'320px six-tab guide nav must fit: '+JSON.stringify(guideNav320));
 await page.screenshot({path:'p0-smoke-artifacts/onboarding-guide-320.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});
 
 const guideTargets=await page.locator('#main .start-guide-menu a').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
 assert.deepEqual(guideTargets,['#plan','#routes','#places','#my-route','#routes/community','#book']);
 const guideWidth=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
 assert.ok(guideWidth.scroll<=guideWidth.inner+1,'start guide has no mobile horizontal overflow: '+JSON.stringify(guideWidth));
 await page.locator('#main .start-guide-menu a[href="#my-route"]').click();
 assert.equal(new URL(page.url()).hash,'#my-route','guide links directly to existing functionality');
 // FIRST-30S-IPHONE-UX-051: user-reported real iPhone 13 Pro viewport.
 await page.locator('#navigation a[href="#plan"]').click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('#main .ux-plan-head h1').waitFor();
 assert.match(await page.locator('#main .ux-plan-head h1').textContent(),/Odkrywaj miasto po swojemu/);
 assert.equal(await page.locator('#build-form .ux-time input[name="time"]:checked').inputValue(),'120','2h must remain one-tap default');
 assert.equal(await page.locator('#build-form button.ux-submit').textContent(),'Ułóż mi trasę');
 const fastPlanOrder=await page.locator('#build-form').evaluate(form=>{
  const time=form.querySelector('.ux-time'),submit=form.querySelector('.ux-submit'),when=form.querySelector('.ux-when');
  const rows=[...form.children];return {t:rows.indexOf(time?.parentElement),submit:rows.indexOf(submit),when:rows.indexOf(when)};
 });
 assert.ok(fastPlanOrder.submit<fastPlanOrder.when,'quick generation must come before date and advanced options: '+JSON.stringify(fastPlanOrder));
 const shortcutHrefs=await page.locator('#build-form .ux-plan-alternatives a').evaluateAll(els=>els.map(a=>a.getAttribute('href')));
 assert.ok(shortcutHrefs.includes('#places')&&shortcutHrefs.includes('#routes/community'),'manual discovery and community are visible');
 const myRouteInactive=await page.locator('#navigation a[href="#my-route"]').evaluate(a=>({active:a.classList.contains('active'),shadow:getComputedStyle(a).boxShadow}));
 assert.equal(myRouteInactive.active,false);
 assert.equal(myRouteInactive.shadow,'none','My Route must not look selected while user is on Plan');
 await page.locator('#build-form .ux-when > summary').click();
 const iphoneDateLayout=await page.locator('#build-form .planner-when-fields').evaluate(box=>{
  const date=box.querySelector('input[type="date"]').getBoundingClientRect(),time=box.querySelector('input[type="time"]').getBoundingClientRect();
  return {firstRight:date.right,secondLeft:time.left,firstBottom:date.bottom,secondTop:time.top,containerRight:box.getBoundingClientRect().right,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
 });
 assert.ok(iphoneDateLayout.firstBottom<=iphoneDateLayout.secondTop+1,'iPhone date/time fields cannot overlap: '+JSON.stringify(iphoneDateLayout));
 assert.ok(iphoneDateLayout.firstRight<=iphoneDateLayout.containerRight+1&&iphoneDateLayout.scrollWidth<=iphoneDateLayout.width+1,'iPhone date input must fit card: '+JSON.stringify(iphoneDateLayout));

 const compactTime=await page.locator('#build-form .ux-time .choice span').first().evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(compactTime<85,'1 h choice uses only its intrinsic width, not a full grid column: '+compactTime);
 const cityHeader=await page.locator('#city-select').evaluate(el=>({name:el.options[el.selectedIndex].textContent,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,viewport:innerWidth}));
 assert.equal(cityHeader.name,'Warszawa');
 assert.ok(cityHeader.width>=104&&cityHeader.right<=cityHeader.viewport+1,'Warsaw picker fits iPhone: '+JSON.stringify(cityHeader));
 await page.screenshot({path:'p0-smoke-artifacts/iphone13-first-30s-plan.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});

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
 // LIVE-ROUTE-025: rating is asked only after arrival and may be skipped, then the
 // completed route is publishable verbatim without changing the manual builder.
 await page.locator('#navigation a[href="#my-route"]').click();
 await page.locator('button[data-action="start"][data-id="basket"]').click();
 await page.locator('button[data-action="done"]').click();
 await page.locator('.stop-rating').waitFor({timeout:10000});
 let staged=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).session);
 assert.equal(staged.index,0,'arrival prompt must not silently advance the route');
 assert.equal(staged.results.length,0,'arrival prompt must not record completion before user decides about rating');
 const arrivedPlace=staged.stops[0];
 await page.locator('.stop-rating button[data-action="arrival-rating"][data-value="5"]').click();
 let rated=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')));
 assert.equal(rated.placeReviews[arrivedPlace],5);
 assert.equal(rated.session.index,1);
 assert.equal(rated.session.results[0].status,'done');
 await page.locator('button[data-action="done"]').click();
 await page.locator('.stop-rating').waitFor({timeout:10000});
 await page.locator('.stop-rating button[data-action="arrival-skip-rating"]').click();
 assert.equal(await page.locator('button[data-action="done"]').count(),1,'skipping rating still completes the stop');
 rated=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')));
 assert.equal(rated.session.index,2);
 assert.equal(rated.placeReviews[rated.session.stops[1]],undefined,'skipping rating does not invent a score');
 for(let stop=2;stop<rated.session.stops.length;stop++){
  await page.locator('button[data-action="skip"]').click();
 }
 await page.locator('.finished-share button[data-action="publish-finished"]').waitFor({timeout:12000});
 const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).session);
 assert.equal(completed.finished,true);
 const basketBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).basket.slice());
 await page.evaluate(()=>document.addEventListener('cityroute:publish-completed',e=>{window.__completedDraft=e.detail;},{once:true}));
 await page.locator('.finished-share button[data-action="publish-finished"]').click();
 const shared=await page.evaluate(()=>window.__completedDraft||null);
 assert.deepEqual(shared.stops,completed.stops,'publish CTA passes exact finished stop order');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')).basket),basketBefore,'completed publish leaves manually edited basket intact');
 assert.equal(new URL(page.url()).hash,'#profile','guest publish leads to login instead of bypassing auth');
 await page.screenshot({path:'p0-smoke-artifacts/live-stop-rating-completed.png',fullPage:true});
 assert.deepEqual(errors,[],'unexpected page exception in mobile route test');
 await ctx.close();
 
 // Fresh visitor adds a totally new coordinate-only point and optional 5/5 rating.
 const ctx2=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx2.route(/supabase\.co/,route=>route.abort());
 // Julian scenario without paid API credentials: mock the official provider aggregate
 // response at the Worker boundary; verify real add/save → photo/ratings UI → bookmark.
 let betaEnrichmentCalls=0;
 await ctx2.route(/\/api\/place-enrichment\?/,route=>{
  betaEnrichmentCalls++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   status:'ok',available:{google:true,tripadvisor:true},ratings:[
    {source:'google',value:4.5,reviewCount:60,url:'https://maps.google.com/?q=test',listing:'P0 test punkt widokowy'},
    {source:'tripadvisor',value:4.7,reviewCount:30,url:'https://www.tripadvisor.com/',listing:'P0 test punkt widokowy'}
   ],reviews:[],image:{src:'/api/place-photo?id=ChIJmockPlace12345',
    credit:{author:'QA',license:'Mock Google',via:'Google Maps',source:'https://maps.google.com/'}}
  })});
 });
 await ctx2.route(/\/api\/place-photo\?/,route=>route.fulfill({status:200,contentType:'image/gif',
  body:Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=','base64')}));

 const p2=await ctx2.newPage();const pageErrors=[];p2.on('pageerror',e=>pageErrors.push(e.message));
 await p2.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
 await p2.locator('#pc-q').waitFor({timeout:30000});
 await p2.locator('#pc-q').fill('52.230123, 21.012345');
 await p2.locator('#place-form input[name="name"]').fill('P0 test punkt widokowy');
 await p2.locator('#place-form input[name="rating"][value="5"]').check({force:true});
 await p2.locator('#place-form button.primary.big').click();
 try{await p2.locator('#place-dialog[open] button[data-action="add-another-place"]').waitFor({timeout:12000});}
 catch(error){
  console.warn('ADD_DEBUG='+JSON.stringify(await p2.evaluate(()=>({
   hash:location.hash,main:document.querySelector('#main')?.textContent?.slice(0,1200),
   toast:document.querySelector('#toast')?.textContent,
   dialogOpen:document.querySelector('#place-dialog')?.open,dialog:document.querySelector('#place-dialog')?.textContent?.slice(0,1200),
   saved:JSON.parse(localStorage.getItem('city-route-v1')||'{}').userPlaces?.map(p=>p.name),
   errors:window.__debugErr||[]
  }))));
  console.warn('ADD_PAGE_ERRORS='+JSON.stringify(pageErrors));console.warn('ENRICH_CALLS='+betaEnrichmentCalls);
  await p2.screenshot({path:'p0-smoke-artifacts/add-place-failure.png',fullPage:true});
  throw error;
 }
 await p2.locator('#place-dialog[open] a.row[data-source="google"]').waitFor({timeout:12000});
 await p2.locator('#place-dialog[open] a.row[data-source="tripadvisor"]').waitFor({timeout:12000});
 assert.match(await p2.locator('#place-dialog[open] a.row[data-source="google"]').innerText(),/4,5/,'Google rating is visible after add');
 assert.match(await p2.locator('#place-dialog[open] a.row[data-source="tripadvisor"]').innerText(),/4,7/,'Tripadvisor rating is visible after add');
 assert.match(await p2.locator('#place-dialog[open] img.sheet-photo').getAttribute('src'),/api\/place-photo/,'photo is set after add');
 assert.equal(betaEnrichmentCalls,1,'only one enrichment call per newly added place');

 const state=await p2.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')));
 const added=state.userPlaces.find(p=>p.name==='P0 test punkt widokowy');
 assert.ok(added,'custom coordinates must be saved locally');
 assert.equal(state.placeReviews[added.id],5,'optional add-time rating should be stored');
 assert.ok(Math.abs(added.lat-52.230123)<0.000001);
 assert.ok(Math.abs(added.lng-21.012345)<0.000001);
 assert.ok(state.savedPlacesByCity?.warsaw?.includes(added.id),'added user place must be bookmarked automatically');
 assert.equal(state.userPlaces.find(p=>p.id===added.id).ratings.length,0,'external provider data is not persisted into localStorage');
 await p2.screenshot({path:'p0-smoke-artifacts/added-place.png',fullPage:true});
 await p2.locator('#place-dialog button[data-action="add-another-place"]').click();
 await p2.locator('#pc-q').waitFor({timeout:10000});
 // New Places UX: saved places sit directly beside all, purple City Route scores do not
 // enter any Google/Tripadvisor combined mean, and bookmarks can be toggled in place.
 await p2.goto(BASE+'/#places',{waitUntil:'domcontentloaded'});
 await p2.locator('button[data-action="cat"][data-value="saved"]').waitFor({timeout:10000});
 const filters=await p2.locator('button[data-action="cat"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.value));
 assert.equal(filters.indexOf('saved'),filters.indexOf('all')+1,'Zapisane must sit beside Wszystkie');
 await p2.locator('button[data-action="cat"][data-value="saved"]').click();
 const savedCard=p2.locator('.place-list article.place:has(button[data-action="place"][data-id="'+added.id+'"])');
 await savedCard.waitFor({timeout:12000});
 assert.equal(await savedCard.locator('.cr-score').count(),1,'City Route score must be visible separately on saved place');
 assert.match(await savedCard.locator('.cr-score').innerText(),/City Route/);
 await p2.screenshot({path:'p0-smoke-artifacts/places-saved-purple-score.png',fullPage:true});
 await savedCard.locator('button[data-action="bookmark"]').click();
 assert.equal(await p2.locator('.place-list button[data-action="place"][data-id="'+added.id+'"]').count(),0,'unsave removes place from saved filter');
 await p2.locator('button[data-action="cat"][data-value="all"]').click();
 await p2.locator('.place-list article.place:has(button[data-action="place"][data-id="'+added.id+'"]) button[data-action="bookmark"]').click();
 assert.ok((await p2.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')))).savedPlacesByCity.warsaw.includes(added.id),'bookmark persisted across route change');
 await p2.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
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
 assert.match(latestSW,/city-route-v\d+/);
 // The build stamps a content hash onto the cache name (scripts/cache-version.mjs); use the real built name.
 const builtCache=/const CACHE='([^']+)'/.exec(latestSW)[1];
 await writeFile(swPath,latestSW.replace(builtCache,"city-route-v33"));
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
  await upgradePage.waitForFunction(async name=>{const keys=await caches.keys();return keys.includes(name)&&!keys.includes('city-route-v33');},builtCache,{timeout:30000});
  await upgradePage.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded'});
  await upgradePage.locator('#pc-q').waitFor({timeout:15000});
  await upgradePage.screenshot({path:'p0-smoke-artifacts/pwa-upgraded-v33-to-v41.png',fullPage:true});
  console.log('PASS: installed PWA cache upgrade v33 → v41, app and composer boot after upgrade.');
  await upgradeCtx.close();
 }finally{await writeFile(swPath,latestSW);}
 console.log('PASS: mobile 375px, 5 tabs, 10-stop optimization, B→B1 insertion, local custom place, optional rating, repeat add, PWA offline reload.');
}finally{
 if(browser)await browser.close();
 if(server){server.kill('SIGTERM');}
}
