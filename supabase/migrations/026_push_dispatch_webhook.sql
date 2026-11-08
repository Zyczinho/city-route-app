-- 026: asynchronous push dispatch after notification commit, authenticated with a Vault HMAC.
-- No message body or device subscription is put into the webhook payload.
create extension if not exists pg_net with schema extensions;
create or replace function private.dispatch_activity_web_push() returns trigger
language plpgsql security definer set search_path=''
as $$
declare secret text;signature text;
begin
 if not exists(select 1 from public.push_subscriptions ps where ps.user_id=new.recipient_id) then
  return new;
 end if;
 select decrypted_secret into secret from vault.decrypted_secrets
 where name='city_route_push_hook_v1' limit 1;
 if secret is null then return new;end if;
 signature:=encode(extensions.hmac(convert_to(new.id::text,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 perform net.http_post(
  url:='https://ycfhpvtsnsmzdmpvliif.supabase.co/functions/v1/send-cityroute-push',
  body:=jsonb_build_object('id',new.id,'sig',signature),
  headers:='{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds:=5000
 );
 return new;
end $$;
revoke execute on function private.dispatch_activity_web_push() from public,anon,authenticated;
drop trigger if exists on_activity_web_push on public.activity_notifications;
create trigger on_activity_web_push after insert on public.activity_notifications
 for each row execute function private.dispatch_activity_web_push();
