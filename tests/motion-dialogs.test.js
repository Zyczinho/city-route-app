import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('sheets, dialogs and toast enter with @starting-style and keep an exit transition', async()=>{
 const css=await read('styles.css');
 assert.doesNotMatch(css,/@keyframes up\{/,'old non-interruptible sheet keyframe is gone');
 for(const sel of ['.sheet[open]','dialog:not(.sheet)[open]','dialog[open]::backdrop','#toast.show'])
  assert.ok(css.includes('@starting-style{'+sel),'missing entry state for '+sel);
 assert.match(css,/\.sheet\{transform:translateY\(100%\);transition:[^}]*display \.2s allow-discrete/);
 assert.match(css,/dialog:not\(\.sheet\)\{opacity:0;transform:scale\(\.96\)/,'centered dialogs never start from scale(0)');
 assert.match(css,/prefers-reduced-motion:reduce\)\{\r?\n \.sheet,[^}]*transform:none!important/);
});

test('live progress bar animates from the previous stop only when the stop changes', async()=>{
 const app=await read('app.js');
 assert.match(app,/from=progressFrom\(s\)/);
 assert.match(app,/--from:\$\{from\/s\.stops\.length\};--to:\$\{s\.index\/s\.stops\.length\}/);
 const src=app.match(/let progressSeen=\{id:null,index:null\};function progressFrom\(s\)\{[^\n]*\}/)[0];
 const progressFrom=new Function(src+';return progressFrom;')();
 assert.equal(progressFrom({id:'a',index:0}),0,'first render does not animate');
 assert.equal(progressFrom({id:'a',index:0}),0,'re-render on the same stop does not animate');
 assert.equal(progressFrom({id:'a',index:1}),0,'next stop animates from the previous one');
 assert.equal(progressFrom({id:'a',index:1}),1);
 assert.equal(progressFrom({id:'b',index:3}),3,'a different session does not animate');
});
