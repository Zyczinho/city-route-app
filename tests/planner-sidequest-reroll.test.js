import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('refresh uses persisted generation preferences and does not reference an unavailable prefs variable',()=>{
 const refresh=app.slice(app.indexOf("if(action==='refresh-generated')"),app.indexOf("if(action==='save-generated'"));
 assert.match(refresh,/generationPrefs\.interests\.includes\('sidequests'\)/);
 assert.doesNotMatch(refresh,/wantSidequests=prefs\.interests/);
});
test('Warsaw side quests are available in initial plan and refresh only when requested',()=>{
 const segment=app.slice(app.indexOf('function plan(prefs,start)'),app.indexOf('// SAVED-PLACES-SYNC'));
 assert.match(segment,/wantSidequests=chosenPrefs\.interests\.includes\('sidequests'\)/);
 assert.match(segment,/\.\.\.\(wantSidequests\?quests:\[\]\)/);
});
