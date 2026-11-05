// EXPLORER-FOLLOW-053: independent, one-way relations; never writes friend_connections.
// The hosted user_follows table must be activated separately with its RLS policies.
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validFollowPair=(viewerId,authorId)=>ID.test(String(viewerId||''))&&ID.test(String(authorId||''))&&viewerId!==authorId;
export function createFollowsClient(client){
 if(typeof client?.from!=='function')throw new Error('follow-client-required');
 const check=(viewerId,authorId)=>{if(!validFollowPair(viewerId,authorId))throw new Error('invalid-follow-pair');};
 const fail=result=>{if(result?.error)throw result.error;return result;};
 return {
  async status(viewerId,authorId){
   check(viewerId,authorId);
   const [mine,total]=await Promise.all([
    client.from('user_follows').select('follower_id').eq('follower_id',viewerId).eq('followed_id',authorId).limit(1),
    client.from('user_follows').select('follower_id',{count:'exact',head:true}).eq('followed_id',authorId)
   ]);
   fail(mine);fail(total);
   return {following:Array.isArray(mine.data)&&mine.data.length>0,followers:Math.max(0,Number(total.count)||0)};
  },
  async follow(viewerId,authorId){
   check(viewerId,authorId);
   fail(await client.from('user_follows').upsert({follower_id:viewerId,followed_id:authorId},{onConflict:'follower_id,followed_id',ignoreDuplicates:true}));
  },
  async unfollow(viewerId,authorId){
   check(viewerId,authorId);
   fail(await client.from('user_follows').delete().eq('follower_id',viewerId).eq('followed_id',authorId));
  }
 };
}
