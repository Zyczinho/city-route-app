// iOS Home Screen PWA (16.4+) and desktop Web Push opt-in.
// Never expose VAPID private key, service_role or subscription keys to other users.
import {supabase} from './supabase-client.js';
function supportsPush(){
 return typeof Notification!=='undefined'&&
  typeof navigator!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window;
}
export function webPushControls(){
 if(!supportsPush())return '<p class="fine">Powiadomienia przy zamkniętej aplikacji: zainstaluj City Route na ekranie głównym iPhone’a (iOS 16.4+) albo skorzystaj z przeglądarki obsługującej Web Push.</p>';
 if(Notification.permission==='denied')return '<p class="fine">Powiadomienia są zablokowane w ustawieniach systemu. Odblokuj je dla City Route.</p>';
 return '<div class="webpush-controls"><button type="button" class="button webpush-optin" data-enable-web-push>Włącz powiadomienia także po zamknięciu</button><p class="fine" data-webpush-status role="status">Powiadomienia są opcjonalne. Nie wysyłamy treści prywatnych wiadomości na ekran blokady.</p></div>';
}
function applicationServerKey(base64url){
 const normalized=String(base64url||'').replaceAll('-','+').replaceAll('_','/');
 const binary=atob(normalized+'='.repeat((4-normalized.length%4)%4));
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function subscribeToPush(){
 if(!supportsPush())throw Error('unsupported');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.user?.id)throw Error('auth-required');
 // Permission must originate directly from the user's tap.
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')throw Error('permission-denied');
 const {data:key,error:keyError}=await supabase.rpc('get_push_vapid_public_key');
 if(keyError||typeof key!=='string'||key.length<80)throw Error('push-not-configured');
 const registration=await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription){
  subscription=await registration.pushManager.subscribe({
   userVisibleOnly:true,applicationServerKey:applicationServerKey(key)
  });
 }
 const record=subscription.toJSON(),endpoint=String(record.endpoint||'');
 if(!endpoint||!record.keys?.p256dh||!record.keys?.auth)throw Error('subscription-invalid');
 const {error}=await supabase.from('push_subscriptions').insert({
  user_id:session.user.id,endpoint,p256dh:record.keys.p256dh,auth:record.keys.auth
 });
 if(error?.code==='23505'){
  const {data:existing}=await supabase.from('push_subscriptions').select('id').eq('user_id',session.user.id).eq('endpoint',endpoint).maybeSingle();
  if(!existing)throw Error('subscription-owned-by-another-account');
 }else if(error)throw error;
 return true;
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-enable-web-push]');if(!button)return;
 const note=button.parentElement?.querySelector('[data-webpush-status]');
 button.disabled=true;
 if(note)note.textContent='Konfigurujemy powiadomienia…';
 try{
  await subscribeToPush();
  if(note)note.textContent='Powiadomienia włączone. Zobaczysz je również po zamknięciu zainstalowanej aplikacji.';
  button.textContent='Powiadomienia włączone';
 }catch(error){
  const code=error?.message||'unavailable';
  if(note)note.textContent=code==='permission-denied'?'Aby włączyć powiadomienia, zezwól na nie w systemie.':
   code==='auth-required'?'Zaloguj się przed włączeniem powiadomień.':
   code==='push-not-configured'?'Usługa Web Push nie jest jeszcze skonfigurowana na serwerze.':
   'Nie udało się zarejestrować urządzenia. Sprawdź, czy City Route jest zainstalowane jako aplikacja.';
  button.disabled=false;
 }
});
// Stop delivery to this device on logout (the server clears expired endpoints on 404/410).
supabase.auth.onAuthStateChange((event)=>{
 if(event!=='SIGNED_OUT'||!supportsPush())return;
 navigator.serviceWorker.ready.then(reg=>reg.pushManager.getSubscription()).then(sub=>sub?.unsubscribe()).catch(()=>{});
});
