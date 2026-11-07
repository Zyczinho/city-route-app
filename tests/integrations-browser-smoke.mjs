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
 await context.addInitScript(({a,b})=>{
  localStorage.setItem('city-route-first-launch-v1','1');
  localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'integration-browser',nickname:'Tester'},
   basket:[a,b],basketsByCity:{warsaw:[a,b]},events:[],session:null,cityId:'warsaw',
   userPlaces:[],savedPlacesByCity:{warsaw:[]},myRoutes:[],placeReviews:{}}));
 },{a:first.id,b:second.id});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(ROOT+'/#my-route',{waitUntil:'domcontentloaded'});
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
 assert.match(shareUrl,/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
 for(const label of ['WhatsApp','Instagram','Messenger','Kopiuj link']){
  assert.ok(await modal.getByText(label,{exact:false}).count()>0,'visible share option: '+label);
 }
 await modal.locator('button[type="submit"]').click();

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
 const bounds=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
 assert.ok(bounds.scrollWidth<=bounds.width+1,'375px profile has no horizontal overflow: '+JSON.stringify(bounds));
 assert.deepEqual(errors,[],'no uncaught browser errors: '+errors.join('; '));
 console.log('PASS integrations browser: 375px GPX download, private Maps share, social chooser, Takeout CSV import');
}finally{
 if(browser)await browser.close();
 if(server)server.kill('SIGTERM');
}
