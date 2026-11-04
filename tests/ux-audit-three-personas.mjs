// Three isolated synthetic customer agents. READ-ONLY cloud usage: no real signups,
// reviews, shared submissions or production writes. Private place is localStorage-only.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=(process.env.AUDIT_BASE||'https://city-route-app.jakublojek.workers.dev').replace(/\/$/,'');
const OUT='ux-audit-artifacts';
await mkdir(OUT,{recursive:true});
const report={date:new Date().toISOString(),base:BASE,mode:'three simulated guest customers; real published frontend; synthetic private localStorage only',agents:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

async function scenario(id,name,viewport,fn){
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await ctx.newPage();page.setDefaultTimeout(12000);
 const person={id,name,viewport,steps:[],observations:{},errors:[]};
 report.agents.push(person);
 page.on('pageerror',error=>person.errors.push(String(error.message).slice(0,240)));
 const step=async(label,fn)=>{
  try{
   const value=await fn();
   person.steps.push({step:label,ok:true,value:value===undefined?null:value});
   return value;
  }catch(error){
   person.steps.push({step:label,ok:false,error:String(error.message||error).slice(0,400)});
   return null;
  }
 };
 const shot=async(name)=>{
  try{await page.screenshot({path:OUT+'/'+id+'-'+name+'.png',fullPage:true,animations:'disabled',timeout:15000});}catch(error){person.errors.push('screenshot '+name+': '+String(error.message).slice(0,150));}
 };
 const measure=async()=>page.evaluate(()=>{
  const vis=el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return r.width>0&&r.height>0&&c.visibility!=='hidden'&&c.display!=='none';};
  const main=document.querySelector('#main');
  const buttons=[...main.querySelectorAll('button,a.button,a.add-place')].filter(vis).map(el=>({label:(el.textContent||el.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,65),width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height),top:Math.round(el.getBoundingClientRect().top)}));
  const photos=[...main.querySelectorAll('article.place .thumb')];
  const imageCount=photos.filter(el=>el.querySelector('img')).length;
  const loaded=photos.filter(el=>{const img=el.querySelector('img');return img&&img.complete&&img.naturalWidth>0;}).length;
  const map=document.querySelector('#places-map.cr-map');
  const mapRect=map?.getBoundingClientRect();
  const n=document.querySelector('.community-hub-links');
  return {hash:location.hash,catalogueSource:document.documentElement.dataset.catalogueSource||'unknown',
   viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
   buttonsTotal:buttons.length,buttonsAboveFold:buttons.filter(b=>b.top>=0&&b.top<innerHeight).length,
   fullWidthTallButtons:buttons.filter(b=>b.width>=innerWidth*.74&&b.height>=54).slice(0,8),
   placeCards:photos.length,imagesWithSrc:imageCount,imagesLoaded:loaded,placeholders:photos.length-imageCount,
   map:mapRect?{height:Math.round(mapRect.height),left:Math.round(mapRect.left),right:Math.round(mapRect.right),scrollMode:map.classList.contains('is-scroll-mode')}:null,
   communityTabs:n?[...n.querySelectorAll('a')].map(a=>a.textContent.trim()):null};
 });
 try{
  await fn({page,step,shot,measure,person,context:ctx});
 }catch(error){person.errors.push('scenario: '+String(error.message).slice(0,400));}
 person.status=person.steps.some(x=>x.ok)?'executed':'unable-to-load';
 await ctx.close();
}

await scenario('01','Turysta: pierwsza wizyta i szybka trasa',{width:375,height:812},async({page,step,shot,measure,person})=>{
 await step('Wejście: ekran planowania',async()=>{
  await page.goto(BASE+'/#plan',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#build-form').waitFor({timeout:25000});
  return await measure();
 });
 await shot('planner');
 await step('Generowanie trasy',async()=>{
  await page.locator('#build-form input[name="start"][value="any"]').check({force:true});
  await page.locator('#build-form button.primary.big').click();
  await page.locator('.generated-options').waitFor({timeout:20000});
  return {routeSuggestions:await page.locator('.generated-option').count(),hash:new URL(page.url()).hash};
 });
 await shot('generated-route');
 await step('Przejście do odkrywania miejsc',async()=>{
  await page.locator('#navigation a[href="#places"]').click();
  await page.locator('article.place').first().waitFor();
  return await measure();
 });
 await shot('places-list');
 await step('Działania na kafelku i czytelność ocen',async()=>{
  return await page.locator('article.place').first().evaluate(row=>{
   const buttons=[...row.querySelectorAll('.side button')].map(b=>({name:b.getAttribute('aria-label'),width:Math.round(b.getBoundingClientRect().width),height:Math.round(b.getBoundingClientRect().height)}));
   const source=row.querySelector('.srcs'),city=row.querySelector('.cr-score'),score=row.querySelector('.score');
   const visible=el=>el?getComputedStyle(el).display!=='none':false;
   return {buttons,combinedScoreVisible:visible(score),googleTripadvisorBreakdownVisible:visible(source),cityRouteScoreVisible:visible(city),title:row.querySelector('h3')?.textContent};
  });
 });
 await step('Dodanie miejsca do Mojej trasy z listy',async()=>{
  const row=page.locator('article.place').first();
  await row.locator('[data-action="add"]').click();
  const basket=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').basket||[]);
  return {basketStops:basket.length,actionPresent:true};
 });
 await step('Dialog szczegółów miejsca',async()=>{
  await page.locator('article.place .hit').first().click();
  await page.locator('#place-dialog[open]').waitFor();
  return {actions:await page.locator('#place-dialog .sheet-actions button').allTextContents(),hasGoogleTripadvisor:await page.locator('#place-dialog .breakdown .row').count()};
 });
 await shot('place-dialog');
});
await scenario('02','Mieszkaniec: odkrywanie, klub i zapisane miejsca',{width:320,height:700},async({page,step,shot,measure,person})=>{
 await step('Wejście do katalogu na wąskim telefonie',async()=>{
  await page.goto(BASE+'/#places',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('article.place').first().waitFor({timeout:25000});
  return await measure();
 });
 await shot('places-320');
 await step('Kategoria Bary i kluby',async()=>{
  await page.locator('[data-action="cat"][data-value="nocne"]').click();
  return {results:await page.locator('article.place').count(),emptyMessage:(await page.locator('#main .empty').allTextContents()).join(' ').slice(0,100)};
 });
 await shot('nightlife');
 await step('Szybkie wyszukiwanie z podpowiedziami',async()=>{
  await page.locator('[data-action="cat"][data-value="all"]').click();
  await page.locator('#search').fill('Stary');
  await page.waitForTimeout(400);
  return {suggestions:await page.locator('.place-suggest button').count(),results:await page.locator('article.place').count()};
 });
 await shot('suggestions');
 await step('Zapisanie miejsca i przejście do Społeczność → Zapisane',async()=>{
  await page.locator('#search').fill('');
  const row=page.locator('article.place').first();
  const id=await row.getAttribute('data-place-id');
  await row.locator('[data-action="bookmark"]').click();
  await page.locator('#navigation a[href="#routes/community"]').click();
  await page.locator('.community-hub-links').waitFor();
  await page.locator('.community-hub-links a[href="#social-saved-places"]').click();
  await page.locator('h1').getByText('Zapisane miejsca').waitFor();
  return {savedPlaceFound:await page.locator('article.place[data-place-id="'+id+'"]').count()===1,layout:await measure()};
 });
 await shot('saved-320');
 await step('Nawigacja Społeczności nie wychodzi poza siatkę',async()=>{
  return await page.locator('.community-hub-links').evaluate(nav=>{
   const n=nav.getBoundingClientRect();
   return {links:[...nav.querySelectorAll('a')].map(a=>a.textContent.trim()),navWidth:Math.round(n.width),
    navScrollWidth:nav.scrollWidth,navClientWidth:nav.clientWidth,overflow:nav.scrollWidth>nav.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,
    nested:!!document.querySelector('[data-saved-switch]:not([hidden])')};
  });
 });
});
await scenario('03','Twórca: nowe miejsce, brak zdjęcia i powrót do własnych',{width:390,height:844},async({page,step,shot,measure,person})=>{
 await step('Wejście w dodawanie miejsca',async()=>{
  await page.goto(BASE+'/#add-place',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#place-form').waitFor({timeout:25000});
  return await measure();
 });
 await shot('new-place');
 await step('Kategoria Klub i podpowiedzi Sketch Nite',async()=>{
  const cats=await page.locator('#place-form select[name="cat"] option').allTextContents();
  await page.locator('#place-form select[name="cat"]').selectOption('club');
  await page.locator('#pc-q').fill('Sketch Nite');
  await page.waitForTimeout(900);
  return {categories:cats.length,clubPresent:cats.some(c=>c.includes('Klub')),suggestions:await page.locator('#pc-list li').count(),
    suggestedImages:await page.locator('#pc-list li .pc-opt-thumb img').count(),
    manualPhotoButton:await page.locator('#place-form input[name="photo"]').count()===1};
 });
 await shot('club-form');
 await step('Prywatny zapis bez dostępu do produkcyjnej bazy',async()=>{
  await page.locator('#pc-q').fill('');
  await page.locator('#place-form input[name="name"]').fill('AUDYT Sketch Nite');
  await page.locator('#place-form select[name="cat"]').selectOption('club');
  await page.locator('#place-form input[name="where"]').evaluate(el=>{
   el.value='52.2301, 21.0131';
   el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#place-form input[name="vis"][value="private"]').check({force:true});
  await page.locator('#place-form button.primary.big').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').userPlaces?.some(p=>p.name==='AUDYT Sketch Nite'),{timeout:12000});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').userPlaces.find(p=>p.name==='AUDYT Sketch Nite'));
  return {id:saved.id,cats:saved.cats,categoryId:saved.categoryId,photoPresent:!!saved.image,visibility:saved.visibility};
 });
 await shot('created-place');
 await step('Wyszukanie własnego miejsca przez statystykę',async()=>{
  if(await page.locator('#place-dialog[open]').count())await page.locator('#place-dialog .close').click();
  await page.locator('#me').click();
  const stat=page.locator('[data-action="show-my-places"]');
  await stat.waitFor();
  await stat.click();
  const rows=page.locator('article.place');
  return {myPlacesActive:await page.locator('[data-action="cat"][data-value="mine"]').getAttribute('aria-pressed'),
    ownPlaceVisible:await rows.filter({hasText:'AUDYT Sketch Nite'}).count()===1,metrics:await measure()};
 });
 await shot('my-places');
 await step('Odpięcie zakładki nie usuwa własnego miejsca',async()=>{
  const row=page.locator('article.place').filter({hasText:'AUDYT Sketch Nite'}).first();
  await row.locator('[data-action="bookmark"]').click();
  const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}'));
  return {ownPlaceInState:s.userPlaces.some(p=>p.name==='AUDYT Sketch Nite'),
   stillVisible:await page.locator('article.place').filter({hasText:'AUDYT Sketch Nite'}).count()>0,
   noLongerBookmarked:!s.savedPlacesByCity.warsaw.includes(s.userPlaces.find(p=>p.name==='AUDYT Sketch Nite').id)};
 });
 await step('Zachowanie danych po odświeżeniu',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#main .page-head h1'));
  return {localStatePersists:await page.evaluate(()=>JSON.parse(localStorage.getItem('city-route-v1')||'{}').userPlaces.some(p=>p.name==='AUDYT Sketch Nite'))};
 });
});
await browser.close();
for(const p of report.agents){
 p.passed=p.steps.filter(s=>s.ok).length;
 p.failed=p.steps.filter(s=>!s.ok).length;
}
await writeFile(OUT+'/three-customer-audit.json',JSON.stringify(report,null,2));
console.log('THREE_CUSTOMER_AUDIT_BEGIN');
console.log(JSON.stringify(report,null,2));
console.log('THREE_CUSTOMER_AUDIT_END');
