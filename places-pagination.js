// Places catalogue pagination: render and enrich only the current slice.
export const PLACES_PAGE_SIZE=30;
export function paginatePlaces(places,page=1,pageSize=PLACES_PAGE_SIZE){
 const all=Array.isArray(places)?places:[];
 const size=Number.isInteger(pageSize)&&pageSize>0?Math.min(pageSize,100):PLACES_PAGE_SIZE;
 const total=all.length,pages=Math.max(1,Math.ceil(total/size));
 const requested=Number(page),current=Number.isSafeInteger(requested)?Math.max(1,Math.min(pages,requested)):1;
 const index=(current-1)*size;
 return {items:all.slice(index,index+size),page:current,pages,size,total,
  start:total?index+1:0,end:Math.min(total,index+size),
  hasPrev:current>1,hasNext:current<pages};
}
export function paginationWindow(page,pages){
 const max=Math.max(1,Math.floor(Number(pages)||1));
 const current=Math.min(max,Math.max(1,Math.floor(Number(page)||1)));
 if(max<=5)return Array.from({length:max},(_,i)=>i+1);
 const visible=new Set([1,max]);
 for(let i=Math.max(1,current-1);i<=Math.min(max,current+1);i++)visible.add(i);
 const ordered=[...visible].sort((a,b)=>a-b),result=[];
 for(let i=0;i<ordered.length;i++){
  if(i&&ordered[i]-ordered[i-1]>1)result.push('…');
  result.push(ordered[i]);
 }
 return result;
}

// "Polecane": own places and editorial highlights first, then places with verified
// provider counts / existing licensed images. Never invent a rating for OSM-only rows.
const validRatings=place=>(Array.isArray(place?.ratings)?place.ratings:[])
 .filter(r=>Number.isFinite(r?.value)&&Number.isFinite(r?.max)&&r.max>0&&Number.isSafeInteger(r?.reviewCount)&&r.reviewCount>0);
const quality=place=>{
 const ratings=validRatings(place),reviews=ratings.reduce((sum,r)=>sum+r.reviewCount,0);
 const prior=4.3,weight=200;
 const score=reviews?(prior*weight+ratings.reduce((sum,r)=>sum+r.value/r.max*5*r.reviewCount,0))/(weight+reviews):0;
 return {reviews,score,photo:!!place?.image||!!place?.image_url};
};
export function compareRecommendedPlaces(a,b){
 const owner=(p)=>p?.kind==='user'?1:0;
 if(owner(a)!==owner(b))return owner(b)-owner(a);
 const highlighted=(p)=>p?.top?1:0;
 if(highlighted(a)!==highlighted(b))return highlighted(b)-highlighted(a);
 const A=quality(a),B=quality(b);
 if(!!A.reviews!==!!B.reviews)return B.reviews?1:-1;
 if(A.photo!==B.photo)return B.photo?1:-1;
 if(Math.abs(A.score-B.score)>0.0001)return B.score-A.score;
 if(A.reviews!==B.reviews)return B.reviews-A.reviews;
 const latest=String(b?.createdAt||'').localeCompare(String(a?.createdAt||''));
 return latest||String(a?.name||a?.id||'').localeCompare(String(b?.name||b?.id||''),'pl');
}
