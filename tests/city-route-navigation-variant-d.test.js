import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../assets/prototypes/city-route-navigation-variant-d.html',import.meta.url),'utf8');

test('variant D separates Start, Trasy, Miejsca, Społeczność and Profil',()=>{
 assert.match(html,/discover:'Trasy'/);
 assert.match(html,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(html,/function start\(\)/);
 assert.match(html,/function discover\(\)/);
 assert.match(html,/function places\(\)/);
 assert.match(html,/function social\(\)/);
 assert.match(html,/function profile\(\)/);
 assert.match(html,/function library\(\)/);
 assert.match(html,/Moje kolekcje/);
 assert.match(html,/Moje trasy/);
 assert.match(html,/Zapisane trasy/);
 assert.match(html,/Zapisane miejsca/);
 assert.doesNotMatch(html,/Moje trasy i szkice/);
 assert.doesNotMatch(html,/Trasy i odkrycia innych osób/);
});
test('variant D collects positive interests and never relaxes hard category exclusions',()=>{
 assert.match(html,/function eligibleSpots\(\)\{return spots\.filter\(p=>!state\.avoid\.includes\(p\.cat\)\)/);
 assert.match(html,/function planDemo\(\)/);
 assert.match(html,/function builder\(\)/);
 assert.match(html,/Nie chcę odwiedzać/);
 assert.match(html,/Twarde wykluczenie/);
 assert.match(html,/case'avoid'/);
 assert.match(html,/case'like'/);
 assert.match(html,/available\.length\?'':'disabled'/);
 assert.match(html,/Za mało miejsc|Brak dostępnych miejsc/);
});
test('variant D makes prototype map visible but pins conditional on category or search',()=>{
 assert.match(html,/function mapPreview\(arr\)/);
 assert.match(html,/state\.placeFilter!=='Wszystkie'\|\|state\.search\.trim\(\)\.length>0/);
 assert.match(html,/class="schematic-map"/);
 assert.match(html,/Otwórz na mapie/);
 assert.match(html,/schemat/i);
 assert.match(html,/Tripadvisor/);
 assert.match(html,/Google Maps/);
 assert.match(html,/City Route/);
});
test('variant D remains standalone with no account or network mutations',()=>{
 for(const name of ['Castelo de São Jorge','Jardim Botânico de Lisboa','Miradouro de Santa Luzia','Belcanto'])assert.ok(html.includes(name));
 assert.doesNotMatch(html,/\bfetch\s*\(|\bXMLHttpRequest\b|navigator\.sendBeacon\b|supabase\.from\s*\(/i);
 assert.match(html,/prefers-reduced-motion/);
 assert.match(html,/Nie wykonuje rzeczywistych zapisów|Nie wykonuje rzeczywistych zapisów ani obliczeń/);
});
