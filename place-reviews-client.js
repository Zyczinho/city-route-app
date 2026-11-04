import {cityRouteSortScore} from './review-source-model.js';
// City Route ratings are server-side, unverified and never part of Google+TA score.
export class PlaceReviewError extends Error{constructor(code,cause){super(code);this.code=code;this.cause=cause;}}
export function createPlaceReviewsClient(client){
 if(typeof client?.rpc!=='function')throw new PlaceReviewError('missing-client');
 const rpc=async(name,args)=>{
  const {data,error}=await client.rpc(name,args);
  if(error)throw new PlaceReviewError(error.message||'network',error);
  return data;
 };
 return {
  async scores(citySlug){
   const rows=await rpc('city_route_place_scores',{p_city_slug:citySlug})||[];
   return new Map(rows.map(r=>[String(r.place_ref),{
     reviewCount:Number(r.review_count)||0,
     average:Number.isFinite(Number(r.average_rating))?Number(r.average_rating):null,
     sortScore:cityRouteSortScore(r)
   }]));
  },
  async rate(citySlug,placeRef,rating,feedback=''){
   if(!Number.isInteger(Number(rating))||Number(rating)<1||Number(rating)>5)throw new PlaceReviewError('invalid-rating');
   return rpc('rate_visited_place',{p_city_slug:citySlug,p_ref:String(placeRef),p_rating:Number(rating),p_feedback:String(feedback).slice(0,500)});
  }
 };
}
