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
