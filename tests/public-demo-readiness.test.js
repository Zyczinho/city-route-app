import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('public demo hides Google sign-in and keeps e-mail sign-in',async()=>{
 const auth=await read('auth-enhancements.js');
 assert.match(auth,/const GOOGLE_LOGIN_VISIBLE=false;/);
 assert.match(auth,/\$\{GOOGLE_LOGIN_VISIBLE\?`<button type="button" class="google-auth-button"/);
 assert.match(auth,/data-auth-form="login"/);
 assert.match(auth,/data-auth-form="signup"/);
});

test('link preview tags ship with an absolute image',async()=>{
 const html=await read('index.html');
 for(const tag of ['og:title','og:description','og:image','og:url'])assert.match(html,new RegExp(`property="${tag}"`));
 assert.match(html,/og:image" content="https:\/\//);
});
