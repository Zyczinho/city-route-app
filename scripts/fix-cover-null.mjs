import {readFile,writeFile} from 'node:fs/promises';
let app=await readFile('app.js','utf8');
const from="function credit(p){const c=p.imageCredit;";
const to="function credit(p){const c=p?.imageCredit;";
if(!app.includes(from))throw new Error('credit pattern missing');
app=app.replace(from,to);
await writeFile('app.js',app);
let test=await readFile('tests/cover-wiring.test.js','utf8');
const marker=" assert.match(app,/\\$\\{credit\\(cover\\)\\}/);\n";
if(!test.includes(marker))throw new Error('test marker missing');
test=test.replace(marker,marker+" assert.match(app,/function credit\\(p\\)\\{const c=p\\?\\.imageCredit/,'missing cover must not crash attribution');\n");
await writeFile('tests/cover-wiring.test.js',test);
// One-shot branch helper; removed before PR.
