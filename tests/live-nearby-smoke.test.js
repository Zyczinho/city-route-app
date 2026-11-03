import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../supabase-config.js';

const cases=[
  {city:'warsaw',lat:52.23184,lng:21.00699,label:'Warsaw centre'},
  {city:'krakow',lat:50.06143,lng:19.93658,label:'Kraków Rynek'}
];

for(const c of cases){
 test(`hosted Nearby RPC works for ${c.label}`,async()=>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalogue_nearby_places`,{
   method:'POST',
   headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},
   body:JSON.stringify({p_city_slug:c.city,p_lat:c.lat,p_long:c.lng,p_radius_m:500,p_max_results:50,p_category_ids:null})
  });
  const text=await response.text();
  assert.equal(response.ok,true,`${c.label}: HTTP ${response.status} ${text}`);
  const rows=JSON.parse(text);
  assert.ok(Array.isArray(rows)&&rows.length>0,`${c.label}: expected nearby places`);
  console.log(`${c.city}: ${rows.length} results`,rows.slice(0,12).map(r=>`${r.name}=${Math.round(Number(r.dist_meters))}m`).join(' | '));
  const ids=new Set();let previous=-1;
  for(const row of rows){
   assert.equal(typeof row.id,'string');assert.ok(row.id);
   assert.equal(ids.has(row.id),false,`duplicate ${row.id}`);ids.add(row.id);
   const d=Number(row.dist_meters);assert.ok(Number.isFinite(d)&&d>=0&&d<=500.5,`bad distance ${row.id}: ${row.dist_meters}`);
   assert.ok(d+0.01>=previous,`not sorted: previous ${previous.toFixed(2)}m then ${d.toFixed(2)}m at ${row.name}`);previous=d;
  }
 });
}
