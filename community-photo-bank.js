// P0 #176 — reuse the already-existing community photo bucket for accepted,
// freely licensed Wikimedia photographs. Never ingest Google / Tripadvisor / Instagram.
// Private places are local-only; moderation still gates public catalogue visibility.
const WIKI_IMAGE=/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//i;
const WIKI_SOURCE=/^https:\/\/commons\.wikimedia\.org\/wiki\/File:[^\s?#]{1,450}(?:\?[^\s#]{0,120})?$/i;
const CC_LICENSE=/^(?:CC\s*BY(?:-SA)?\s*[1-4](?:\.\d)?(?:\s+[a-z]{2})?|CC0(?:\s*1\.0)?|Public domain|PD-(?:old|self|US))$/i;
const CC_URL=/^https:\/\/creativecommons\.org\/(?:licenses\/by(?:-sa)?\/|publicdomain\/)(?:[^\s]{0,180})$/i;
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
export const MAX_IMPORT_BYTES=6*1024*1024;
export const MAX_PHOTO_EDGE=960;

export function licensedPhotoCredit(place){
 if(place?.visibility!=='public'||!WIKI_IMAGE.test(String(place.image||'')))return null;
 const c=place?.imageCredit;
 if(c?.via!=='Wikimedia Commons'||!WIKI_SOURCE.test(String(c.source||''))||
    !CC_LICENSE.test(String(c.license||'')))return null;
 const author=String(c.author||'').trim();
 if(!author||author.length>120||String(c.license).length>50)return null;
 const licenseUrl=c.licenseUrl==null?'':String(c.licenseUrl);
 // CC BY and CC BY-SA require an attribution link. No arbitrary hosts are accepted.
 if(/^CC\s*BY/i.test(c.license)&&!CC_URL.test(licenseUrl))return null;
 if(licenseUrl&&!CC_URL.test(licenseUrl))return null;
 return {via:'Wikimedia Commons',source:c.source,author,license:c.license,licenseUrl:licenseUrl||null};
}

export function shouldBankCommunityPhoto(place){
 return !!licensedPhotoCredit(place)&&!place?.photoUploaded;
}

// Download only a previously accepted Wikimedia picture and convert once into
// the same bounded JPEG used by own-photo uploads. Browser supplies the CORS
// permission; if not available, the importer fails closed without publishing.
export async function commonsPhotoJpeg(place,{fetcher=fetch,makeBitmap=globalThis.createImageBitmap,makeCanvas=()=>document.createElement('canvas')}={}){
 if(!licensedPhotoCredit(place))throw Error('unlicensed-or-private');
 const response=await fetcher(place.image,{mode:'cors',redirect:'follow',cache:'default'});
 if(!response?.ok)throw Error('commons-fetch-failed');
 const declared=Number(response.headers?.get?.('content-length')||0);
 if(declared>MAX_IMPORT_BYTES)throw Error('commons-photo-too-large');
 const blob=await response.blob();
 if(!IMAGE_TYPES.has(blob.type)||blob.size>MAX_IMPORT_BYTES||blob.size===0)throw Error('commons-invalid-image');
 let img=null,objectUrl=null;
 try{
  if(typeof makeBitmap==='function')img=await makeBitmap(blob);
  else{
   objectUrl=URL.createObjectURL(blob);
   img=await new Promise((resolve,reject)=>{
    const picture=new Image();
    picture.onload=()=>resolve(picture);
    picture.onerror=()=>reject(Error('commons-image-decode-failed'));
    picture.src=objectUrl;
   });
  }
  const iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight;
  if(!(iw>0&&ih>0))throw Error('commons-invalid-dimensions');
  const ratio=Math.min(1,MAX_PHOTO_EDGE/Math.max(iw,ih));
  const canvas=makeCanvas();canvas.width=Math.round(iw*ratio);canvas.height=Math.round(ih*ratio);
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw Error('commons-canvas-failed');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.77);
 }finally{
  img?.close?.();
  if(objectUrl)URL.revokeObjectURL(objectUrl);
 }
}
