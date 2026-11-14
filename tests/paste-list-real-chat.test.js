import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePastedList,resolvePastedList,sameNamedPlace,MAX_PASTED_PLACES,MAX_PASTED_LOOKUPS} from '../paste-list.js';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const json=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

// A five-day London plan as copied from a ChatGPT answer (#232): day headers, numbered places, paragraphs,
// a table of exhibitions, a "top five" recap and a Christmas list.
const LONDON=read('tests/fixtures/paste-list-london-chatgpt.txt');
const PLACES=['Wallace Collection','Mount Street','Burlington Arcade','Dover Street','Bond Street','V&A','Leighton House Museum','Design Museum','Holland Park',"Sir John Soane's Museum",'The Courtauld Gallery','Tate Britain',"Dennis Severs' House",'Whitechapel Gallery','Spitalfields','Brick Lane','Fortnum & Mason','Covent Garden','Regent Street'];

test('a real ChatGPT plan: the candidates are the places, not day headers, descriptions or table rows',()=>{
 const {items}=parsePastedList(LONDON);
 const names=items.map(i=>i.name);
 const found=PLACES.filter(p=>names.includes(p)),other=names.filter(n=>!PLACES.includes(n));
 assert.ok(found.length>=18,`${found.length} of ${PLACES.length} places found; missing: ${PLACES.filter(p=>!names.includes(p)).join(', ')}`);
 assert.ok(other.length<=3,`not places: ${other.join(' | ')}`);
 for(const junk of ['Twój Londyn','Ważna rzecz dotycząca terminu','Wtorek, 24 listopada','malarstwo dawnych mistrzów','Zarezerwuj sobie około 4–5 godzin','Marie Antoinette Style','Moje pięć największych rekomendacji'])assert.ok(!names.includes(junk),junk);
 // The recap repeats places under a shorter name; each place is one candidate.
 assert.equal(new Set(names).size,names.length);
 assert.ok(!names.includes('Leighton House'));
 // Numbered lines and "Name – description" lines are the sure candidates; the leftovers are not.
 assert.ok(items.filter(i=>PLACES.includes(i.name)).every(i=>i.strong));
 assert.ok(items.filter(i=>!PLACES.includes(i.name)).every(i=>!i.strong));
});

test('lines that are not places are dropped before any lookup',()=>{
 const names=t=>parsePastedList(t).items.map(i=>i.name);
 assert.deepEqual(names('Dzień 1\nDay 2: Soho\nSobota, 28 listopada – East End\n24.11 – Mayfair\n1. Wallace Collection'),['Wallace Collection']);
 assert.deepEqual(names('Hala Koszyki\nmalarstwo dawnych mistrzów\nTo dobre miejsce na lunch.\nwstęp bezpłatny;\nZarezerwuj sobie około 4–5 godzin\nWażna rzecz dotycząca terminu'),['Hala Koszyki']);
 assert.deepEqual(names('Rano – kawa i spacer\nDojazd: metro\n2. Lunch w Soho\n3. Teatro Cubano – bar z muzyką na żywo.'),['Teatro Cubano']);
 // A table inside a chat answer is skipped; a pasted sheet is a list and gives its first column.
 assert.deepEqual(names('1. Tate Britain\nOpis muzeum w jednym zdaniu.\nTurner i Constable\tTate Britain\t12 kwietnia\n2. Design Museum'),['Tate Britain','Design Museum']);
 assert.deepEqual(names('Hala Koszyki\tKoszykowa 63\nTeatro Cubano\tAleksandra Fredry 6'),['Hala Koszyki','Teatro Cubano']);
 // A list typed all in lowercase is still a list.
 assert.deepEqual(names('teatro cubano\nnoodlani'),['teatro cubano','noodlani']);
 // One name inside another is one place, at the first position, under the fuller name.
 assert.deepEqual(parsePastedList('Leighton House\nDesign Museum\n1. Leighton House Museum').items,[{name:'Leighton House Museum',url:'',strong:true},{name:'Design Museum',url:'',strong:false}]);
 assert.deepEqual(names('Holland Park\nPark Skaryszewski'),['Holland Park','Park Skaryszewski']);
});

test('the limit of 15 counts places that were found, and lookups have a budget',async()=>{
 const calls=[];
 const fetcher=async url=>{
  const q=decodeURIComponent(new URL(url,'https://x.test').searchParams.get('q')||'');calls.push(q);
  return json({status:'ok',suggestions:PLACES.includes(q)?[{provider:'photon-osm',name:q,location:{lat:51.5,lng:-0.1}}]:[]});
 };
 const {items}=parsePastedList(LONDON);
 const resolved=await resolvePastedList(items,{maxFound:MAX_PASTED_PLACES,maxLookups:MAX_PASTED_LOOKUPS,fetcher});
 const places=resolved.filter(r=>r.place).map(r=>r.place.name);
 assert.equal(places.length,MAX_PASTED_PLACES);
 assert.deepEqual(places,PLACES.slice(0,MAX_PASTED_PLACES),'in the order of the text');
 assert.ok(calls.every(q=>PLACES.includes(q)),'sure candidates are looked up first; none of the leftovers was needed');
 assert.ok(calls.length<=MAX_PASTED_PLACES+2);
 assert.equal(resolved.filter(r=>!r.tried).length,items.length-MAX_PASTED_PLACES);

 // Nothing is found: the search stops at the budget instead of trying every line.
 const prose=Array.from({length:50},(_,i)=>'Nazwa Numer '+(i+1)).join('\n');
 let n=0;
 const none=await resolvePastedList(parsePastedList(prose).items,{maxFound:MAX_PASTED_PLACES,maxLookups:MAX_PASTED_LOOKUPS,fetcher:async()=>{n++;return json({status:'ok',suggestions:[]});}});
 assert.equal(n,MAX_PASTED_LOOKUPS);
 assert.equal(none.filter(r=>r.tried).length,MAX_PASTED_LOOKUPS);
 assert.equal(none.filter(r=>!r.tried).length,50-MAX_PASTED_LOOKUPS);

 // A hit under a different name is still skipped, and does not take a slot.
 assert.equal(sameNamedPlace('Świąteczny Londyn','London Eye'),false);
 const app=read('app.js');
 assert.match(app,/resolvePastedList\(toResolve,\{maxFound:MAX_PASTED_PLACES-local\.matched\.length,maxLookups:MAX_PASTED_LOOKUPS,/);
 assert.match(app,/skipped=resolved\.filter\(r=>!r\.tried\)\.length/);
});
