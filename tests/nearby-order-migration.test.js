import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('migration 009 orders Nearby by the same exact distance returned to clients',async()=>{
 const sql=await readFile('supabase/migrations/009_nearby_exact_distance_order.sql','utf8');
 assert.match(sql,/create or replace function public\.catalogue_nearby_places/i);
 assert.match(sql,/order by extensions\.st_distance\(/i);
 assert.doesNotMatch(sql,/operator\(extensions\.<->\)/i);
 assert.match(sql,/grant execute on function public\.catalogue_nearby_places/i);
});
