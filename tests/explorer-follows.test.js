import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createFollowsClient,validFollowPair} from '../follows-client.js';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function fakeClient(){
 const edges=new Set();
 return {edges,from(table){
  assert.equal(table,'user_follows');
  let filter={},mode='',count=false;
  const query={
   select(_columns,opts={}){mode='select';count=opts.count==='exact';return query;},
   eq(k,v){filter[k]=v;return query;},
   limit(){const key=filter.follower_id+':'+filter.followed_id;return Promise.resolve({data:edges.has(key)?[{follower_id:filter.follower_id}]:[],error:null});},
   upsert(row){edges.add(row.follower_id+':'+row.followed_id);return Promise.resolve({error:null});},
   delete(){mode='delete';return query;},
   then(resolve,reject){
    if(mode==='delete')edges.delete(filter.follower_id+':'+filter.followed_id);
    const data=count?{count:[...edges].filter(k=>k.endsWith(':'+filter.followed_id)).length,error:null}:{data:[],error:null};
    return Promise.resolve(data).then(resolve,reject);
   }
  };
  return query;
 }};
}

test('follows accept valid distinct user UUIDs and reject self-follow',()=>{
 assert.equal(validFollowPair(A,B),true);
 assert.equal(validFollowPair(A,A),false);
 assert.equal(validFollowPair('x',B),false);
});
test('follow, duplicate follow and unfollow never create mutual friendships',async()=>{
 const client=fakeClient(),api=createFollowsClient(client);
 assert.deepEqual(await api.status(A,B),{following:false,followers:0});
 await api.follow(A,B);
 assert.deepEqual(await api.status(A,B),{following:true,followers:1});
 assert.deepEqual(await api.status(B,A),{following:false,followers:0},'follow is not reciprocal');
 await api.follow(A,B);
 assert.deepEqual(await api.status(A,B),{following:true,followers:1},'upsert is idempotent');
 await api.unfollow(A,B);
 assert.deepEqual(await api.status(A,B),{following:false,followers:0});
 await assert.rejects(api.follow(A,A),/invalid-follow-pair/);
});
test('schema restricts writes and deliberately does not touch mutual friendship table',()=>{
 const sql=read('scripts/staged-user-follows-20261105.sql');
 assert.match(sql,/create table if not exists public\.user_follows/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/follower_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/for insert to authenticated/);
 assert.match(sql,/for delete to authenticated/);
 assert.match(sql,/no_self check/);
 assert.doesNotMatch(sql,/alter table public\.friend_connections/i);
});
test('author pages preserve friend actions while adding a distinct follow flow',()=>{
 const src=read('social-routes-enhancements.js');
 assert.match(src,/data-author-follow/);
 assert.match(src,/data-author-friend/);
 assert.match(src,/followsApi\.follow\(session\.user\.id,authorId\)/);
 assert.match(src,/followsApi\.unfollow\(session\.user\.id,authorId\)/);
 assert.match(src,/void syncAuthorFollow\(route\.author\.id\)/);
 assert.match(src,/void syncAuthorFollow\(id\)/);
 assert.match(src,/Obserwowanie nie jest jeszcze aktywne/);
 assert.match(src,/aria-pressed/);
 const sw=read('service-worker.js'),html=read('index.html'),build=read('scripts/build.mjs');
 for(const file of [sw,build])assert.match(file,/follows-client\.js/);
 assert.match(html,/social-routes-enhancements\.js\?v=12/);
 assert.match(sw,/city-route-v\d+/);
 execFileSync(process.execPath,['--check','social-routes-enhancements.js'],{stdio:'pipe'});
});
