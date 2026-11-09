// Read-only production diagnostics: saves test places to isolated browser localStorage only.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';

const ORIGIN = process.env.CITY_ROUTE_LIVE_URL || 'https://city-route-app.jakublojek.workers.dev';
const art = 'p0-smoke-artifacts/live-add-place';
await mkdir(art,{recursive:true});
const request=async path=>{
 const res=await fetch(ORIGIN+path+(path.includes('?')?'&':'?')+'qa='+Date.now(),{headers:{'Cache-Control':'no-cache'}});
 const body=await res.text();
 console.log('LIVE_ASSET',path,res.status,res.headers.get('content-type'),body.length);
 assert.equal(res.status,200,'missing deployed asset '+path);
 return body;
};
const html=await request('/index.html');
const css=await request('/place-composer.css?v=4');
const sw=await request('/service-worker.js');
assert.match(html,/place-composer\.css\?v=4/,'deployed HTML references outdated CSS');
assert.match(css,/#place-form \.choice input\[type="radio"\]/,'deployed CSS lacks pointer fix');
assert.match(sw,/city-route-v84/,'deployed service worker is older than pointer fix');
console.log('LIVE_ASSET_PARITY_PASS CSS v4 / SW v84');

const engines=[['chromium',chromium],['webkit',webkit]];
for(const [name,engine] of engines){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
 try {
  for(const width of [375,1220]){
   const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width<700,hasTouch:width<700,serviceWorkers:'block'});
   await ctx.addInitScript(()=>{
    localStorage.setItem('city-route-first-launch-v1','1');
    localStorage.setItem('city-route-v1',JSON.stringify({version:1,tester:{id:'live-pointer-test',nickname:'Test'},cityId:'lisbon',basket:[],basketsByCity:{lisbon:[]},events:[],session:null,userPlaces:[],placeReviews:{}}));
   });
   const page=await ctx.newPage();page.setDefaultTimeout(10000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(ORIGIN+'/#add-place',{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#pc-q').waitFor();
    await page.locator('#pc-q').fill('38.720123, -9.140123');
    await page.locator('#place-form input[name="name"]').fill('LIVE QA pointer '+name+' '+width);
    await page.waitForFunction(()=>document.querySelector('#place-form input[name="where"]')?.value.includes('38.720123'));
    for(const value of ['none','1','2','3','4','5']){
     const locator=page.locator('#place-form .choice label').filter({has:page.locator('input[name="rating"][value="'+value+'"]')});
     await locator.scrollIntoViewIfNeeded();
     const check=await locator.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const input=el.querySelector('input');
      const b=input.getBoundingClientRect();
      const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {bounds:r.toJSON(),input:b.toJSON(),hit:hit?.outerHTML?.slice(0,250),within:b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1,clickable:el.contains(hit)};
     });
     assert.ok(check.within&&check.clickable,'misaligned radio '+value+' '+JSON.stringify(check));
     await locator.click({force:false});
     assert.equal(await page.locator('#place-form input[name="rating"][value="'+value+'"]').isChecked(),true,'unselected rating '+value);
    }
    const button=page.locator('#place-form button.primary.big');
    await button.scrollIntoViewIfNeeded();
    await button.click({force:false});
    await page.locator('#place-dialog[open]').waitFor({timeout:10000});
    const saved=await page.evaluate(()=>{
     const state=JSON.parse(localStorage.getItem('city-route-v1')||'{}');
     const place=state.userPlaces?.find(p=>p.name.startsWith('LIVE QA pointer'));
     return {name:place?.name,rating:state.placeReviews?.[place?.id],visibility:place?.visibility};
    });
    assert.equal(saved.rating,5);assert.equal(saved.visibility,'private');
    console.log('LIVE_FORM_PASS',name,width,JSON.stringify(saved),'pageerrors=',JSON.stringify(errors));
    assert.deepEqual(errors,[]);
   }catch(e){
    console.error('LIVE_FORM_FAIL',name,width,String(e),JSON.stringify(errors));
    await page.screenshot({path:art+'/'+name+'-'+width+'.png',fullPage:true}).catch(()=>{});
    console.error('LIVE_FORM_HTML', (await page.locator('body').innerText().catch(()=>''))?.slice(0,1500));
    throw e;
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
console.log('LIVE_ADD_PLACE_ALL_PASS');
