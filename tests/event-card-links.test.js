// Issue #102: cards must never show unfinished "do uzupełnienia" copy, and the
// ticket seller link must stay visible when there is no official event page.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code=await readFile(new URL('../app.js',import.meta.url),'utf8');
const line=start=>code.split('\n').find(l=>l.startsWith(start));
const ctx={esc:s=>String(s??''),ic:()=>'',when:()=>'pt. 20:00',catName:k=>k,EV_KIND:{},fmt:n=>String(n),q:p=>encodeURIComponent(p.name)};
vm.runInNewContext(`${line('const out=')}\n${line('function eventCard(')}\n${line('function ticketLinks(')}\nthis.out=out;this.eventCard=eventCard;this.ticketLinks=ticketLinks;`,ctx);

const event={id:'tm-1',source:'ticketmaster',name:'Koncert',kind:'muzyka',venue:'Stodoła',url:'https://www.ticketmaster.pl/event/1',price:null};

test('app.js has no placeholder copy left',()=>{
 assert.equal(code.includes('do uzupełnienia'),false);
});

test('event without an official page shows Ticketmaster as the main link',()=>{
 const html=ctx.eventCard(event);
 assert.match(html,/class="button sm primary" href="https:\/\/www\.ticketmaster\.pl\/event\/1"[^>]*>Bilety w Ticketmaster/);
 assert.equal(html.includes('Wyprzedane?'),false);
 assert.equal(html.includes('Oficjalna strona'),false);
});

test('event with an official page keeps Ticketmaster as the alternative',()=>{
 const html=ctx.eventCard({...event,officialUrl:'https://example.org/koncert'});
 assert.match(html,/primary" href="https:\/\/example\.org\/koncert"[^>]*>Oficjalna strona wydarzenia/);
 assert.match(html,/<details><summary>Wyprzedane\?[^]*>Ticketmaster/);
});

test('place without an official ticket link shows no placeholder line',()=>{
 const html=ctx.ticketLinks({id:'p1',name:'Muzeum'});
 assert.equal(html.includes('Oficjalny link'),false);
 assert.match(html,/GetYourGuide/);
});
