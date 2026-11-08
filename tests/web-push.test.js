import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
test('Push subscriptions are owner-only and server credentials are service-role-only',async()=>{
 const sql=await read('supabase/migrations/025_push_subscriptions.sql');
 for(const marker of ['push_subscriptions_owner_read','push_subscriptions_owner_insert',
  'push_subscriptions_owner_delete','enable row level security','user_id=(select auth.uid())',
  'vault.decrypted_secrets','get_push_vapid_public_key','get_push_server_credentials',
  'grant execute on function public.get_push_server_credentials() to service_role'])assert.ok(sql.includes(marker),marker);
 assert.ok(!sql.includes('VAPID_PRIVATE_KEY='));
 assert.ok(!sql.includes('grant execute on function public.get_push_server_credentials() to authenticated'));
});
test('Service worker supports authenticated Web Push and routes only within City Route',async()=>{
 const [sw,client,center,html,build]=await Promise.all(['service-worker.js','web-push-client.js','activity-notifications.js','index.html','scripts/build.mjs'].map(read));
 for(const token of ["self.addEventListener('push'","self.registration.showNotification","notificationclick","#routes/community/notifications"])assert.ok(sw.includes(token),token);
 for(const token of ['pushManager.subscribe','applicationServerKey','get_push_vapid_public_key','push_subscriptions','requestPermission'])assert.ok(client.includes(token),token);
 assert.ok(center.includes('data-enable-web-push'));
 assert.ok(html.includes('web-push-client.js'));
 assert.ok(build.includes("'web-push-client.js'"));
});
test('Webhook authentication, exact source events and subscription host allowlist are server controlled',async()=>{
 const [webhook,edge]=await Promise.all(['supabase/migrations/026_push_dispatch_webhook.sql','supabase/functions/send-cityroute-push/index.ts'].map(read));
 for(const s of ['extensions.hmac','vault.decrypted_secrets','net.http_post','activity_notifications','pg_net'])assert.ok(webhook.includes(s),s);
 for(const s of ['get_push_server_credentials','crypto.subtle','sendNotification','push_subscriptions','push_dispatched_at','service_role'])assert.ok(edge.includes(s),s);
 assert.ok(edge.includes('push.apple.com'));
 assert.ok(!edge.includes('console.log(secret'));
});
