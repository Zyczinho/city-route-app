import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');

test('public route detail and author profile expose real friend invitation with existing guarded RPC',()=>{
 const src=read('social-routes-enhancements.js');
 assert.match(src,/createFriendsClient/);
 assert.match(src,/friendApi\.request\(userId\)/);
 assert.match(src,/friendApi\.respond\(userId,true\)/);
 assert.match(src,/authorRelationship\(route\.author\.id\)/);
 assert.match(src,/authorRelationship\(id\)/);
 assert.match(src,/void syncAuthorRelationship\(route\.author\.id\)/);
 assert.match(src,/void syncAuthorRelationship\(id\)/);
 assert.match(src,/requested_by_me/);
 assert.match(src,/friend_status==='accepted'/);
 assert.match(src,/href="#profile"/);
 assert.match(src,/data-author-follow/,'following must remain separate from friendship');
 execFileSync(process.execPath,['--check','social-routes-enhancements.js'],{stdio:'pipe'});
});
