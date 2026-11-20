import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('next-stop card enters only when the stop index moves forward', async()=>{
 const app=await read('app.js');
 assert.match(app,/function liveView\(\)\{const s=state\.session,from=progressFrom\(s\),moved=from<s\.index,/);
 assert.match(app,/<article class="now\$\{moved\?' is-entering':''\}">/);
 assert.match(app,/--from:\$\{from\/s\.stops\.length\}/,'progress bar and card share one progressFrom call');
});

test('finish screen celebrates once per route session', async()=>{
 const app=await read('app.js');
 const src=app.match(/let finishSeen=null;function finishEntering\(s\)\{[^\n]*\}/)[0];
 const finishEntering=new Function(src+';return finishEntering;')();
 assert.equal(finishEntering({id:'a'}),true,'first render of a finished route celebrates');
 assert.equal(finishEntering({id:'a'}),false,'re-render (e.g. after "Polecam") stays still');
 assert.equal(finishEntering({id:'b'}),true,'the next finished route celebrates again');
 assert.match(app,/<section class="finished\$\{celebrate\?' is-celebrating':''\}">/);
});

test('live motion CSS: short entrances, light overshoot only on the finish flag, fades for reduced motion', async()=>{
 const css=await read('styles.css');
 assert.ok(css.includes('@starting-style{.now.is-entering{opacity:0;transform:translateY(8px)}}'));
 assert.ok(css.includes('@starting-style{.finished.is-celebrating .badge-big{transform:scale(.9);opacity:0}}'),'never from scale(0)');
 assert.ok(css.includes('.finished.is-celebrating>:where(.kicker,h1,h1+p){transition:'),'shared rule must use :where so the per-item delays win on specificity');
 for(const [sel,ms] of [['.kicker',60],['h1',110],['h1+p',150]])
  assert.ok(css.includes(`.finished.is-celebrating>${sel}{transition-delay:${ms}ms}`),'stagger for '+sel);
 assert.match(css,/MOTION-LIVE[\s\S]*prefers-reduced-motion:reduce\)\{\r?\n \.now\.is-entering,[^}]*transform:none!important;transition:opacity \.2s ease!important/);
});
