import {readFile,writeFile} from 'node:fs/promises';
import {applyCuration,categoryCounts} from './city-curation.mjs';

// Re-applies anchors.json + curation.json to an existing places.json snapshot without querying OpenStreetMap.
const cityId=process.argv[2];
if(!cityId)throw new Error('Usage: node scripts/apply-city-curation.mjs <city-id>');
const base=`data/cities/${cityId}`;
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [places,anchors,curation,taxonomy,report]=await Promise.all([
  read(`${base}/places.json`),read(`${base}/anchors.json`),read(`${base}/curation.json`),read('data/taxonomy.json'),read(`${base}/dataset-report.json`)
]);
const validCategories=new Set(taxonomy.groups.flatMap(g=>g.types.map(t=>t.id)));
const curated=applyCuration(places,anchors,curation,{validCategories,strict:true});

await writeFile(`${base}/places.json`,JSON.stringify(curated,null,2)+'\n');
await writeFile(`${base}/dataset-report.json`,JSON.stringify({
  ...report,count:curated.length,counts:categoryCounts(curated),
  curation:{removed:(curation.removed||[]).length,overrides:Object.keys(curation.overrides||{}).length,anchors:anchors.length}
},null,2)+'\n');
console.log(`Curated ${cityId}: ${places.length} -> ${curated.length} places.`);
