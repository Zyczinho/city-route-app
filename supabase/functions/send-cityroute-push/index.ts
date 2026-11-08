// Supabase Edge Function: Web Push is invoked by signed private DB webhook, never from public client.
// VAPID private key and hook secret are in encrypted Vault, available only to service_role via RPC.
// The OS payload has no DM or group message body, only the event's kind and safe deep link.
import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';

const BASE='https://city-route-app.jakublojek.workers.dev/';
const PROJECT_URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(PROJECT_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const equals=(a,b)=>a.length===b.length&&[...a].reduce((bad,char,i)=>bad|(char.charCodeAt(0)^b.charCodeAt(i)),0)===0;
const json=(obj,code=200)=>new Response(JSON.stringify(obj),{status:code,headers:{'content-type':'application/json','cache-control':'no-store'}});
function allowedEndpoint(value){
 try{
  const u=new URL(value);
  const host=u.hostname.toLowerCase();
  return u.protocol==='https:'&&(
   host==='fcm.googleapis.com'||
   host==='updates.push.services.mozilla.com'||
   host==='updates.push.services.mozilla.org'||
   host==='web.push.apple.com'||
   host==='push.apple.com'||
   host.endsWith('.push.apple.com')
  )&&u.username===''&&u.password==='';
 }catch{return false;}
}
const TITLES={
 direct_message:['Nowa wiadomość','Znajomy napisał do Ciebie w City Route.'],
 group_message:['Nowa wiadomość grupowa','W Twojej grupie pojawiła się wiadomość.'],
 friend_request:['Zaproszenie do znajomych','Ktoś chce dodać Cię do znajomych.'],
 friend_accepted:['Zaproszenie zaakceptowane','Możesz już wysłać znajomemu wiadomość.']
};
function validTarget(value){
 return typeof value==='string'&&/^#routes\/community\/(?:dm\/[0-9a-f-]{36}|chat\/[0-9a-f-]{36}|friends)$/i.test(value)
  ?value:'#routes/community/notifications';
}
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method'},405);
 let id:number,sig:string;
 try{
  const payload=await req.json();
  id=Number(payload.id);sig=String(payload.sig||'');
  if(!Number.isSafeInteger(id)||id<1||!/^[a-f0-9]{64}$/.test(sig))return json({error:'invalid'},400);
 }catch{return json({error:'json'},400);}
 // service_role never enters the browser. Credentials RPC is not executable by authenticated/anon.
 const {data:keys,error:keysError}=await admin.rpc('get_push_server_credentials');
 if(keysError||!keys?.hook_secret||!keys?.vapid_public||!keys?.vapid_private)return json({error:'config'},503);
 const secret=encoder.encode(keys.hook_secret);
 const hmacKey=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=hex(new Uint8Array(await crypto.subtle.sign('HMAC',hmacKey,encoder.encode(String(id)))));
 if(!equals(digest,sig))return json({error:'unauthorized'},401);

 // Atomic at-most-once claim: duplicate pg_net attempts cannot cause repeat OS alerts.
 const {data:claim,error:claimError}=await admin.from('activity_notifications')
  .update({push_dispatched_at:new Date().toISOString()}).eq('id',id).is('push_dispatched_at',null)
  .select('id,recipient_id,kind,target_hash').maybeSingle();
 if(claimError)return json({error:'claim'},503);
 if(!claim)return json({ok:true,already_dispatched:true});
 const {data:subs,error:subsError}=await admin.from('push_subscriptions')
  .select('id,endpoint,p256dh,auth').eq('user_id',claim.recipient_id).limit(30);
 if(subsError)return json({error:'subscriptions'},503);
 const [title,body]=TITLES[claim.kind as keyof typeof TITLES]||['City Route','Nowa aktywność'];
 const url=new URL(BASE);url.hash=validTarget(claim.target_hash);
 const content=JSON.stringify({title,body,url:url.href,tag:'city-route-activity-'+claim.id});
 webpush.setVapidDetails(BASE,keys.vapid_public,keys.vapid_private);
 let accepted=0,expired=0;
 await Promise.all((subs||[]).map(async subscription=>{
  if(!allowedEndpoint(subscription.endpoint))return;
  try{
   await webpush.sendNotification(
    {endpoint:subscription.endpoint,expirationTime:null,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
    content,{TTL:3600,urgency:'normal'}
   );
   accepted++;
  }catch(error){
   if(error?.statusCode===404||error?.statusCode===410){
    expired++;
    await admin.from('push_subscriptions').delete().eq('id',subscription.id);
   }
  }
 }));
 return json({ok:true,accepted,expired});
});
