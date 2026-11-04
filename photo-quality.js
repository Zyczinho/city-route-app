// One visual-quality decision for all permitted images. It cannot determine beauty,
// exact venue identity or redistribution rights; those are separate verification gates.
const finite=v=>Number.isFinite(Number(v))?Number(v):0;
export function photoQuality(candidate,{targetRatio=1.55}={}){
 const w=finite(candidate?.widthPx??candidate?.width),h=finite(candidate?.heightPx??candidate?.height);
 if(w<=0||h<=0)return -Infinity;
 const pixels=w*h,ratio=w/h,aspect=Math.abs(Math.log(ratio/targetRatio));
 const small=Math.min(w,h)<480?1.4:Math.min(w,h)<700?.35:0;
 const ultrawide=ratio>3.2||ratio<.45?2:0;
 return Math.log2(Math.min(pixels,18_000_000))-aspect*1.9-small-ultrawide;
}
// Allowed candidates must identify an actual place and have permission or a live,
// attribution-bearing provider display grant. Public social posts alone are not grants.
export function choosePlacePhoto(candidates=[],{placeId=null}={}){
 return candidates
  .filter(c=>c&&c.displayPermitted===true&&c.src&&c.credit?.source
   &&(!placeId||!c.placeId||String(c.placeId)===String(placeId)))
  .map(c=>({...c,quality:photoQuality(c)}))
  .filter(c=>Number.isFinite(c.quality))
  .sort((a,b)=>b.quality-a.quality)[0]||null;
}
export function bestGooglePhoto(photos=[]){
 const ranked=(Array.isArray(photos)?photos:[])
  .map((photo,index)=>({photo,index,score:photoQuality(photo)}))
  .filter(x=>x.photo?.name&&Number.isFinite(x.score))
  .sort((a,b)=>b.score-a.score||a.index-b.index);
 return ranked[0]||null;
}
export function parsePhotoSourceUrl(value){
 try{
  const url=new URL(String(value||'').trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||!host.includes('.'))return null;
  if(url.href.length>500)return null;
  return url.href;
 }catch{return null;}
}
export function photoSourceKind(value){
 const url=parsePhotoSourceUrl(value);
 if(!url)return 'invalid';
 const host=new URL(url).hostname.replace(/^www\./,'');
 if(host==='instagram.com'||host.endsWith('.instagram.com'))return 'instagram';
 if(host==='facebook.com'||host.endsWith('.facebook.com')||host==='fb.com')return 'facebook';
 return 'website';
}
