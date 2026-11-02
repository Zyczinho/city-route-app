import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
for (const p of ['index.html','styles.css','app.js','core.js','i18n.js','data','assets','manifest.webmanifest','service-worker.js','_headers']) await cp(p,`dist/${p}`,{recursive:true});
