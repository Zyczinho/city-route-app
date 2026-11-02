import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
for (const p of ['index.html','styles.css','auth.css','app.js','core.js','enhancements.js','auth-enhancements.js','supabase-client.js','data','assets','manifest.webmanifest','service-worker.js','_headers']) await cp(p,`dist/${p}`,{recursive:true});
