// Provider rating metadata adapter. Raw third-party review text is deliberately NOT
// persisted: licences/attribution vary by provider and market (incl. Google EEA).
// Consume licensed official API responses only. Never scrape provider websites.
const validScore=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=1&&Number(v)<=5?Number(v):null;
const validCount=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const record=(source,payload,{checked=null}={})=>{
 const value=validScore(payload?.rating),reviewCount=validCount(source==='google'?payload?.userRatingCount:payload?.num_reviews??payload?.review_count??payload?.reviewCount);
 const hasData=value!==null&&reviewCount!==null;
 const url=safeUrl(source==='google'?payload?.googleMapsUri:payload?.web_url??payload?.url);
 const title=payload?.displayName?.text??payload?.name??'';
 return {
  source,value:hasData?value:null,max:5,reviewCount:hasData?reviewCount:null,
  listing:String(title||''),url,checked,
  method:'licensed-official-api',
  ...(hasData?{}:{reason:'Brak dostępnych danych o ocenach z oficjalnego API.'})
 };
};
export function normalizeExternalRatings({google=null,tripadvisor=null}={},checked=null){
 return [record('google',google,{checked}),record('tripadvisor',tripadvisor,{checked})];
}
// Separate City Route sorting metric. A single 5★ review is visible but doesn't outrank
// a well-supported place. No global/blended Google+Tripadvisor score is modified.
export function cityRouteSortScore({average_rating=null,review_count=0,sort_score=null}={}){
 if(Number.isFinite(Number(sort_score))&&Number(review_count)>0)return Number(sort_score);
 const count=validCount(review_count),avg=validScore(average_rating);
 return count!==null&&avg!==null?(count*avg+20*4)/(count+20):null;
}
export const reviewSourcePolicy=Object.freeze({
 externalCombinedSources:['google','tripadvisor'],
 separateSource:'city_route',
 externalReviewTextsPersisted:false,
 communityMinimumForDisplay:1,
 communityPartOfExternalCombinedScore:false
});
