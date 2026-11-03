// Route Builder v1 state model (see ROUTE_BUILDER.md). Pure and deterministic: no DOM, storage, network or clock.
// Every operation returns {draft, changed, error?}; an unchanged result returns the same draft object.

export const DRAFT_VERSION=1;
export const MAX_STOPS=20;
export const MAX_NAME=80;
export const TRANSPORTS=['walking','bike','transit','mix'];

const freeze=d=>Object.freeze({...d,stops:Object.freeze([...d.stops])});
const same=draft=>({draft,changed:false});
const fail=(draft,error)=>({draft,changed:false,error});
const idOf=v=>typeof v==='string'||typeof v==='number'?String(v).trim():typeof v?.id==='string'||typeof v?.id==='number'?String(v.id).trim():'';
const next=(draft,patch,now)=>({draft:freeze({...draft,...patch,revision:draft.revision+1,updatedAt:now??draft.updatedAt}),changed:true});

export function createDraft(cityId,{name='',transport='walking',now=null}={}){
  if(!cityId||typeof cityId!=='string')throw new Error('route-builder-city-missing');
  return freeze({version:DRAFT_VERSION,cityId,stops:[],name:cleanName(name),transport:TRANSPORTS.includes(transport)?transport:'walking',revision:0,updatedAt:now});
}

// raw: stop-id array (today's basketsByCity entry), a serialized draft, or anything else.
// isKnown(id) decides whether an ID still exists in this city's catalogue (defaults to accepting all).
export function hydrateDraft(raw,{cityId,isKnown=()=>true,now=null}={}){
  const meta=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const list=Array.isArray(raw)?raw:Array.isArray(meta.stops)?meta.stops:[];
  // A draft stored for another city is refused whole: its stops and its metadata (name, transport, revision, updatedAt).
  if(meta.cityId&&meta.cityId!==cityId)return {draft:createDraft(cityId,{now}),report:{dropped:list.map(idOf).filter(Boolean),deduped:[],crossCity:true}};
  const base=createDraft(cityId,{name:meta.name,transport:meta.transport,now:meta.updatedAt??now});
  const stops=[],dropped=[],deduped=[];
  for(const v of list){
    const id=idOf(v);
    if(!id||!isKnown(id)){if(id)dropped.push(id);continue;}
    if(stops.includes(id)){deduped.push(id);continue;}
    if(stops.length>=MAX_STOPS){dropped.push(id);continue;}
    stops.push(id);
  }
  const revision=Number.isInteger(meta.revision)&&meta.revision>=0?meta.revision:0;
  return {draft:freeze({...base,stops,revision}),report:{dropped,deduped,crossCity:false}};
}

// place: a place object (cityId checked when present) or a bare id.
export function addStop(draft,place,{at=null,now=null}={}){
  const id=idOf(place);
  if(!id)return fail(draft,'invalid');
  if(place&&typeof place==='object'&&place.cityId&&place.cityId!==draft.cityId)return fail(draft,'cross-city');
  if(draft.stops.includes(id))return fail(draft,'duplicate');
  if(draft.stops.length>=MAX_STOPS)return fail(draft,'limit');
  const stops=[...draft.stops];
  const i=Number.isInteger(at)?Math.max(0,Math.min(at,stops.length)):stops.length;
  stops.splice(i,0,id);
  return next(draft,{stops},now);
}

export function removeStop(draft,id,{now=null}={}){
  const key=idOf(id);if(!draft.stops.includes(key))return same(draft);
  return next(draft,{stops:draft.stops.filter(x=>x!==key)},now);
}

export function moveStop(draft,id,toIndex,{now=null}={}){
  const key=idOf(id),from=draft.stops.indexOf(key);
  if(from<0||!Number.isFinite(Number(toIndex)))return same(draft);
  const to=Math.max(0,Math.min(Math.trunc(Number(toIndex)),draft.stops.length-1));
  if(to===from)return same(draft);
  const stops=[...draft.stops];stops.splice(to,0,stops.splice(from,1)[0]);
  return next(draft,{stops},now);
}

export const moveStopBy=(draft,id,delta,opts)=>{
  const from=draft.stops.indexOf(idOf(id));
  return from<0?same(draft):moveStop(draft,id,from+Math.trunc(Number(delta)||0),opts);
};

// Drop onto a target row: the moved stop takes the target's current index, exactly like core.moveStop(ids, from, to).
// Moving up lands it before the target; moving down lands it after the target. Drag hit-testing must pick the
// target row accordingly (ROUTE_BUILDER.md → Reorder by pointer or touch).
export function moveStopToTargetIndex(draft,id,targetId,opts){
  const to=draft.stops.indexOf(idOf(targetId));
  return to<0?same(draft):moveStop(draft,id,to,opts);
}

export const clearDraft=(draft,{now=null}={})=>draft.stops.length?next(draft,{stops:[]},now):same(draft);

const cleanName=v=>String(v??'').replace(/\s+/g,' ').trim().slice(0,MAX_NAME);
export function setName(draft,name,{now=null}={}){
  const value=cleanName(name);return value===draft.name?same(draft):next(draft,{name:value},now);
}
export function setTransport(draft,transport,{now=null}={}){
  if(!TRANSPORTS.includes(transport))return fail(draft,'invalid');
  return transport===draft.transport?same(draft):next(draft,{transport},now);
}

export const serializeDraft=d=>({version:DRAFT_VERSION,cityId:d.cityId,stops:[...d.stops],name:d.name,transport:d.transport,revision:d.revision,updatedAt:d.updatedAt});

// Shape accepted by the existing route views and saveRoute().
export const toRoute=(d,{id='draft',name}={})=>({id,cityId:d.cityId,name:name??(d.name||'Moja trasa'),description:'',stops:[...d.stops],transport:d.transport,cats:[]});

export const hasStop=(d,id)=>d.stops.includes(idOf(id));
export const stopPosition=(d,id)=>{const i=d.stops.indexOf(idOf(id));return i<0?null:{index:i,number:i+1,total:d.stops.length};};
