// 022: deterministic participant pair + validated route for friend-only City Route DMs.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const validDirectUserId=id=>typeof id==='string'&&UUID.test(id);
export function directPair(a,b){
 if(!validDirectUserId(a)||!validDirectUserId(b)||a.toLowerCase()===b.toLowerCase())return null;
 const [user_low,user_high]=[a.toLowerCase(),b.toLowerCase()].sort();
 return {user_low,user_high};
}
export const directChatHref=peer=>validDirectUserId(peer)?'#routes/community/dm/'+peer.toLowerCase():null;
export function createDirectMessagesClient(supabase){
 return {
  async thread(me,peer,limit=100){
   const pair=directPair(me,peer);if(!pair)throw Error('invalid-peer');
   const {data,error}=await supabase.from('direct_messages')
    .select('id,user_low,user_high,sender_id,body,created_at')
    .eq('user_low',pair.user_low).eq('user_high',pair.user_high)
    .order('created_at',{ascending:false}).limit(Math.min(Math.max(limit,1),100));
   if(error)throw error;
   return (data||[]).reverse();
  },
  async recent(me,limit=200){
   if(!validDirectUserId(me))throw Error('invalid-user');
   const {data,error}=await supabase.from('direct_messages')
    .select('id,user_low,user_high,sender_id,body,created_at')
    .or('user_low.eq.'+me+',user_high.eq.'+me)
    .order('created_at',{ascending:false}).limit(Math.min(Math.max(limit,1),200));
   if(error)throw error;return data||[];
  },
  async readReceipts(me){
   if(!validDirectUserId(me))throw Error('invalid-user');
   const {data,error}=await supabase.from('direct_message_reads')
    .select('reader_id,peer_id,last_read_message_id').eq('reader_id',me);
   if(error)throw error;
   return data||[];
  },
  async markRead(me,peer,messageId){
   const pair=directPair(me,peer),id=Number(messageId);
   if(!pair||!Number.isSafeInteger(id)||id<1)throw Error('invalid-read-cursor');
   // Do not regress another device's newer cursor.
   const {data,error:readError}=await supabase.from('direct_message_reads')
    .select('last_read_message_id').eq('reader_id',me).eq('peer_id',peer).maybeSingle();
   if(readError)throw readError;
   if(id<=(Number(data?.last_read_message_id)||0))return;
   // Keep database grants least-privileged: insert new receipt, update only its cursor.
   if(data){
    const {error}=await supabase.from('direct_message_reads')
     .update({last_read_message_id:id}).eq('reader_id',me).eq('peer_id',peer);
    if(error)throw error;
   }else{
    const {error}=await supabase.from('direct_message_reads')
     .insert({reader_id:me,peer_id:peer,last_read_message_id:id});
    if(error?.code==='23505'){
     // Another device created the same receipt concurrently.
     const {error:retryError}=await supabase.from('direct_message_reads')
      .update({last_read_message_id:id}).eq('reader_id',me).eq('peer_id',peer);
     if(retryError)throw retryError;
    }else if(error)throw error;
   }
  },
  async send(me,peer,raw){
   const pair=directPair(me,peer);
   const body=String(raw??'').trim();
   if(!pair||!body||body.length>2000)throw Error('invalid-message');
   const {error}=await supabase.from('direct_messages')
    .insert({...pair,sender_id:me.toLowerCase(),body});
   if(error)throw error;
  }
 };
}
