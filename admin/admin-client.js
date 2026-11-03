// Founder/admin data client for catalogue requests (migration 013, REQ-ADMIN-004). Pure: no DOM.
// Takes any client with rpc(name,args) -> {data,error}; the server checks the app_admins allow-list on every call.

export const ADMIN_STATUSES=['active','open','planned','added','declined','all'];
export const LIFECYCLE=['open','planned','added','declined'];
export const ADMIN_SORTS=['popular','recent','newest'];
export const KINDS=['place','category_gap'];

export class AdminError extends Error{
  constructor(code,cause=null){super(code);this.name='AdminError';this.code=code;this.cause=cause;}
}
const KNOWN=/\b(forbidden|invalid-status|place-required|unknown-place|request-not-found|auth-required)\b/;
export function toAdminError(error){
  if(error instanceof AdminError)return error;
  const message=String(error?.message||error||'');
  const known=message.match(KNOWN);if(known)return new AdminError(known[1],error);
  if(error?.code==='42501'||/permission denied/i.test(message))return new AdminError('forbidden',error);
  if(error?.code==='PGRST301'||/JWT/i.test(message))return new AdminError('auth-required',error);
  return new AdminError('network',error);
}

const int=v=>Number.isFinite(Number(v))?Math.trunc(Number(v)):0;
export function adminRequestFromRow(r){
  if(!r||!r.id)return null;
  return {
    id:String(r.id),cityId:r.city_slug||null,kind:r.request_kind,title:r.title||'',categoryId:r.category_id||null,
    status:r.status||'open',note:r.note||'',sourceUrl:/^https?:\/\//i.test(r.source_url||'')?r.source_url:null,
    resolvedPlaceId:r.resolved_place_id||null,createdAt:r.created_at||null,updatedAt:r.updated_at||null,
    supports:int(r.support_count),supports30d:int(r.supports_30d),lastSupportedAt:r.last_supported_at||null
  };
}

// CSV for the founder's spreadsheet. Cells that a spreadsheet would run as a formula (= + - @, tab, CR) get a
// leading apostrophe, so a user-written title can never execute in Excel/Sheets.
const CSV_COLUMNS=[['title','Tytuł'],['kind','Rodzaj'],['categoryId','Kategoria'],['status','Status'],['supports','Wsparcia'],
  ['supports30d','Wsparcia 30 dni'],['lastSupportedAt','Ostatnie wsparcie'],['createdAt','Utworzono'],['note','Notatka'],
  ['sourceUrl','Link'],['resolvedPlaceId','Dodane miejsce'],['id','ID']];
const cell=v=>{
  let s=v==null?'':String(v);
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return /[",\n\r;]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
};
export const requestsToCsv=rows=>[CSV_COLUMNS.map(([,h])=>cell(h)).join(','),...rows.map(r=>CSV_COLUMNS.map(([k])=>cell(r[k])).join(','))].join('\r\n')+'\r\n';

export function createAdminRequestsClient({client}={}){
  if(typeof client?.rpc!=='function')throw new Error('admin-client-missing');
  const call=async(name,args)=>{
    let res;
    try{res=await client.rpc(name,args);}catch(error){throw toAdminError(error);}
    if(res?.error)throw toAdminError(res.error);
    return res?.data;
  };
  return {
    async isAdmin(){try{return (await call('is_app_admin',{}))===true;}catch(error){if(['forbidden','auth-required'].includes(error.code))return false;throw error;}},
    async loadRequests({citySlug,kind=null,category=null,status='active',sort='popular',limit=100,offset=0}={}){
      if(!citySlug)throw new AdminError('city-not-found');
      const data=await call('admin_catalogue_requests',{
        p_city_slug:citySlug,p_kind:KINDS.includes(kind)?kind:null,p_category:category||null,
        p_status:ADMIN_STATUSES.includes(status)?status:'active',p_sort:ADMIN_SORTS.includes(sort)?sort:'popular',
        p_limit:Math.min(Math.max(int(limit)||100,1),500),p_offset:Math.max(int(offset),0)
      });
      return (Array.isArray(data)?data:[]).map(adminRequestFromRow).filter(Boolean);
    },
    // resolvedPlace: public place id (slug) in the request's city; required for 'added', dropped otherwise.
    async setStatus(requestId,status,resolvedPlace=null){
      if(!LIFECYCLE.includes(status))throw new AdminError('invalid-status');
      const place=status==='added'?String(resolvedPlace||'').trim()||null:null;
      if(status==='added'&&!place)throw new AdminError('place-required');
      return String(await call('admin_set_catalogue_request_status',{p_request_id:requestId,p_status:status,p_resolved_place:place}));
    }
  };
}
