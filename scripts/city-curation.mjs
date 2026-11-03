// Editorial curation layer for generated city catalogues.
// The OSM generator produces a broad snapshot; curation.json records the human decisions on top of it
// (removed records, corrected categories, areas, names, tags, descriptions) so they survive regeneration.
// Curated anchors in anchors.json always win over the generated copy of the same id.

export const minutesFor=c=>({museum:75,gallery:60,viewpoint:35,landmark:25,architecture:20,neighborhood:30,religious_site:30,park:40,garden:45,restaurant:75,cafe:35,breakfast:45,street_food:25,food_hall:45,bakery:20,dessert:20,bar:60,pub:60,cocktail_bar:75,wine_bar:60,club:120,live_music:120,hotel:0,hostel:0,guesthouse:0,apartment:0}[c]??30);
export const foodFor=c=>['restaurant'].includes(c)?'sit':['cafe','breakfast','street_food','food_hall','bakery','dessert'].includes(c)?'quick':'none';

const sourceRef=s=>s?.type&&s?.id!=null?`${s.type}/${s.id}`:s?.osmType&&s?.id!=null?`${s.osmType}/${s.id}`:null;
const osmSource=ref=>{const [type,id]=String(ref).split('/');return {provider:'openstreetmap',type,id:Number(id),url:`https://www.openstreetmap.org/${type}/${id}`};};
const FIELDS=['name','categoryId','area','description','minutes','tourist','foodStyle','top','website','lat','lng'];

// Tags: generated OSM tags are cleaned by global rules (rename/drop/category defaults), then per-place addTags/removeTags;
// an explicit override.tags replaces everything. Rules are idempotent so the snapshot can be re-curated safely.
function curatedTags(p,o={},rules={},warn){
  if(Array.isArray(o.tags))return o.tags;
  const out=[];
  for(const t of p.tags||[]){const r=rules.rename?.[t];out.push(...(r===undefined?[t]:[].concat(r)));}
  const drop=new Set([...(rules.drop||[]),...(o.removeTags||[]),p.categoryId]);
  const tags=[...new Set([...out,...(rules.categoryTags?.[p.categoryId]||[]),...(o.addTags||[])])].filter(t=>!drop.has(t));
  const max=rules.maxTags||6;
  if(tags.length>max)warn(`${p.id} has ${tags.length} tags; trim with removeTags`);
  return tags.slice(0,max);
}

// Key order of generated records, so new anchors serialise like the rest of places.json.
const RECORD={id:null,name:null,lat:null,lng:null,categoryId:null,area:'',description:'',minutes:0,cost:0,tourist:'balanced',foodStyle:'none',partner:false,top:false,tags:[],ratings:[],metadata:{}};

function anchorRecord(a,existing){
  const hasCoords=Number.isFinite(Number(a.lat))&&Number.isFinite(Number(a.lng));
  if(!existing&&!hasCoords)throw new Error(`Anchor ${a.id} is not in the generated catalogue and has no curated coordinates; run the generator`);
  const metadata={...(existing?.metadata||{}),curated:true};
  if(hasCoords)metadata.source=a.osm?osmSource(a.osm):{provider:'curated-coordinates'};
  return {
    ...RECORD,...existing,
    id:a.id,name:a.name,
    lat:hasCoords?Number(a.lat):existing.lat,lng:hasCoords?Number(a.lng):existing.lng,
    categoryId:a.categoryId,area:a.area||'',description:a.description||'',
    minutes:a.minutes||minutesFor(a.categoryId),
    tourist:a.tourist||(a.top?'must':'balanced'),
    foodStyle:foodFor(a.categoryId),top:!!a.top,tags:a.tags||[],
    metadata
  };
}

export function applyCuration(places,anchors,curation={},{validCategories,strict=false}={}){
  const warn=msg=>{if(strict)throw new Error(msg);console.warn(`curation: ${msg}`);};
  const removed=curation.removed||[],overrides=curation.overrides||{};
  const removeIds=new Set(removed.map(r=>r.id)),removeRefs=new Set(removed.map(r=>r.source).filter(Boolean));
  const byId=new Map(places.map(p=>[p.id,p]));
  let out=places.filter(p=>!removeIds.has(p.id)&&!removeRefs.has(sourceRef(p.metadata?.source)));

  const anchorIds=new Set(anchors.map(a=>a.id));
  out=out.map(p=>{
    if(anchorIds.has(p.id))return p;
    const o=overrides[p.id]||{};
    const next={...p};
    for(const k of FIELDS)if(k in o)next[k]=o[k];
    if('categoryId' in o&&!('minutes' in o))next.minutes=minutesFor(next.categoryId);
    if('categoryId' in o&&!('foodStyle' in o))next.foodStyle=foodFor(next.categoryId);
    if(next.top&&!('tourist' in o))next.tourist='must';
    next.tags=curatedTags(next,o,curation.tagRules,warn);
    return next;
  });
  for(const id of Object.keys(overrides)){
    if(anchorIds.has(id))warn(`override ${id} targets a curated anchor; edit anchors.json instead`);
    else if(!out.some(p=>p.id===id))warn(`override ${id} does not match any place`);
  }

  const index=new Map(out.map((p,i)=>[p.id,i]));
  for(const a of anchors){
    const record=anchorRecord(a,byId.get(a.id));
    if(index.has(a.id))out[index.get(a.id)]=record;else{index.set(a.id,out.length);out.push(record);}
  }
  if(validCategories)for(const p of out)if(!validCategories.has(p.categoryId))throw new Error(`Invalid category ${p.id}: ${p.categoryId}`);
  return out.sort((a,b)=>(b.top-a.top)||a.categoryId.localeCompare(b.categoryId)||a.name.localeCompare(b.name,'pl'));
}

export const categoryCounts=places=>places.reduce((n,p)=>(n[p.categoryId]=(n[p.categoryId]||0)+1,n),{});
