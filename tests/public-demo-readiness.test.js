import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inAppBrowserName,inAppBrowserHint} from '../in-app-browser.js';
import {feedbackUrl} from '../feedback-config.js';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('detects social in-app browsers where Google OAuth is blocked',()=>{
 const ig='Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,3; iOS 18_1; pl_PL; pl; scale=3.00; 1290x2796)';
 const fb='Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]';
 const tiktok='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.0.0 BytedanceWebview/d8a21c6';
 assert.equal(inAppBrowserName(ig),'Instagram');
 assert.equal(inAppBrowserName(fb),'Facebook');
 assert.equal(inAppBrowserName(tiktok),'TikTok');
 assert.match(inAppBrowserHint('Instagram'),/przeglądarce Instagrama/);
});

test('regular Safari and Chrome are not treated as in-app browsers',()=>{
 assert.equal(inAppBrowserName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'),'');
 assert.equal(inAppBrowserName('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'),'');
 assert.equal(inAppBrowserHint(''),'');
});

test('Google sign-in is short-circuited in in-app browsers and e-mail signup opens',async()=>{
 const auth=await read('auth-enhancements.js');
 assert.match(auth,/if\(IN_APP_BROWSER\)\{setNotice\(/);
 assert.match(auth,/data-auth-action="copy-link"/);
 assert.match(auth,/<details class="auth-signup"\$\{IN_APP_BROWSER\?' open':''\}>/);
});

test('feedback link accepts only https and is hidden when unset',()=>{
 assert.equal(feedbackUrl(''),'');
 assert.equal(feedbackUrl('javascript:alert(1)'),'');
 assert.equal(feedbackUrl('http://forms.gle/x'),'');
 assert.equal(feedbackUrl('https://forms.gle/abc'),'https://forms.gle/abc');
});

test('feedback entry points and link preview tags ship',async()=>{
 const [app,html,build,sw]=await Promise.all(['app.js','index.html','scripts/build.mjs','service-worker.js'].map(read));
 for(const where of ['plan','profile','finished'])assert.match(app,new RegExp(`feedbackLink\\('${where}'`));
 for(const tag of ['og:title','og:description','og:image','og:url'])assert.match(html,new RegExp(`property="${tag}"`));
 assert.match(html,/og:image" content="https:\/\//);
 for(const file of ['in-app-browser.js','feedback-config.js']){
  assert.ok(build.includes(`'${file}'`),'build lacks '+file);
  assert.ok(sw.includes(`'./${file}'`),'offline cache lacks '+file);
 }
});
