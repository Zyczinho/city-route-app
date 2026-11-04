// Catalogue requests data client (REQUESTS.md, migration 012). The only place that talks to the request RPCs.
// Takes any client with rpc(name,args) -> {data,error} and returns normalized application objects, never raw rows.
// No DOM, no app state, no admin operations (status changes are a service-role/SQL step until an admin contract exists).

export const KINDS=['place','category_gap'];
export const SORTS=['popular','newest'];
// Public demand is active demand only; your own added/declined requests come from loadMyRequests().
export const STATUSES=['active','open','planned'];
const MAX_TITLE=120,MAX_NOTE=500,MAX_URL=500,PAGE_MAX=50;

export class RequestsError extends Error{
  constructor(code,detail=null,cause=null){super(detail?`${code}:${detail}`:code);this.name='RequestsError';this.code=code;this.detail=detail;this.cause=cause;}
}

const KNOWN=/\b(auth-required|city-not-found|invalid-kind|invalid-title|invalid-category|category-required|invalid-note|invalid-url|request-not-supportable|not-deletable|not-editable|creator-support-required)\b/;
export function toRequestsError(error){
  if(error instanceof RequestsError)return error;
  const message=String(error?.message||error||'');
  const known=message.match(KNOWN);if(known)return new RequestsError(known[1],null,error);
  if(error?.code==='42501'||/row-level security|permission denied/i.test(message))return new RequestsError('forbidden',null,error);
  if(error?.code==='PGRST301'||/JWT/i.test(message))return new RequestsError('auth-required',null,error);
  return new RequestsError('network',null,error);
}

// Same folding as public.catalogue_request_key() in migration 012, for client-side previews.
export const requestKey=v=>String(v??'').toLowerCase()
  .replace(/[ąćęłńóśźżäöüéèáíúàâêôçñ]/g,c=>'acelnoszzaoueeaiuaaeocn'['ąćęłńóśźżäöüéèáíúàâêôçñ'.indexOf(c)])
  .replace(/[^a-z0-9]+/g,' ').trim();

const int=v=>Number.isFinite(Number(v))?Math.trunc(Number(v)):0;
export function requestFromRow(row){
  if(!row||!row.id)return null;
  return {
    id:String(row.id),cityId:row.city_slug||null,kind:row.request_kind,title:row.title||'',
    categoryId:row.category_id||null,status:row.status||'open',resolvedPlaceId:row.resolved_place_id||null,
    createdAt:row.created_at||null,
    supports:int(row.support_count),supports30d:int(row.supports_30d),lastSupportedAt:row.last_supported_at||null,
    ...(row.similarity!=null?{similarity:Number(row.similarity)}:{})
  };
}

// Structural field validation matches migration 012; there are no per-user submission quotas.
export function validateRequest({citySlug,kind,title,categoryId=null,note='',sourceUrl=null}={}){
  if(!citySlug)return 'city-not-found';
  if(!KINDS.includes(kind))return 'invalid-kind';
  const t=String(title||'').replace(/\s+/g,' ').trim();
  if(t.length<2||t.length>MAX_TITLE||!requestKey(t))return 'invalid-title';
  if(categoryId!=null&&!/^[a-z0-9_]+$/.test(categoryId))return 'invalid-category';
  if(kind==='category_gap'&&!categoryId)return 'category-required';
  if(String(note||'').length>MAX_NOTE)return 'invalid-note';
  const url=String(sourceUrl||'').trim();
  if(url&&(url.length>MAX_URL||!/^https?:\/\//i.test(url)))return 'invalid-url';
  return null;
}

export function createRequestsClient({client}={}){
  if(typeof client?.rpc!=='function')throw new Error('requests-client-missing');
  const call=async(name,args)=>{
    let res;
    try{res=await client.rpc(name,args);}catch(error){throw toRequestsError(error);}
    if(res?.error)throw toRequestsError(res.error);
    return res?.data;
  };
  const rows=data=>Array.isArray(data)?data:data?[data]:[];
  const scalar=data=>String(Array.isArray(data)?data[0]:data);

  return {
    // Ranking for one city. status: 'active' (open+planned, default) | open | planned.
    async loadRequests({citySlug,kind=null,category=null,status='active',sort='popular',limit=20,cursor=null}={}){
      if(!citySlug)throw new RequestsError('city-not-found');
      const size=Math.min(Math.max(int(limit)||20,1),PAGE_MAX),offset=Math.max(int(cursor),0);
      const data=rows(await call('catalogue_requests_ranked',{
        p_city_slug:citySlug,p_kind:KINDS.includes(kind)?kind:null,p_category:category||null,
        p_status:STATUSES.includes(status)?status:'active',p_sort:SORTS.includes(sort)?sort:'popular',p_limit:size,p_offset:offset
      }));
      const requests=data.map(requestFromRow).filter(Boolean);
      return {requests,nextCursor:requests.length===size?String(offset+size):null};
    },
    // Likely duplicates to show before creating. Empty/too-short titles skip the network.
    async findSimilarRequests({citySlug,title,categoryId=null,kind=null,limit=5}={}){
      if(!citySlug||requestKey(title).length<2)return [];
      return rows(await call('similar_catalogue_requests',{
        p_city_slug:citySlug,p_title:String(title),p_kind:KINDS.includes(kind)?kind:null,p_category:categoryId||null,p_limit:limit
      })).map(requestFromRow).filter(Boolean);
    },
    async createRequest({citySlug,kind,title,categoryId=null,note='',sourceUrl=null}={}){
      const invalid=validateRequest({citySlug,kind,title,categoryId,note,sourceUrl});if(invalid)throw new RequestsError(invalid);
      return scalar(await call('create_catalogue_request',{
        p_city_slug:citySlug,p_kind:kind,p_title:String(title).replace(/\s+/g,' ').trim(),p_category:categoryId||null,
        p_note:String(note||''),p_source_url:String(sourceUrl||'').trim()||null
      }));
    },
    async supportRequest(requestId){return scalar(await call('support_catalogue_request',{p_request_id:requestId}));},
    async unsupportRequest(requestId){return scalar(await call('unsupport_catalogue_request',{p_request_id:requestId}));},
    async deleteMyRequest(requestId){return scalar(await call('delete_my_catalogue_request',{p_request_id:requestId}));},
    // Edit your own request while it is open and only you support it (kind and city never change).
    async updateMyRequest(requestId,{kind,title,categoryId=null,note='',sourceUrl=null}={}){
      const invalid=validateRequest({citySlug:'-',kind,title,categoryId,note,sourceUrl});if(invalid)throw new RequestsError(invalid);
      return scalar(await call('update_my_catalogue_request',{p_request_id:requestId,p_title:String(title).replace(/\s+/g,' ').trim(),p_category:categoryId||null,p_note:String(note||''),p_source_url:String(sourceUrl||'').trim()||null}));
    },
    // Profil → Twoje prośby: your requests in every status, with your own note, link and the resolved place.
    async loadMyRequests(){
      return rows(await call('my_catalogue_requests',{})).map(r=>({...requestFromRow(r),note:r.note||'',sourceUrl:r.source_url||null,canEdit:!!r.can_edit}));
    },
    // Supported/mine state for a page of cards in one call: Map(id -> {supported, mine}).
    async loadMyRequestMarks(requestIds=[]){
      const ids=[...new Set(requestIds.map(String))];if(!ids.length)return new Map();
      return new Map(rows(await call('my_catalogue_request_marks',{p_request_ids:ids})).map(m=>[String(m.request_id),{supported:!!m.supported,mine:!!m.mine}]));
    }
  };
}
