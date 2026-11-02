import {readFile,writeFile} from 'node:fs/promises';
const path='scripts/generate-osm-city-dataset.mjs';
let s=await readFile(path,'utf8');
const old=`async function geocodeAnchor(anchor){
  const exact=candidates.filter(p=>fold(p.name)===fold(anchor.name)).sort((a,b)=>hav(city.center,a)-hav(city.center,b))[0];
  if(exact)return {lat:exact.lat,lng:exact.lng,source:exact.metadata.source};
  const params=new URLSearchParams({q:anchor.query,format:'jsonv2',limit:'1',countrycodes:city.countryCode.toLowerCase()});
  const result=await fetchJson(\`https://nominatim.openstreetmap.org/search?\${params.toString()}\`);
  await sleep(1100);
  if(!result[0])throw new Error(\`Could not geocode anchor: \${anchor.id} (\${anchor.query})\`);
  const r=result[0];
  return {lat:Number(r.lat),lng:Number(r.lon),source:{provider:'nominatim-openstreetmap',osmType:r.osm_type||null,id:r.osm_id||null,url:r.osm_type&&r.osm_id?\`https://www.openstreetmap.org/\${r.osm_type}/\${r.osm_id}\`:null}};
}`;
const next=`async function geocodeAnchor(anchor){
  const wanted=new Set(fold(anchor.name).split(' ').filter(x=>x.length>2));
  const ranked=candidates.map(p=>{
    const have=new Set(fold(p.name).split(' ').filter(x=>x.length>2));
    const overlap=[...wanted].filter(x=>have.has(x)).length;
    const similarity=overlap/Math.max(1,Math.min(wanted.size,have.size));
    const categoryBonus=p.categoryId===anchor.categoryId?0.35:0;
    return {p,rank:similarity+categoryBonus-distancePenalty(p)};
  }).filter(x=>x.rank>=0.7).sort((a,b)=>b.rank-a.rank);
  if(ranked[0])return {lat:ranked[0].p.lat,lng:ranked[0].p.lng,source:ranked[0].p.metadata.source};
  const addressOnly=String(anchor.query||'').replace(anchor.name,'').replace(/^\\s*[,;-]?\\s*|\\s*[,;-]?\\s*$/g,'').trim();
  const queries=[anchor.query,addressOnly&&\`\${addressOnly}, \${city.name}\`,\`\${anchor.name}, \${city.name}, \${city.country}\`];
  for(const query of [...new Set(queries.filter(Boolean))]){
    const params=new URLSearchParams({q:query,format:'jsonv2',limit:'3',countrycodes:city.countryCode.toLowerCase()});
    const result=await fetchJson(\`https://nominatim.openstreetmap.org/search?\${params.toString()}\`);
    await sleep(1100);
    const inCity=(result||[]).map(r=>({r,d:hav(city.center,{lat:Number(r.lat),lng:Number(r.lon)})})).filter(x=>x.d<=city.radiusKm).sort((a,b)=>a.d-b.d)[0];
    if(inCity){const r=inCity.r;return {lat:Number(r.lat),lng:Number(r.lon),source:{provider:'nominatim-openstreetmap',osmType:r.osm_type||null,id:r.osm_id||null,url:r.osm_type&&r.osm_id?\`https://www.openstreetmap.org/\${r.osm_type}/\${r.osm_id}\`:null}};}
  }
  throw new Error(\`Could not geocode anchor: \${anchor.id} (\${anchor.query})\`);
}`;
if(!s.includes(old))throw new Error('Expected geocodeAnchor block not found');
const marker="const candidates=[...byName.values()];";
if(!s.includes('const distancePenalty='))s=s.replace(marker,`${marker}\nconst distancePenalty=p=>Math.min(0.45,hav(city.center,p)/80);`);
s=s.replace(old,next);
await writeFile(path,s);
console.log('Patched resilient anchor resolver.');
