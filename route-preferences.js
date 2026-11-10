// Shared route semantics for UI, V1 and V2. Explicit exclusions outrank interests.
export const ROUTE_INTERESTS=Object.freeze([
 {id:'mix',label:'Wszystko po trochu',description:'Zróżnicowany spacer z kilku rodzajów miejsc.'},
 {id:'sightseeing',label:'Klasyka',description:'Symbole miasta, charakterystyczne zabytki i architektura.'},
 {id:'culture',label:'Kultura',description:'Muzea, sztuka, galerie i historia.'},
 {id:'nature',label:'Zieleń',description:'Parki, ogrody i spokojne spacery blisko natury.'},
 {id:'views',label:'Widoki',description:'Punkty widokowe, panoramy, tarasy i nabrzeża.'},
 {id:'food',label:'Jedzenie',description:'Lokalne restauracje, targi, kawiarnie i smaki miasta.'},
 {id:'hidden',label:'Nieoczywiste',description:'Mniej znane zakątki i autentyczne lokalne miejsca.'}
]);
export const ROUTE_EXCLUSIONS=Object.freeze([
 {id:'museums',label:'Muzea i galerie'},
 {id:'parks',label:'Parki i ogrody'},
 {id:'religious',label:'Obiekty religijne'},
 {id:'viewpoints',label:'Punkty widokowe'},
 {id:'food',label:'Restauracje i kawiarnie'},
 {id:'nightlife',label:'Bary i kluby'}
]);
const INTEREST_CATEGORIES={
 sightseeing:['landmark','architecture','religious_site','neighborhood','monument','historic_site','fortress','castle','palace'],
 culture:['museum','gallery','religious_site','architecture','theatre','art','historic_site','cultural_centre'],
 nature:['park','garden','waterfront','beach','walk','forest','nature_reserve'],
 views:['viewpoint','waterfront','observation_deck','rooftop','panorama'],
 food:['restaurant','cafe','breakfast','street_food','food_hall','bakery','dessert','market'],
 hidden:['hidden_gem','neighborhood','workshop','experience','local_market']
};
const EXCLUDED_CATEGORIES={
 museums:['museum','gallery'],
 parks:['park','garden','botanical_garden','forest'],
 religious:['religious_site','church','cathedral','mosque','synagogue','temple','chapel','monastery'],
 viewpoints:['viewpoint','observation_deck','panorama'],
 food:INTEREST_CATEGORIES.food,
 nightlife:['bar','pub','cocktail_bar','wine_bar','club','live_music','nightclub']
};
const LEGACY_INTEREST={
 sightseeing:['zabytki'],culture:['muzea'],nature:['zielen'],views:['widoki'],food:['jedzenie'],hidden:['okolice']
};
const LEGACY_EXCLUDED={
 museums:['muzea'],parks:['zielen'],religious:[],viewpoints:['widoki'],food:['jedzenie'],nightlife:['bary','kluby']
};
const arr=x=>Array.isArray(x)?x:[];
const parts=p=>({
 category:String(p?.categoryId||'').toLowerCase(),
 cats:arr(p?.cats).map(x=>String(x).toLowerCase()),
 tags:arr(p?.tags).map(x=>String(x).toLowerCase())
});
export function isRouteFoodPlace(p){
 const t=parts(p);
 return String(p?.foodStyle||'none')!=='none'||p?.kind==='restaurant'||
  INTEREST_CATEGORIES.food.includes(t.category)||t.cats.includes('jedzenie');
}
export function normalizeRouteInterests(raw){
 const allowed=new Set(ROUTE_INTERESTS.map(x=>x.id));
 const unique=[...new Set(arr(raw).filter(x=>allowed.has(x)))];
 const specific=unique.filter(id=>id!=='mix');
 return specific.length?specific:['mix'];
}
export function normalizeRouteExclusions(raw){
 const allowed=new Set(ROUTE_EXCLUSIONS.map(x=>x.id));
 return [...new Set(arr(raw).filter(x=>allowed.has(x)))];
}
export function isExcludedRoutePlace(p,raw=[]){
 const t=parts(p),excluded=normalizeRouteExclusions(raw);
 return excluded.some(id=>{
  if(id==='food'&&isRouteFoodPlace(p))return true;
  return EXCLUDED_CATEGORIES[id]?.includes(t.category)||
   LEGACY_EXCLUDED[id]?.some(cat=>t.cats.includes(cat));
 });
}
export function routeInterestMatch(p,id){
 if(id==='mix')return true;
 if(!INTEREST_CATEGORIES[id])return false;
 const t=parts(p);
 if(id==='food'&&isRouteFoodPlace(p))return true;
 if(t.tags.includes(id))return true;
 if(id==='hidden'&&(t.tags.some(tag=>['hidden','hidden_gem','local','offbeat'].includes(tag))||p?.tourist==='local'))return true;
 return INTEREST_CATEGORIES[id].includes(t.category)||
  (LEGACY_INTEREST[id]||[]).some(cat=>t.cats.includes(cat));
}

/** Outside visits must have an actual exterior experience, not a closed museum's door. */
export function canViewRouteExterior(p){
 if(!p||p.interiorOnly===true||p.exteriorWorthVisiting===false)return false;
 if(['museum','gallery'].includes(p.categoryId)||Array.isArray(p.cats)&&p.cats.includes('muzea'))
  return p.exteriorWorthVisiting===true;
 return true;
}
