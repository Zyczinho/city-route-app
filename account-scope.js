// ACCOUNT-ISOLATION-047: one browser, one active local profile at a time.
// All transitions write a recoverable snapshot before showing another account.
// This is LOCAL isolation, not cross-device synchronization.
export const ACTIVE_KEY='city-route-active-scope-v1';
export const DATA_KEY='city-route-v1';
const PREFIX='city-route-local-data-v1:';
export const scopeFor=userId=>userId?'user:'+String(userId):'guest';
export const scopedKey=scope=>PREFIX+scope;

const parse=value=>{try{return JSON.parse(value);}catch{return null;}};
export const newAccountState=userId=>({
 version:1,tester:{id:userId,nickname:'Explorer'},basket:[],basketsByCity:{},
 events:[],session:null,savedPlacesByCity:{},placeReviews:{},userPlaces:[],
 myRoutes:[],friends:[],messages:{},joined:[],profile:{bio:'',socials:{}}
});
export const hasPersonalActivity=value=>{
 const state=typeof value==='string'?parse(value):value;
 return !!(state&&(state.events?.length||state.myRoutes?.length||state.userPlaces?.length||
 Object.keys(state.placeReviews||{}).length||
 Object.values(state.savedPlacesByCity||{}).some(v=>Array.isArray(v)&&v.length)||
 state.session||state.basket?.length));
};
export const isGeneratedNickname=s=>/^u_[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(String(s||''));
export const friendlyNickname=s=>typeof s==='string'&&s.trim()&&
 s.trim()!=='Explorer'&&s.trim()!=='Odkrywca'&&!isGeneratedNickname(s);

export function activateLocalScope(store,userId){
 const to=scopeFor(userId),from=store.getItem(ACTIVE_KEY)||'guest';
 if(to===from)return {changed:false,scope:to};
 const active=store.getItem(DATA_KEY);
 // Fail-closed: if the browser cannot safely persist old data, do not switch.
 const fromKey=scopedKey(from),toKey=scopedKey(to);
 const priorFrom=store.getItem(fromKey);
 const target=store.getItem(toKey);
 const blank=to==='guest'?JSON.stringify(newAccountState('guest')):JSON.stringify(newAccountState(String(userId)));
 try{
  if(active!==null)store.setItem(fromKey,active);
  store.setItem(DATA_KEY,target||blank);
  store.setItem(ACTIVE_KEY,to);
  return {changed:true,scope:to,legacyGuestSaved:from==='guest'&&active!==null};
 }catch(error){
  // Restoration is best effort if storage exhausted; retain active snapshot.
  try{if(active!==null)store.setItem(DATA_KEY,active);
   if(priorFrom===null)store.removeItem(fromKey);else store.setItem(fromKey,priorFrom);
   store.setItem(ACTIVE_KEY,from);
  }catch{}
  throw error;
 }
}
export function guestImportAvailable(store,userId){
 if(!userId||store.getItem(ACTIVE_KEY)!==scopeFor(userId))return false;
 return hasPersonalActivity(store.getItem(scopedKey('guest'))) &&
 !hasPersonalActivity(store.getItem(DATA_KEY));
}
export function importGuestActivity(store,userId){
 if(!guestImportAvailable(store,userId))return {imported:false,reason:'not-available'};
 const guest=parse(store.getItem(scopedKey('guest')));
 if(!guest||guest.version!==1)return {imported:false,reason:'invalid'};
 const current=store.getItem(DATA_KEY);
 if(!current)return {imported:false,reason:'missing-active'};
 // Preserve a complete pre-import snapshot AND the original guest copy.
 const backupKey='city-route-pre-import-v1:'+String(userId);
 try{
  store.setItem(backupKey,current);
  const result={...guest,tester:{...guest.tester,id:String(userId),
   nickname:friendlyNickname(guest.tester?.nickname)?guest.tester.nickname:'Explorer'}};
  store.setItem(DATA_KEY,JSON.stringify(result));
  store.setItem(scopedKey(scopeFor(userId)),JSON.stringify(result));
  return {imported:true,backupKey};
 }catch(error){try{store.setItem(DATA_KEY,current);}catch{}throw error;}
}
