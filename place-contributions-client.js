// P0 PLACE-COMMUNITY-019. Pure shared-place client; all writes go through checked Supabase RPCs.
export const BUCKET='city-route-place-photos';
const ALIASES={zabytki:'landmark',muzea:'museum',zielen:'park',widoki:'viewpoint',okolice:'neighborhood',jedzenie:'restaurant'};
export const resolveCategory=place=>ALIASES[place?.cats?.[0]]||place?.categoryId||'neighborhood';

export class PlaceContributionError extends Error{
 constructor(code,cause){super(code);this.name='PlaceContributionError';this.code=code;this.cause=cause;}
}
const KNOWN=/\b(auth-required|city-not-found|invalid-name|invalid-description|invalid-url|invalid-coordinates|invalid-category|outside-city|duplicate-place|duplicate-pending|photo-rights-required|invalid-photo-path|image-not-uploaded|not-editable|already-reviewed|forbidden|submission-not-found|unknown-place|place-required|duplicate-place-use-merge)\b/;
export function contributionError(error){
 if(error instanceof PlaceContributionError)return error;
 const m=String(error?.message||error).match(KNOWN);
 return new PlaceContributionError(m?.[1]||(error?.code==='42501'?'auth-required':'network'),error);
}
export const photoPath=(userId,submissionId)=>userId+'/'+submissionId+'.jpg';
export function validateLocalPlace(place){
 if(!place||!/^u-/.test(place.id||''))return 'invalid-place';
 if((place.visibility||'private')!=='public')return 'not-shared';
 if(!place.cityId)return 'city-not-found';
 if(String(place.name||'').trim().length<2||String(place.name).trim().length>120)return 'invalid-name';
 if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng)||place.lat>90||place.lat< -90||place.lng>180||place.lng< -180)return 'invalid-coordinates';
 if(String(place.description||'').length>500)return 'invalid-description';
 return null;
}
export const contributionFromRow=row=>({
 id:row.id,cityId:row.city_slug,name:row.name,status:row.status,
 resolvedPlaceId:row.resolved_place_id||null,createdAt:row.created_at
});

export function createPlaceContributionsClient({client}={}){
 if(typeof client?.rpc!=='function')throw Error('supabase-client-required');
 const rpc=async(name,args={})=>{
  let res;try{res=await client.rpc(name,args);}catch(e){throw contributionError(e);}
  if(res?.error)throw contributionError(res.error);
  return res?.data;
 };
 return {
  async submit(place){
   const invalid=validateLocalPlace(place);if(invalid)throw new PlaceContributionError(invalid);
   return String(await rpc('create_place_submission',{
    p_city_slug:place.cityId,p_name:String(place.name).trim(),p_category_id:resolveCategory(place),
    p_lat:place.lat,p_lng:place.lng,p_description:place.description==='Twoje miejsce.'?'':place.description||'',
    p_source_url:place.photoSourcePage||place.sourceUrl||null
   }));
  },
  async uploadOwnPhoto(userId,submissionId,dataUrl,confirmed){
   if(!dataUrl||!confirmed)return {uploaded:false};
   if(!/^data:image\/jpeg;base64,/.test(dataUrl))throw new PlaceContributionError('invalid-photo-format');
   const response=await fetch(dataUrl),blob=await response.blob();
   if(blob.size>3145728)throw new PlaceContributionError('image-too-large');
   const path=photoPath(userId,submissionId);
   const {error}=await client.storage.from(BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false});
   if(error)throw contributionError(error);
   await rpc('attach_place_submission_photo',{p_submission_id:submissionId,p_image_path:path,p_confirm_rights:true});
   return {uploaded:true,path};
  },
  async mine(){return (await rpc('my_place_submissions',{})||[]).map(contributionFromRow);},
  async reviewQueue(citySlug='warsaw',status='pending'){
   return await rpc('admin_place_submissions',{p_city_slug:citySlug,p_status:status})||[];
  },
  async review(id,action,existingId=null){
   if(!['approve','reject','merge'].includes(action))throw new PlaceContributionError('invalid-action');
   return await rpc('admin_review_place_submission',{p_submission_id:id,p_action:action,p_existing_place_id:existingId||null});
  }
 };
}
