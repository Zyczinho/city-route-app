// BETA-GALLERY-058: local-first multi-photo editor. Public backend currently publishes cover only.
// Crop always derives from a retained, resized source; editing is non-destructive.
export const MAX_PLACE_PHOTOS=5;
export const PLACE_PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
export const PLACE_PHOTO_RATIOS={'4:3':4/3,'1:1':1,'16:9':16/9};
export function photoFileProblem(file){
 if(!file||!PLACE_PHOTO_TYPES.has(file.type))return 'format';
 if(!Number.isFinite(file.size)||file.size<=0||file.size>10*1024*1024)return 'size';
 return null;
}
export function photoCropDefaults(){return {ratio:'4:3',x:50,y:50,zoom:1};}
export function sanitizePhotoCrop(value={}){
 const num=(v,def,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):def;
 return {
  ratio:Object.hasOwn(PLACE_PHOTO_RATIOS,value.ratio)?value.ratio:'4:3',
  x:num(value.x,50,0,100),
  y:num(value.y,50,0,100),
  zoom:num(value.zoom,1,1,2.5)
 };
}
export function photoCropGeometry(srcWidth,srcHeight,crop=photoCropDefaults(),targetWidth=900){
 const srcW=Number(srcWidth),srcH=Number(srcHeight),width=Math.max(1,Math.round(targetWidth));
 if(!(srcW>0&&srcH>0))throw Error('invalid-photo-dimensions');
 const opts=sanitizePhotoCrop(crop),height=Math.max(1,Math.round(width/PLACE_PHOTO_RATIOS[opts.ratio]));
 const scale=Math.max(width/srcW,height/srcH)*opts.zoom;
 const drawWidth=srcW*scale,drawHeight=srcH*scale;
 return {width,height,dx:-(drawWidth-width)*opts.x/100,dy:-(drawHeight-height)*opts.y/100,drawWidth,drawHeight};
}
export function cropPlacePhoto(src,crop,quality=.76){
 return new Promise((resolve,reject)=>{
  if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(src||''))return reject(Error('invalid-photo-source'));
  const image=new Image();
  image.onload=()=>{
   try{
    const g=photoCropGeometry(image.naturalWidth,image.naturalHeight,crop);
    const canvas=document.createElement('canvas');canvas.width=g.width;canvas.height=g.height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw Error('no-photo-canvas');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,g.width,g.height);
    ctx.drawImage(image,g.dx,g.dy,g.drawWidth,g.drawHeight);
    resolve(canvas.toDataURL('image/jpeg',quality));
   }catch(error){reject(error);}
  };
  image.onerror=()=>reject(Error('cannot-open-photo'));
  image.src=src;
 });
}
export function withCoverFirst(photos,id){
 const index=photos.findIndex(p=>p.id===id);
 if(index<0)return photos;
 return [photos[index],...photos.filter((_,i)=>i!==index)];
}
