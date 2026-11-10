// One category vocabulary for route interests, mapped onto the same POI taxonomy
// (categoryId and legacy cats) that powers Places. "Avoid" never implies "include".
export const ROUTE_INTERESTS=Object.freeze([
 {id:'mix',label:'Wszystko po trochu',description:'Różne rodzaje miejsc w jednym planie.'},
 {id:'zabytki',label:'Zabytki',description:'Charakterystyczne budowle, zabytki i miejsca historyczne.'},
 {id:'swiatynie',label:'Świątynie',description:'Kościoły, katedry, synagogi, meczety i świątynie.'},
 {id:'muzea',label:'Muzea',description:'Muzea, galerie i wystawy.'},
 {id:'zielen',label:'Zieleń',description:'Parki, ogrody i naturalne zakątki.'},
 {id:'ogrody',label:'Ogrody',description:'Ogrody i ogrody botaniczne, bez wszystkich parków.'},
 {id:'widoki',label:'Widoki',description:'Punkty widokowe, panoramy i tarasy.'},
 {id:'woda',label:'Woda',description:'Nabrzeża, promenady, rzeki i plaże.'},
 {id:'ulice',label:'Ulice',description:'Ulice, pasaże i charakterystyczne miejskie spacery.'},
 {id:'okolice',label:'Okolice',description:'Dzielnice i lokalne, mniej oczywiste zakątki.'},
 {id:'jedzenie',label:'Jedzenie',description:'Restauracje, targi, kawiarnie i miejscowe smaki.'},
 {id:'bary',label:'Bary',description:'Bary, puby i miejsca z drinkami.'},
 {id:'kluby',label:'Kluby',description:'Kluby nocne i miejsca do tańca.'},
 {id:'aktywnosci',label:'Aktywności',description:'Sport, warsztaty i inne doświadczenia.'},
 {id:'sidequests',label:'Side questy',description:'Krótkie wyzwania powiązane z konkretnymi miejscami.'}
]);
export const ROUTE_EXCLUSIONS=Object.freeze([
 {id:'museums',label:'Muzea i galerie'},
 {id:'parks',label:'Parki i ogrody'},
 {id:'religious',label:'Obiekty religijne'},
 {id:'viewpoints',label:'Punkty widokowe'},
 {id:'food',label:'Restauracje i kawiarnie'},
 {id:'nightlife',label:'Bary i kluby'}
]);
export const ROUTE_PRECISE_TYPES=Object.freeze([
 {id:'religious_site',label:'Świątynie i obiekty sakralne',description:'Kościoły, katedry, synagogi, meczety i świątynie.'},
 {id:'garden',label:'Ogrody',description:'Ogrody i ogrody botaniczne (bez wszystkich parków).'}
]);
const TYPES={
 zabytki:['landmark','architecture','religious_site','monument','historic_site','fortress','castle','palace'],
 swiatynie:['religious_site','church','cathedral','mosque','synagogue','temple','chapel','monastery'],
 muzea:['museum','gallery'],
 zielen:['park','garden','botanical_garden','forest','nature_reserve'],
 ogrody:['garden','botanical_garden'],
 widoki:['viewpoint','observation_deck','panorama','rooftop'],
 woda:['waterfront','beach','riverside','seafront','pier','promenade'],
 ulice:['street','pedestrian_street','alley','passage'],
 okolice:['neighborhood','district','hidden_gem','local_market'],
 jedzenie:['restaurant','cafe','breakfast','street_food','food_hall','bakery','dessert','market'],
 bary:['bar','pub','cocktail_bar','wine_bar','live_music'],
 kluby:['club','nightclub','dance_club'],
 aktywnosci:['sport','spa','workshop','experience','activity','adventure'],
 sidequests:['sidequest','quest']
};
const LEGACY={
 zabytki:['zabytki'],muzea:['muzea'],zielen:['zielen'],widoki:['widoki'],
 woda:['woda'],ulice:['ulice'],okolice:['okolice'],jedzenie:['jedzenie'],
 bary:['nocne'],kluby:['nocne'],aktywnosci:['aktywnosci'],sidequests:['side','sidequests']
};
const ALIASES={
 sightseeing:'zabytki',culture:'muzea',nature:'zielen',views:'widoki',
 food:'jedzenie',hidden:'okolice',nightlife:'bary'
};
const EXCLUDED_TYPES={
 museums:TYPES.muzea,parks:TYPES.zielen,
 religious:TYPES.swiatynie,
 viewpoints:TYPES.widoki,food:TYPES.jedzenie,
 nightlife:[...TYPES.bary,...TYPES.kluby]
};
const EXCLUDED_LEGACY={
 museums:['muzea'],parks:['zielen'],religious:[],viewpoints:['widoki'],food:['jedzenie'],nightlife:['nocne']
};
const array=value=>Array.isArray(value)?value:[];
const normalized=p=>({
 category:String(p?.categoryId||'').toLowerCase(),
 cats:array(p?.cats).map(x=>String(x).toLowerCase()),
 tags:array(p?.tags).map(x=>String(x).toLowerCase())
});
const ID_SET=new Set(ROUTE_INTERESTS.map(x=>x.id));
const normalizeId=id=>ALIASES[id]||id;
const contains=(a,b)=>a.some(x=>b.includes(x));
export const isRouteFoodPlace=p=>{
 const t=normalized(p);
 return String(p?.foodStyle||'none')!=='none'||p?.kind==='restaurant'||
 TYPES.jedzenie.includes(t.category)||t.cats.includes('jedzenie');
};
export const isRouteNightlife=p=>{
 const t=normalized(p);
 return [...TYPES.bary,...TYPES.kluby].includes(t.category)||t.cats.includes('nocne')||t.tags.includes('nightlife');
};
export function normalizeRouteInterests(raw){
 const values=[...new Set(array(raw).filter(x=>x==='mix'||ID_SET.has(x)||Object.hasOwn(ALIASES,x)))];
 const specific=values.filter(id=>id!=='mix');
 return specific.length?specific:['mix'];
}
export const normalizeRouteExclusions=raw=>{
 const allowed=new Set(ROUTE_EXCLUSIONS.map(x=>x.id));
 return [...new Set(array(raw).filter(x=>allowed.has(x)))];
};
export const normalizeRoutePreciseTypes=raw=>{
 const allowed=new Set(ROUTE_PRECISE_TYPES.map(x=>x.id));
 return [...new Set(array(raw).filter(x=>allowed.has(x)))];
};
export function routeInterestMatch(p,id){
 const key=normalizeId(id),t=normalized(p);
 if(key==='mix')return true;
 if(!ID_SET.has(key))return false;
 if(key==='jedzenie'&&isRouteFoodPlace(p))return true;
 if(key==='bary'||key==='kluby'){
  // A broad legacy "nocne" only means nightlife; do not claim every club is a bar.
  return TYPES[key].includes(t.category)||(!t.category&&t.cats.includes('nocne'));
 }
 if(key==='swiatynie'&&t.tags.includes('religious'))return true;
 if(key==='ogrody'&&t.tags.includes('garden'))return true;
 if(key==='zielen'&&t.cats.includes('zielen'))return true;
 if(key==='widoki'&&t.cats.includes('widoki'))return true;
 if(key==='woda'&&t.cats.includes('woda'))return true;
 if(key==='okolice'&&(p?.tourist==='local'||contains(t.tags,['hidden_gem','hidden','local','offbeat'])))return true;
 if(key==='sidequests'&&(p?.kind==='quest'||p?.kind==='sidequest'||t.cats.includes('side')||contains(t.tags,['sidequest','side-quest','quest'])))return true;
 if(t.tags.includes(id)||t.tags.includes(key))return true;
 if(key==='woda'&&contains(t.tags,['water','river','waterfront','seaside','beach']))return true;
 if(key==='ulice'&&contains(t.tags,['street','pedestrian','alley','walking_street']))return true;
 return TYPES[key].includes(t.category)||contains(t.cats,LEGACY[key]||[]);
}
export const routePreciseMatch=(p,type)=>{
 const t=normalized(p);
 if(type==='religious_site')return EXCLUDED_TYPES.religious.includes(t.category)||t.tags.includes('religious');
 if(type==='garden')return ['garden','botanical_garden'].includes(t.category)||t.tags.includes('garden');
 return false;
};
export function isExcludedRoutePlace(p,raw=[]){
 const t=normalized(p);
 return normalizeRouteExclusions(raw).some(id=>{
  if(id==='food'&&isRouteFoodPlace(p))return true;
  if(id==='nightlife'&&isRouteNightlife(p))return true;
  return EXCLUDED_TYPES[id]?.includes(t.category)||contains(t.cats,EXCLUDED_LEGACY[id]||[]);
 });
}
export function routeAllowedByFocus(p,prefs={}){
 const mode=prefs.focus==='only'?'only':'prefer';
 if(mode!=='only')return true;
 const precise=normalizeRoutePreciseTypes(prefs.preciseTypes);
 if(precise.length)return precise.some(type=>routePreciseMatch(p,type));
 const interests=normalizeRouteInterests(prefs.interests);
 if(interests.length===1&&interests[0]==='mix')return false;
 return interests.some(id=>id!=='mix'&&routeInterestMatch(p,id));
}
export function routeMatchingThemes(p,interests){
 return normalizeRouteInterests(interests).filter(id=>id!=='mix'&&routeInterestMatch(p,id));
}
/** Exterior viewing choice is an attraction-visit preference, not a prohibition on bars or restaurants. */
export function canViewRouteExterior(p){
 if(!p||p.interiorOnly===true||p.exteriorWorthVisiting===false)return false;
 const t=normalized(p);
 if(TYPES.muzea.includes(t.category)||t.cats.includes('muzea'))
  return p.exteriorWorthVisiting===true;
 return true;
}
const FACADE_TYPES=[...TYPES.zabytki,'viewpoint','observation_deck','panorama'];
/** A closed venue can still be a stop only when looking at it from outside is worth it (buildings, not bars or gardens). */
export function canViewRouteFacade(p){
 if(!p||p.interiorOnly===true||p.exteriorWorthVisiting===false)return false;
 if(p.exteriorWorthVisiting===true)return true;
 const t=normalized(p);
 if(TYPES.muzea.includes(t.category)||t.cats.includes('muzea'))return false;
 return FACADE_TYPES.includes(t.category)||EXCLUDED_TYPES.religious.includes(t.category)||(!t.category&&t.cats.includes('zabytki'));
}
const QUICK_BREAK=['cafe','bakery','dessert','breakfast','street_food','food_hall','market'];
const SIT_BREAK=['restaurant','food_hall'];
/**
 * Whether a food place can serve the requested break: "quick" = coffee or a local snack, "sit" = a meal.
 * The category decides first, so a café imported with a wrong sit-down label still counts as coffee.
 */
export function routeBreakSuitable(p,style){
 if(!isRouteFoodPlace(p))return false;
 const category=normalized(p).category;
 if(style==='quick')return QUICK_BREAK.includes(category)||(p?.foodStyle==='quick'&&!SIT_BREAK.includes(category));
 if(style==='sit')return SIT_BREAK.includes(category)||(p?.foodStyle==='sit'&&!QUICK_BREAK.includes(category));
 return false;
}

/** Null means unverified cost. A numeric zero without explicit verification is NOT free. */
export const routeKnownCost=p=>{
 const amount=Number(p?.cost);
 if(!Number.isFinite(amount)||amount<0)return null;
 return amount>0||p?.priceVerified===true||p?.costKnown===true?amount:null;
};
export function routeBudgetLimit(prefs={}){
 if(prefs.budget==='premium'||!prefs.budget)return Infinity;
 if(prefs.budget==='free')return 0;
 if(prefs.budget==='custom'){
  const amount=Number(prefs.budgetAmount);
  return Number.isFinite(amount)&&amount>=0&&amount<=100000?amount:NaN;
 }
 if(prefs.budget==='low')return 25;
 if(prefs.budget==='medium')return 100;
 return Infinity;
}
export const routeBudgetEligible=(p,prefs)=>{
 const limit=routeBudgetLimit(prefs),amount=routeKnownCost(p);
 if(Number.isNaN(limit))return false;
 if(prefs.budget==='free')return amount===0;
 return amount===null||amount<=limit;
};
