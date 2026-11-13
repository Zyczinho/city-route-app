// Browser acceptance of optional Web Push opt-in using a mocked PushManager and authenticated Supabase.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const PORT=4191,BASE='http://127.0.0.1:'+PORT;
let server,browser;
try{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch(BASE+'/index.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,120));}
 assert.ok(ready,'server must start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  const user='aaaaaaaa-0000-4000-8000-000000000001';
  window.__pushWrites=[];
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-token',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test-token',keys:{p256dh:'B'.repeat(87),auth:'C'.repeat(22)}})};
  const fakePush={getSubscription:async()=>null,subscribe:async(opts)=>{window.__subscribeOptions={userVisibleOnly:opts.userVisibleOnly,keyLength:opts.applicationServerKey.length};return subscription;}};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:fakePush})}});
  Object.defineProperty(window,'PushManager',{configurable:true,value:function(){}});
  const FakeNotification=function(){};
  FakeNotification.permission='default';
  FakeNotification.requestPermission=async()=>{FakeNotification.permission='granted';return 'granted';};
  Object.defineProperty(window,'Notification',{configurable:true,value:FakeNotification});
  window.__fakeSupabase={
   auth:{getSession:async()=>({data:{session:{user:{id:user}}}}),onAuthStateChange:()=>({})},
   rpc:async name=>({data:name==='get_push_vapid_public_key'?'B'.repeat(87):null,error:null}),
   from:table=>({insert:async row=>{window.__pushWrites.push({table,row});return {error:null};}})
  };
 });
 await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',route=>route.fulfill({
  status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},
  body:'export function createClient(){return window.__fakeSupabase;}'
 }));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__webpush_test__',route=>route.fulfill({
  status:200,contentType:'text/html',
  body:'<!doctype html><html lang="pl"><body><main id="main"></main><script type="module">const x=await import("./web-push-client.js");document.querySelector("#main").innerHTML=x.webPushControls();</script></body></html>'
 }));
 await page.goto(BASE+'/__webpush_test__',{waitUntil:'domcontentloaded'});
 await page.locator('[data-enable-web-push]').waitFor({timeout:10000});
 await page.locator('[data-enable-web-push]').click();
 await page.locator('[data-webpush-status]').getByText('Powiadomienia włączone',{exact:false}).waitFor({timeout:10000});
 const state=await page.evaluate(()=>({writes:window.__pushWrites,opts:window.__subscribeOptions}));
 assert.equal(state.writes.length,1);
 assert.equal(state.writes[0].table,'push_subscriptions');
 assert.equal(state.writes[0].row.user_id,'aaaaaaaa-0000-4000-8000-000000000001');
 assert.equal(state.opts.userVisibleOnly,true);
 assert.ok(state.opts.keyLength>=60);
 assert.deepEqual(errors,[]);
 console.log('PASS: Web Push permission, VAPID, subscription and per-user Supabase write');
 await context.close();
}finally{await browser?.close();server?.kill('SIGTERM');}
