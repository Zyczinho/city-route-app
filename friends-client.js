// FRIENDS-026 — only nickname + UUID are exchanged. All writes are guarded RPCs.
export class FriendsError extends Error{
 constructor(code,cause){super(code);this.code=code;this.cause=cause;this.name='FriendsError';}
}
const KNOWN=/\b(auth-required|invalid-nickname|invalid-friend|user-not-found|request-not-found|nickname-taken)\b/;
export function normalizeFriendsError(error){
 if(error instanceof FriendsError)return error;
 const message=String(error?.message||error),known=message.match(KNOWN);
 return new FriendsError(known?.[1]||(error?.code==='23505'?'nickname-taken':'network'),error);
}
export const nicknameKey=value=>String(value??'').trim().toLocaleLowerCase('pl-PL');
export function createFriendsClient(client){
 if(typeof client?.rpc!=='function')throw new FriendsError('supabase-client-required');
 const rpc=async(fn,args={})=>{
  const {data,error}=await client.rpc(fn,args);
  if(error)throw normalizeFriendsError(error);
  return data;
 };
 return {
  search:async(query)=>nicknameKey(query).length<2?[]:(await rpc('find_explorers',{p_query:String(query).trim(),p_limit:12})||[]),
  mine:async()=>await rpc('my_friends',{})||[],
  available:async(nickname)=>!!await rpc('nickname_available',{p_nickname:String(nickname).trim()}),
  request:async(userId)=>await rpc('send_friend_request',{p_user_id:userId}),
  respond:async(userId,accept)=>await rpc('respond_friend_request',{p_user_id:userId,p_accept:!!accept}),
  remove:async(userId)=>await rpc('remove_friend',{p_user_id:userId})
 };
}
