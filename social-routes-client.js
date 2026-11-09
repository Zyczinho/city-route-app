// Social routes data client (SOCIAL_ROUTES.md, migration 011). The only place that talks to the social RPCs.
// Takes any client with rpc(name,args) -> {data,error} (supabase-js for signed-in writes, createRestRpcClient for anonymous reads)
// and returns normalized application objects, never raw rows. No DOM, no app state.
import {hydrateDraft,MAX_STOPS} from './route-builder-model.js';

export const SORTS=['popular','top','newest'];
export const VISIBILITIES=['public','unlisted'];
const MAX_NAME=80,MAX_DESCRIPTION=500,MAX_TAGS=8,PAGE_MAX=50;

export class SocialRoutesError extends Error{
  constructor(code,detail=null,cause=null){super(detail?`${code}:${detail}`:code);this.name='SocialRoutesError';this.code=code;this.detail=detail;this.cause=cause;}
}

// Server errors -> stable codes the UI can translate (auth-required, forbidden, not-owner, unknown-stop, ...).
export function toSocialError(error){
  if(error instanceof SocialRoutesError)return error;
  const message=String(error?.message||error||'');
  const known=message.match(/\b(auth-required|route-not-found|city-not-found|not-owner|invalid-[a-z-]+|duplicate-stop|unknown-stop)(?::([^\s"]+))?/);
  if(known)return new SocialRoutesError(known[1],known[2]||null,error);
  if(error?.code==='42501'||/row-level security|permission denied/i.test(message))return new SocialRoutesError('forbidden',null,error);
  if(error?.code==='PGRST301'||/JWT/i.test(message))return new SocialRoutesError('auth-required',null,error);
  return new SocialRoutesError('network',null,error);
}

const num=v=>v==null||v===''?null:Number(v);
const int=v=>Number.isFinite(Number(v))?Math.trunc(Number(v)):0;
const list=v=>Array.isArray(v)?v.map(String):[];

export function communityRouteFromRow(row){
  if(!row||!row.id)return null;
  const tags=list(row.tags);
  return {
    id:String(row.id),uuid:String(row.id),kind:'community',type:'community',
    cityId:row.city_slug||null,name:row.name||'',description:row.description||'',
    transport:row.transport||'walking',visibility:row.visibility||'public',status:row.status||'published',
    author:{id:row.author_id||null,nickname:row.author_nickname||'Odkrywca'},
    publishedAt:row.published_at||row.created_at||null,
    forkedFrom:row.forked_from_id?{id:String(row.forked_from_id),name:row.forked_from_name||null}:null,
    stops:list(row.stops),stopCount:int(row.stop_count??list(row.stops).length),
    tags,cats:tags,
    stats:{
      saves:int(row.save_count),saves30d:int(row.saves_30d),
      ratings:int(row.rating_count),ratingAvg:int(row.rating_count)?num(row.rating_avg):null,ratings30d:int(row.ratings_30d),
      forks:int(row.fork_count),forks30d:int(row.forks_30d),popularScore:num(row.popular_score)??0
    }
  };
}

export function publicProfileFromRow(row){
  if(!row||!row.id)return null;
  return {id:String(row.id),nickname:row.nickname||'Odkrywca',bio:row.bio||'',
    socials:{instagram:row.instagram||'',tiktok:row.tiktok||'',website:row.website||''},routeCount:int(row.route_count),
    avatarPath:typeof row.avatar_path==='string'?row.avatar_path:null};
}

// Fork provenance reference for a public source: editorial routes by slug, community routes by UUID.
// Unlisted/archived community routes give none, so a public fork never reveals them (migration 011 resolves the same way).
export function forkSource(route){
  if(!route)return null;
  const community=route.kind==='community'||route.type==='community';
  if(community&&(route.visibility!=='public'||(route.status&&route.status!=='published')))return null;
  const ref=community?String(route.uuid||route.id):String(route.id||'');
  return ref&&route.cityId?{cityId:route.cityId,ref}:null;
}

// Pure: turn any visible route into a Route Builder draft for the active city. Cross-city forks are refused.
export function forkRoute(route,{cityId,isKnown=()=>true,now=null}={}){
  if(!route||!Array.isArray(route.stops))throw new SocialRoutesError('invalid-route');
  if(!cityId||(route.cityId&&route.cityId!==cityId))throw new SocialRoutesError('cross-city');
  const name=`Kopia: ${route.name||'trasa'}`.slice(0,MAX_NAME);
  const {draft,report}=hydrateDraft({cityId,stops:route.stops,name,transport:route.transport},{cityId,isKnown,now});
  const forkedFrom=forkSource(route);
  return {draft,report,forkedFrom,forkedFromRef:forkedFrom?.ref??null};
}

// Same limits as migration 011, checked before a network round-trip.
export function validatePublish({draft,description='',tags=[],visibility='public'}){
  const stops=draft?.stops||[];
  if(!draft?.cityId)return 'invalid-route';
  const name=String(draft.name||'').replace(/\s+/g,' ').trim();
  if(!name||name.length>MAX_NAME)return 'invalid-name';
  if(stops.length<2||stops.length>MAX_STOPS)return 'invalid-stop-count';
  if(new Set(stops).size!==stops.length)return 'duplicate-stop';
  if(!['walking','bike','transit','mix'].includes(draft.transport||'walking'))return 'invalid-transport';
  if(!VISIBILITIES.includes(visibility))return 'invalid-visibility';
  if(String(description||'').length>MAX_DESCRIPTION)return 'invalid-description';
  const t=[...new Set(tags||[])];
  if(t.length>MAX_TAGS||t.some(x=>!/^[a-z0-9_-]+$/.test(x)))return 'invalid-tags';
  return null;
}


/** A single profile archive without exposing private routes to the community. */
export function combineSavedRoutes({localRoutes=[],remoteRoutes=[],cityId}={}){
 const city=String(cityId||'');
 const local=(Array.isArray(localRoutes)?localRoutes:[]).filter(r=>r&&r.cityId===city&&typeof r.id==='string'&&Array.isArray(r.stops)).map(r=>({
  id:r.id,name:String(r.name||'Moja trasa'),cityId:city,kind:r.sourceKind==='editorial'?'editorial-local':'mine',
  sourceRouteId:r.sourceRouteId?String(r.sourceRouteId):null,
  savedAt:r.createdAt||'',archived:!!r.archivedAt,href:'#route/'+encodeURIComponent(r.id),local:true
 }));
 const localEditorial=new Set(local.filter(r=>r.sourceRouteId).map(r=>r.sourceRouteId));
 const remote=(Array.isArray(remoteRoutes)?remoteRoutes:[]).filter(r=>
  r&&r.cityId===city&&r.id&&r.type&&!(r.type==='editorial'&&localEditorial.has(String(r.id)))
 ).map(r=>({
  id:String(r.routeId||r.id),name:String(r.name||'Zapisana trasa'),cityId:city,
  kind:r.type==='community'?'community':'editorial',savedAt:r.savedAt||'',archived:false,local:false,
  href:r.type==='community'?'#community-route/'+encodeURIComponent(String(r.routeId)):'#route/'+encodeURIComponent(String(r.id))
 }));
 return [...local,...remote].sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
}

export function createSocialRoutesClient({client}={}){
  if(typeof client?.rpc!=='function')throw new Error('social-routes-client-missing');
  const call=async(name,args)=>{
    let res;
    try{res=await client.rpc(name,args);}catch(error){throw toSocialError(error);}
    if(res?.error)throw toSocialError(res.error);
    return res?.data;
  };
  const rows=data=>Array.isArray(data)?data:data?[data]:[];
  const scalar=data=>Array.isArray(data)?data[0]:data;
  const cityOf=(ref,citySlug)=>{if(!ref)throw new SocialRoutesError('route-not-found');return {p_city_slug:citySlug||null,p_ref:String(ref)};};

  return {
    async loadCommunityRoutes({citySlug,sort='popular',limit=20,cursor=null}={}){
      if(!citySlug)throw new SocialRoutesError('city-not-found');
      const size=Math.min(Math.max(int(limit)||20,1),PAGE_MAX),offset=Math.max(int(cursor),0);
      const data=rows(await call('community_routes',{p_city_slug:citySlug,p_sort:SORTS.includes(sort)?sort:'popular',p_limit:size,p_offset:offset}));
      const routes=data.map(communityRouteFromRow).filter(Boolean);
      return {routes,nextCursor:routes.length===size?String(offset+size):null};
    },
    async loadCommunityRoute(routeId){return communityRouteFromRow(rows(await call('community_route',{p_route_id:routeId}))[0])||null;},
    async loadAuthorRoutes({userId,citySlug=null}={}){return rows(await call('author_routes',{p_user_id:userId,p_city_slug:citySlug})).map(communityRouteFromRow).filter(Boolean);},
    async loadPublicProfile(userId){return publicProfileFromRow(rows(await call('public_profile',{p_user_id:userId}))[0]);},
    // The server reads the signed-in user from the session; userId is accepted for the spec's signature only.
    async loadSavedRoutes(){
      return rows(await call('saved_routes',{})).map(r=>({
        routeId:String(r.route_id),type:r.route_type,cityId:r.city_slug,id:String(r.public_id),name:r.name||'',savedAt:r.saved_at,
        route:r.route_type==='community'?communityRouteFromRow(r.card):null
      }));
    },
    // Saved/rated state for a page of cards in one call: Map(uuid -> {saved, rating}).
    async loadRouteMarks(routeIds=[]){
      const ids=[...new Set(routeIds.map(String))];if(!ids.length)return new Map();
      return new Map(rows(await call('my_route_marks',{p_route_ids:ids})).map(m=>[String(m.route_id),{saved:!!m.saved,rating:m.my_rating==null?null:int(m.my_rating)}]));
    },
    // ref: editorial public id (slug, needs citySlug) or community uuid. Returns the route uuid.
    async saveRoute(ref,citySlug){return String(scalar(await call('save_route',cityOf(ref,citySlug))));},
    async unsaveRoute(ref,citySlug){return String(scalar(await call('unsave_route',cityOf(ref,citySlug))));},
    async rateRoute(ref,rating,citySlug){
      const value=Number(rating);if(!Number.isInteger(value)||value<1||value>5)throw new SocialRoutesError('invalid-rating');
      return String(scalar(await call('rate_route',{...cityOf(ref,citySlug),p_rating:value})));
    },
    async removeRating(ref,citySlug){return String(scalar(await call('remove_rating',cityOf(ref,citySlug))));},
    async saveFeedback(ref,feedback,citySlug){
      const note=String(feedback||'').trim();if(note.length>500)throw new SocialRoutesError('invalid-feedback');
      return String(scalar(await call('set_route_feedback',{...cityOf(ref,citySlug),p_feedback:note})));
    },
    async loadAuthorFeedback(routeId){
      return rows(await call('my_route_feedback',{p_route_id:String(routeId)})).map(r=>({
        rating:int(r.rating),feedback:String(r.feedback||''),createdAt:r.created_at
      }));
    },
    // forkedFrom: forkRoute()'s {cityId, ref} or a bare ref (editorial slug / community UUID); forkedFromRouteId kept as an alias.
    async publishRoute({draft,description='',tags=[],visibility='public',editingRouteId=null,forkedFrom=null,forkedFromRouteId=null}={}){
      const source=typeof forkedFrom==='string'?forkedFrom:forkedFrom?.ref??forkedFromRouteId??null;
      const invalid=validatePublish({draft,description,tags,visibility});if(invalid)throw new SocialRoutesError(invalid);
      return String(scalar(await call('publish_community_route',{
        p_city_slug:draft.cityId,p_name:String(draft.name).replace(/\s+/g,' ').trim(),p_stops:[...draft.stops],p_transport:draft.transport||'walking',
        p_description:String(description||''),p_tags:[...new Set(tags||[])],p_visibility:visibility,
        p_route_id:editingRouteId||null,p_forked_from:source?String(source):null
      })));
    },
    async archiveRoute(routeId){return String(scalar(await call('archive_community_route',{p_route_id:routeId})));},
    async deleteOwnedRoute(routeId){return String(scalar(await call('delete_community_route',{p_route_id:routeId})));},
    forkRoute
  };
}
