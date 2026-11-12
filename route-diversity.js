// Short subsets of an existing option are not genuinely new route proposals.
export const sharedStopFraction=(a,b)=>{
 const A=new Set(a.map(p=>typeof p==='string'?p:p?.id).filter(Boolean));
 const B=new Set(b.map(p=>typeof p==='string'?p:p?.id).filter(Boolean));
 if(!A.size||!B.size)return 0;
 return [...A].filter(id=>B.has(id)).length/Math.min(A.size,B.size);
};
export const MAX_ROUTE_SHARED_FRACTION=0.55;
export const distinctRoute=(candidate,prior,maxShared=MAX_ROUTE_SHARED_FRACTION)=>prior.every(p=>sharedStopFraction(candidate,p)<=maxShared);
