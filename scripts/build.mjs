import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
for (const p of ['index.html','styles.css','auth.css','community.css','app.js','core.js','city-context.js','catalogue-client.js','nearby-client.js','map-view.js','map.css','route-covers.js','route-builder-model.js','enhancements.js','auth-enhancements.js','community-enhancements.js','supabase-config.js','supabase-client.js','data','assets','manifest.webmanifest','service-worker.js','_headers']) await cp(p,`dist/${p}`,{recursive:true});
