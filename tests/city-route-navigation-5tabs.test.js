import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=new URL('../assets/prototypes/city-route-navigation-5tabs.html',import.meta.url);
const html=readFileSync(file,'utf8');
test('Prototype C: exactly five bottom-nav choices, separate route lifecycle',()=>{
 assert.match(html,/home:'Start',discover:'Odkrywaj',places:'Miejsca',social:'Społeczność',profile:'Profil'/);
 assert.match(html,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(html,/Moja trasa · \$\{state.route.length\} przystanki/);
 assert.match(html,/els.routebar.hidden=!state.route.length\|\|state.view==='myroute'/);
 assert.match(html,/function start\(/);
 assert.match(html,/function discover\(/);
 assert.match(html,/function places\(/);
 assert.match(html,/function social\(/);
 assert.match(html,/function profile\(/);
 assert.match(html,/function builder\(/);
 assert.match(html,/function myroute\(/);
});
test('Prototype C: prioritizes one action, shares in a menu, not duplicated by navigation',()=>{
 assert.match(html,/Rozpocznij trasę/);
 assert.match(html,/Więcej opcji/);
 assert.match(html,/Udostępnij moją trasę/);
 assert.match(html,/Trasy opublikowane przez społeczność również będzie można odkrywać tutaj/);
 assert.match(html,/Dzwonek.*bezpośrednio do powiadomień/);
 assert.match(html,/function modalHtml/);
 assert.match(html,/prefs-reduced-motion|prefers-reduced-motion/);
});
test('Prototype C: demonstration makes no account/network writes and does not invent published Lisbon routes',()=>{
 for (const p of ['Castelo de São Jorge','A Brasileira','Torre de Belém']) assert.ok(html.includes(p));
 assert.match(html,/188 miejsc/);
 assert.match(html,/nie ma jeszcze opublikowanych gotowych tras/);
 assert.match(html,/Nie wykonuje rzeczywistych zapisów/);
 assert.doesNotMatch(html,/fetch\s*\(|XMLHttpRequest\s*\(|\bsupabase\./i);
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(build,/'assets'/);
});
