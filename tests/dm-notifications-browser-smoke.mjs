// Isolated, real-browser acceptance for the notification UI and Realtime routing.
// Supabase is mocked only at the network module boundary; app DOM and notification module are real.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const PORT=4189,BASE='http://127.0.0.1:'+PORT;
const ME='aaaaaaaa-0000-4000-8000-000000000001',PEER='bbbbbbbb-0000-4000-8000-000000000002';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
let server,browser;
try{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
 let ready=false;
 for(let i=0;i<100;i++){try{const r=await fetch(BASE+'/index.html');if(r.ok){ready=true;break;}}catch{}await pause(100);}
 assert.ok(ready,'static server did not start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await context.addInitScript(({me,peer})=>{
  window.__dmMessages=[];
  window.__dmReads=[];
  window.__dmListeners=[];
  const makeTable=name=>{
   const filters={},query={
    select(){return this;},eq(k,v){filters[k]=v;return this;},or(){return this;},order(){return this;},
    limit(){return Promise.resolve({data:window.__dmMessages,error:null});},
    maybeSingle(){return Promise.resolve({data:window.__dmReads.find(x=>x.reader_id===filters.reader_id&&x.peer_id===filters.peer_id)||null,error:null});},
    insert(row){window.__dmReads.push(row);return Promise.resolve({error:null});},
    update(row){this.pending=row;return this;},
    then(resolve){if(name==='direct_message_reads'&&this.pending){
     const record=window.__dmReads.find(x=>x.reader_id===filters.reader_id&&x.peer_id===filters.peer_id);
     if(record)Object.assign(record,this.pending);
    }return Promise.resolve({data:window.__dmReads,error:null}).then(resolve);}
   };
   return query;
  };
  window.__fakeSupabase={
   auth:{getSession:async()=>({data:{session:{user:{id:me}}}}),onAuthStateChange:()=>({})},
   from:makeTable,
   channel(name){const ch={name,handler:null,filter:null,on(_type,filter,handler){this.filter=filter;this.handler=handler;return this;},subscribe(){window.__dmListeners.push(this);return this;}};
    return ch;
   },
   removeChannel(ch){window.__dmListeners=window.__dmListeners.filter(x=>x!==ch);}
  };
  window.__emitDm=(row)=>{
   window.__dmMessages.unshift(row);
   for(const ch of window.__dmListeners)if(ch.filter?.filter?.endsWith('=eq.'+me))ch.handler?.({new:row});
  };
  window.__testIds={me,peer};
 },{me:ME,peer:PEER});
 await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',route=>route.fulfill({
  status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},
  body:'export function createClient(){return window.__fakeSupabase;}'
 }));
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__dm_notification_smoke__',route=>route.fulfill({
  status:200,contentType:'text/html',
  body:'<!doctype html><html><head><title>City Route</title></head><body>'+
   '<nav id="navigation"><a href="#routes/community">Społeczność</a></nav>'+
   '<main id="main"><header data-community-tabs><a href="#routes/community/chats">Czaty</a></header>'+
   '<a data-dm-peer="'+PEER+'" href="#routes/community/dm/'+PEER+'"><strong>@KacpiKot</strong></a></main>'+
   '<script type="module">window.__dmModule=await import("./dm-notifications.js");window.__dmModuleReady=true;</script>'+
   '</body></html>'
 }));
 await page.goto(BASE+'/__dm_notification_smoke__',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dmModuleReady===true,{timeout:12000});
 const incoming={id:11,user_low:ME,user_high:PEER,sender_id:PEER,body:'Secret private message',created_at:new Date().toISOString()};
 await page.evaluate(msg=>window.__emitDm(msg),incoming);
 await page.locator('#navigation .dm-unread-badge').waitFor({timeout:7000});
 assert.equal(await page.locator('#navigation .dm-unread-badge').textContent(),'1');
 assert.equal(await page.locator('[data-community-tabs] .dm-tab-unread-badge').textContent(),'1');
 assert.equal(await page.locator('[data-dm-peer] .dm-chat-unread-badge').textContent(),'1');
 assert.equal(await page.locator('#dm-message-notice a').getAttribute('href'),'#routes/community/dm/'+PEER);
 assert.ok(!(await page.locator('#dm-message-notice').textContent()).includes('Secret private message'),'toast must not leak message content');
 await page.evaluate(msg=>window.__emitDm(msg),incoming);
 assert.equal(await page.locator('#navigation .dm-unread-badge').textContent(),'1','duplicate realtime event must not duplicate count');
 await page.evaluate(async({me,peer})=>{await window.__dmModule.markDirectThreadRead(me,peer,11);},{me:ME,peer:PEER});
 await page.waitForFunction(()=>!document.querySelector('#navigation .dm-unread-badge'),{timeout:7000});
 await page.locator('#dm-message-notice button').click();
 await page.evaluate(({me,peer})=>{
  location.hash='#routes/community/dm/'+peer;
  window.__emitDm({id:12,user_low:me,user_high:peer,sender_id:peer,body:'Already open',created_at:new Date().toISOString()});
 },{me:ME,peer:PEER});
 await pause(200);
 assert.equal(await page.locator('#dm-message-notice').count(),0,'no toast while actively reading same thread');
 await mkdir('p0-smoke-artifacts',{recursive:true});
 await page.screenshot({path:'p0-smoke-artifacts/dm-unread-mobile-375.png'});
 assert.deepEqual(errors,[],'browser runtime errors: '+JSON.stringify(errors));
 console.log('PASS: recipient receives alert, purple counters, correct chat link, dedupe and read acknowledgment');
 await context.close();
}finally{
 await browser?.close();
 if(server)server.kill('SIGTERM');
}
