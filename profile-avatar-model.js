// PROFILE-AVATAR (founder report 2026-11-05): the profile photo lives on the account, not only in one browser.
// Pure helpers only (no DOM, no network) so every rule is covered by node tests.

export const AVATAR_BUCKET='city-route-avatars';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar\.jpg$/i;

// Matches the 017 check constraint and storage policies: one fixed object per account.
export const avatarPath=userId=>UUID.test(String(userId||''))?`${String(userId).toLowerCase()}/avatar.jpg`:null;

export function avatarUrl(path,version,base){
 if(!PATH.test(String(path||''))||!/^https:\/\//.test(String(base||'')))return '';
 const v=version?`?v=${encodeURIComponent(String(version))}`:'';
 return `${String(base).replace(/\/$/,'')}/storage/v1/object/public/${AVATAR_BUCKET}/${path}${v}`;
}

export const isLocalPhoto=v=>/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(v||''));

export function jpegBlobFromDataUrl(dataUrl){
 if(!isLocalPhoto(dataUrl))return null;
 const bin=atob(String(dataUrl).split(',')[1]),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Blob([bytes],{type:'image/jpeg'});
}

// What to do after sign-in on this device.
// - a photo changed here and not uploaded yet wins (pending),
// - otherwise the account's photo wins (another device may have changed it),
// - otherwise adopt this device's photo, or the photo added earlier as a guest.
export function avatarPlan({remotePath=null,localPhoto=null,pending=false,guestPhoto=null}={}){
 if(pending&&isLocalPhoto(localPhoto))return {action:'upload',photo:localPhoto};
 if(PATH.test(String(remotePath||'')))return {action:'use-remote'};
 if(isLocalPhoto(localPhoto))return {action:'upload',photo:localPhoto};
 if(isLocalPhoto(guestPhoto))return {action:'upload',photo:guestPhoto,fromGuest:true};
 return {action:'none'};
}

// Schema or bucket not deployed yet (migration 017): keep the photo local, as before.
export const avatarSyncUnavailable=error=>{
 const code=String(error?.code||error?.statusCode||''),msg=String(error?.message||error?.error||'');
 return code==='42703'||code==='PGRST204'||/avatar_path|bucket not found|not found/i.test(msg);
};
