// Pure unread indicator calculations; no message body is put into OS notifications.
export function computeUnread(messages,reads,userId){
 const cutoffs=new Map((Array.isArray(reads)?reads:[]).filter(x=>x?.reader_id===userId).map(x=>[x.peer_id,Number(x.last_read_message_id)||0]));
 const byPeer=new Map();
 for(const message of Array.isArray(messages)?messages:[]){
  if(!message||message.sender_id===userId)continue;
  if(message.user_low!==userId&&message.user_high!==userId)continue;
  const id=Number(message.id);
  if(!Number.isSafeInteger(id)||id<1)continue;
  const peer=message.sender_id;
  if(id<=(cutoffs.get(peer)||0))continue;
  byPeer.set(peer,(byPeer.get(peer)||0)+1);
 }
 return {total:[...byPeer.values()].reduce((a,b)=>a+b,0),byPeer};
}
export function shouldNotifyDirectMessage(message,userId,hash){
 if(!message||message.sender_id===userId)return false;
 if(message.user_low!==userId&&message.user_high!==userId)return false;
 return hash!=='#routes/community/dm/'+message.sender_id;
}
export function highestMessageId(messages){
 return (Array.isArray(messages)?messages:[]).reduce((max,m)=>{
  const id=Number(m?.id);return Number.isSafeInteger(id)&&id>max?id:max;
 },0);
}
