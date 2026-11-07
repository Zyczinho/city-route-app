import {summary,optimize,generate,generateAlternatives,advance,mapsUrl,routeMapsUrl,parseLocation,distance,combinedRating,smoothedRating,matches} from './core.js';
import {iconMarkup} from './ui-icons.js';
import {localDate,validDate,scheduleRoute,feasibleFor} from './opening-hours.js';
import {guideView} from './onboarding-guide.js';
import {suggestVisitStart} from './planner-defaults.js';
import {DEFAULT_CITY_ID,cityById,cityPoint,forCity,isInsideCity,routeTitle,searchQuery,withCityId} from './city-context.js';
import {createRestRpcClient,loadCatalogueWithFallback} from './catalogue-client.js';
import {loadNearbyPlaces} from './nearby-client.js';
import {optimizeRoutePlaces} from './route-optimizer.js';
import {createMapView,nearbyPlaces} from './map-view.js';
import {assignRouteCovers} from './route-covers.js';
import {createDraft,hydrateDraft,addStop,removeStop,moveStop,moveStopBy,clearDraft,setName,setTransport,serializeDraft,toRoute,moveStopToTargetIndex} from './route-builder-model.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
import {catalogueMatches} from './place-composer-model.js';
import {parsePhotoSourceUrl,photoSourceKind,choosePlacePhoto} from './photo-quality.js';
import {friendlyNickname} from './account-scope.js';
import {MAX_PLACE_PHOTOS,photoFileProblem,photoCropDefaults,sanitizePhotoCrop,cropPlacePhoto,withCoverFirst} from './place-photo-model.js';
import {readAcceptedPhoto} from './place-photo-proposal.js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='city-route-v1';let storageOK=true,state;
try{state=JSON.parse(localStorage.getItem(key)||'null');}catch{storageOK=false;}
const uuid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const fresh=()=>({version:1,tester:{id:uuid(),nickname:'Explorer'},basket:[],basketsByCity:{},events:[],session:null});
if(!state||state.version!==1||!Array.isArray(state.basket)||!Array.isArray(state.events))state=fresh();
state.connections=state.connections||{};state.stay=state.stay||'';state.joined=state.joined||[];state.messages=state.messages||{};state.placeReviews=state.placeReviews||{};
state.friends=Array.isArray(state.friends)?state.friends:[];state.myRoutes=Array.isArray(state.myRoutes)?state.myRoutes:[];state.userPlaces=Array.isArray(state.userPlaces)?state.userPlaces:[];
state.savedPlacesByCity=state.savedPlacesByCity&&typeof state.savedPlacesByCity==='object'?state.savedPlacesByCity:{};
state.profile={bio:'',...state.profile,socials:{instagram:'',tiktok:'',web:'',...state.profile?.socials}};
state.cityId=state.cityId||DEFAULT_CITY_ID;state.basketsByCity=state.basketsByCity&&typeof state.basketsByCity==='object'?state.basketsByCity:{};state.builderMetaByCity=state.builderMetaByCity&&typeof state.builderMetaByCity==='object'?state.builderMetaByCity:{};if(!state.basketsByCity[DEFAULT_CITY_ID]&&state.basket.length)state.basketsByCity[DEFAULT_CITY_ID]=[...state.basket];state.basket=[...(state.basketsByCity[state.cityId]||[])];
let cities=[],taxonomy=null,activeCity=null,places=[],quests=[],routes=[],all={},cat='all',rcat='all',query='',cuisine='all',sort='default',pending=null,generated=null,generatedOptions=[],generatedIndex=0,generationPrefs=null,generationHistory=[],editing=false,keepQuery=false,here=null,draft=null,bookTab=null,speaking=false,evScope='global',evWhen='week',evKind='all';const evCache={};
// On the Places tab, only a conscious category selection reveals map pins.
// The catalogue list can still be browsed and searched without crowding the map.
let mapCategorySelected=false;
let mapView=null,renderedPlaceList=[],builderDraft=null,nearbyAfterId=null,nearbyRadiusM=500,addNewPlaceAfterId=null,justSavedPlaceId=null;
const providerOverlay=new Map(),providerLoading=new Set();let providerObserver=null;
const persist=()=>{try{if(state?.cityId){state.basketsByCity=state.basketsByCity||{};state.basketsByCity[state.cityId]=[...(state.basket||[])];if(builderDraft?.cityId===state.cityId){const {name,transport,revision,updatedAt}=serializeDraft(builderDraft);state.builderMetaByCity=state.builderMetaByCity||{};state.builderMetaByCity[state.cityId]={cityId:state.cityId,name,transport,revision,updatedAt};}}localStorage.setItem(key,JSON.stringify(state));}catch{storageOK=false;$('#connection').textContent='Zapis lokalny niedostępny. Wyeksportuj dane przed zamknięciem karty.';}};
const log=(type,data={})=>{state.events.push({type,...data,tester_id:state.tester.id,at:new Date().toISOString()});state.events=state.events.slice(-5000);persist();};
let toastTimer;function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}

// Formatting
const nf=new Intl.NumberFormat('pl-PL',{useGrouping:'always'}),fmt=n=>nf.format(n),dec=(v,d=1)=>v.toFixed(d).replace('.',',');
const plural=(n,one,few,many)=>n===1?one:[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?few:many;
const opinii=n=>`${fmt(n)} ${plural(n,'opinia','opinie','opinii')}`, stopsLabel=n=>`${n} ${plural(n,'przystanek','przystanki','przystanków')}`;
const minutes=n=>n>=60?`${Math.floor(n/60)} h${n%60?' '+n%60+' min':''}`:`${n} min`;
const ic=iconMarkup;
const brand=s=>`<span class="b b-${s}" aria-hidden="true"></span>`;
const SOURCES={google:'Google Maps',tripadvisor:'Tripadvisor'};
const items=ids=>ids.map(id=>all[id]).filter(Boolean);
// Keep the Places map blank until category opt-in; when active, only show draft markers in the current filtered list.
const stopsForPlacesMap=ids=>mapCategorySelected?items(ids).filter(p=>renderedPlaceList.some(v=>String(v.id)===String(p.id))):[];
const isLive=()=>!!state.session&&!state.session.finished;
const city=()=>activeCity||{id:DEFAULT_CITY_ID,slug:'warsaw',name:'Warszawa',center:{lat:52.2297,lng:21.0122},radiusKm:40,locale:'pl-PL',currency:'PLN'};
const now=()=>new Date().toISOString();
function hydrateBuilderDraft(cityId=city().id){const basket=state.basketsByCity?.[cityId]||[],stored=state.builderMetaByCity?.[cityId],meta=stored&&(!stored.cityId||stored.cityId===cityId)?stored:{};const result=hydrateDraft({...meta,cityId,stops:basket},{cityId,isKnown:id=>!!all[id],now:now()});builderDraft=result.draft;state.basket=[...builderDraft.stops];state.basketsByCity[cityId]=[...builderDraft.stops];return result.report;}
function setBuilderDraft(nextDraft,{eventType=null,eventData={}}={}){builderDraft=nextDraft;state.basket=[...nextDraft.stops];state.basketsByCity[nextDraft.cityId]=[...nextDraft.stops];mapView?.setRouteStops(stopsForPlacesMap(nextDraft.stops));if(eventType){state.events.push({type:eventType,...eventData,city_id:nextDraft.cityId,stops:nextDraft.stops.length,tester_id:state.tester.id,at:now()});state.events=state.events.slice(-5000);}persist();return nextDraft;}
function applyBuilder(result,opts){if(!result?.changed)return result;setBuilderDraft(result.draft,opts);return result;}
function setBuilderOrder(ids,method='optimize'){let d=builderDraft,changed=false;for(const [i,id] of ids.entries()){const r=moveStop(d,id,i,{now:now()});if(r.changed){d=r.draft;changed=true;}}if(changed)setBuilderDraft(d,{eventType:'builder_move',eventData:{method}});return changed;}
function loadRouteIntoBuilder(r){const result=hydrateDraft({cityId:city().id,stops:r.stops.filter(id=>all[id]),name:r.name||'',transport:r.transport||'walking'},{cityId:city().id,isKnown:id=>!!all[id],now:now()});setBuilderDraft(result.draft,{eventType:'route_edit',eventData:{route_id:r.id}});return result.report;}

// Navigation and categories
const TABS=[['plan','wand-sparkles','Ułóż trasę'],['routes','route','Trasy'],['places','compass','Miejsca'],['my-route','navigation','Moja trasa'],['book','ticket-percent','Zarezerwuj'],['about','library','Poradnik']];
const PLACE_CATS=[['all','Wszystkie','layers'],['saved','Zapisane','bookmark'],['mine','Moje miejsca','user-round'],['zabytki','Zabytki','landmark'],['muzea','Muzea','library'],['zielen','Zieleń','trees'],['widoki','Widoki i woda','waves'],['okolice','Ulice i okolice','signpost'],['jedzenie','Jedzenie','utensils'],['nocne','Bary i kluby','star'],['aktywnosci','Aktywności','flag']];
const ADD_PLACE_TYPES=[['zabytki','Zabytek'],['muzea','Muzeum'],['zielen','Park / ogród'],['widoki','Widok / woda'],['okolice','Ulica / okolica'],['jedzenie','Restauracja / kawiarnia'],['bar','Bar'],['pub','Pub'],['club','Klub nocny'],['cocktail_bar','Cocktail bar'],['live_music','Muzyka na żywo'],['sport','Sport / rekreacja'],['workshop','Warsztaty'],['experience','Inne doświadczenie']];
const userGroup=c=>({bar:'nocne',pub:'nocne',club:'nocne',cocktail_bar:'nocne',live_music:'nocne',sport:'aktywnosci',workshop:'aktywnosci',experience:'aktywnosci'}[c]||c);
const USER_TAGS={zabytki:['sightseeing','culture'],muzea:['culture'],zielen:['nature'],widoki:['views'],okolice:['hidden'],jedzenie:['food'],nocne:['nightlife'],aktywnosci:['hidden']};
const resident=()=>state.stay==='resident';
const isPublic=p=>p.visibility==='public';
// Until accounts and a shared database exist, "public" is a stated intent: nothing leaves the device yet.
const VIS_NOTE={private:'Miejsce widzisz tylko Ty.',public:'Propozycja trafia do wspólnego katalogu dopiero po zalogowaniu, wysłaniu i zatwierdzeniu przez moderatora.'};
const SUBMISSION_NOTE={needs_login:'Zapisano lokalnie. Zaloguj się w Profilu, a potem wyślij propozycję.',submitting:'Wysyłam zgłoszenie…',pending:'Czeka na zatwierdzenie. Inni nie widzą jeszcze tego miejsca.',approved:'Zatwierdzone. Miejsce jest dostępne w katalogu.',merged:'Połączone z istniejącym miejscem w katalogu.',rejected:'Moderator nie zatwierdził tej propozycji.',error:'Nie udało się wysłać. Miejsce nadal jest zapisane na urządzeniu.'};
const myPlaces=()=>forCity(state.userPlaces,city().id);
const catalog=()=>[...places,...myPlaces().filter(p=>!p.resolvedPlaceId||!places.some(x=>x.id===p.resolvedPlaceId))].filter(p=>p.kind!=='hotel');

const savedIds=()=>state.savedPlacesByCity[city().id]||[];
const savedPlace=p=>savedIds().includes(String(p.id));
const providerRatings=p=>{const original=Array.isArray(p?.ratings)?p.ratings:[],live=providerOverlay.get(p?.id)?.ratings||[];return [...live,...original.filter(x=>!live.some(r=>r.source===x.source))];};
// Provider responses are deliberately transient; only exempt Google place identifiers are stored locally.
async function enrichPlaceOnDemand(p){
 if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng))||providerOverlay.has(p.id)||providerLoading.has(p.id))return;
 providerLoading.add(p.id);
 const c=cities.find(x=>x.id===p.cityId)||city(),qs=new URLSearchParams({
  name:String(p.name),lat:String(p.lat),lng:String(p.lng),city:c.id,cityName:c.name||'Warszawa',
  centerLat:String(c.center?.lat||52.2297),centerLng:String(c.center?.lng||21.0122),
  r:String(c.radiusKm||40),googleId:p.googlePlaceId||''
 });
 try{
  const r=await fetch('/api/place-enrichment?'+qs.toString(),{cache:'no-store'}),data=await r.json();
  if(!r.ok||!['ok','no-match','no-key'].includes(data.status))return;
  if(!all[p.id]||p.cityId!==city().id)return;
  providerOverlay.set(p.id,{ratings:Array.isArray(data.ratings)?data.ratings:[],reviews:Array.isArray(data.reviews)?data.reviews:[],image:data.image||null});
  // A visible list row is swapped in place: re-rendering the whole screen per photo would rebuild the map and jump the scroll.
  const row=document.querySelector(`.place-list article.place[data-place-id="${CSS.escape(String(p.id))}"]`);
  if(row)row.outerHTML=placeRow(all[p.id]);else render();
  if($('#place-dialog')?.open&&$('#place-dialog').dataset.placeId===p.id)openPlace(p.id);
 }catch{/* Offline/provider unavailable; place itself remains saved. */}
 finally{providerLoading.delete(p.id);}
}

const ROUTE_CATS=[['all','Wszystkie'],['klasyka','Na pierwszy raz'],['zielen','Zieleń'],['wisla','Nad wodą'],['jedzenie','Z jedzeniem'],['lokalnie','Lokalnie']];
const catName=(id,list=PLACE_CATS)=>list.find(c=>c[0]===id)?.[1]||'';
const TAB_OF={routes:'routes',route:'routes',places:'places',events:'places','add-place':'places',plan:'plan','my-route':'my-route',book:'book',profile:'profile',sources:'profile',about:'about','community-route':'routes','social-profile':'routes','social-saved':'routes','social-saved-places':'routes'};
const LEGACY={home:['plan'],explore:['routes'],best:['places'],food:['places','jedzenie'],hotels:['book'],sidequests:['places','sidequests'],build:['plan'],active:['my-route'],discounts:['profile'],friends:['profile'],community:['profile'],chat:['profile']};
const route=()=>{const [t,id]=(location.hash.slice(1)||'').split('/');return [t,id];};
const avatar=(cls='')=>state.profile.photo?`<img class="avatar ${cls}" src="${esc(state.profile.photo)}" alt="">`:`<span class="avatar ${cls}" aria-hidden="true">${esc((!friendlyNickname(state.tester.nickname)?'O':state.tester.nickname[0]).toUpperCase())}</span>`;
function cityPicker(){const available=cities.filter(c=>['launch','next'].includes(c.status));return `<label class="city-select"><span class="sr-only">Wybierz miasto</span><span class="i" style="--i:url(./assets/icons/ui/map-pin.svg)" aria-hidden="true"></span><select id="city-select" aria-label="Wybierz miasto" ${isLive()?'disabled':''}>${available.map(c=>`<option value="${esc(c.id)}" ${c.id===city().id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`;}
async function switchCity(nextId){if(nextId===city().id)return;if(isLive())return toast('Najpierw zakończ aktywną trasę.');const next=cities.map(cityById.bind(null,cities)).find(c=>c?.id===nextId)||cities.find(c=>c.id===nextId);if(!next||!['launch','next'].includes(next.status))return toast('To miasto nie jest jeszcze dostępne.');state.basketsByCity[city().id]=[...state.basket];const previous=city(),previousBuilder=builderDraft;state.cityId=next.id;activeCity=next;state.basket=[...(state.basketsByCity[next.id]||[])];generated=null;generatedOptions=[];generationPrefs=null;generationHistory=[];generatedIndex=0;query='';cat='all';mapCategorySelected=false;rcat='all';cuisine='all';nearbyAfterId=null;addNewPlaceAfterId=null;try{const client=createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});const fallback=await loadCityFallback(next);const data=await loadCatalogueWithFallback({client,city:next,fallback});places=data.places;routes=data.routes;quests=next.id===DEFAULT_CITY_ID?forCity(withCityId(await fetchJson('./data/sidequests.json'),DEFAULT_CITY_ID),next.id):[];all=Object.fromEntries([...places,...quests,...forCity(state.userPlaces,next.id)].map(p=>[p.id,p]));const builderReport=hydrateBuilderDraft(next.id);document.documentElement.dataset.catalogueSource=data.source;document.title=`City Route · ${next.name}`;updateCityMeta(next);persist();location.hash='#plan';render();toast(builderReport.dropped.length?'Przełączono na '+next.name+'. '+builderReport.dropped.length+' miejsca nie są już dostępne.':'Przełączono na '+next.name+'.');}catch(error){state.cityId=previous.id;activeCity=previous;builderDraft=previousBuilder;state.basket=[...(state.basketsByCity[previous.id]||[])];throw error;}}
function nav(){$('#me').innerHTML=avatar('sm');$('#me').classList.toggle('active',['profile','sources'].includes(route()[0]));const [h,hid]=route(),t=h==='route'&&hid==='generated'?'plan':TAB_OF[h]||'plan',live=isLive(),chosen=live||state.basket.length>0;
 $('#navigation').innerHTML=TABS.map(([id,icon,label])=>{const mine=id==='my-route',cls=[t===id?'active':'',mine&&chosen?'chosen':'',mine&&live?'live':''].join(' ').trim();
  return `<a href="#${id}" class="${cls}" ${id==='plan'?'aria-label="Zaplanuj moją trasę"':''} ${t===id?'aria-current="page"':''}>${mine&&live?'<span class="pulse" aria-hidden="true"></span>':ic(icon)}<span>${label}</span>${mine&&chosen?`<small class="nav-status">${live?'W toku':'Gotowa'}</small>`:''}${mine&&!live&&state.basket.length?`<b class="badge" aria-label="${state.basket.length} w trasie">${state.basket.length}</b>`:''}</a>`;}).join('');}

// Shared pieces
function approvedPhoto(p){return choosePlacePhoto(p?.photoCandidates||[],{placeId:p?.id})}
// No authorised photo yet (loading, no provider match, or daily provider cap reached): an honest category tile.
const CAT_TILE={bar:['wine','night'],pub:['beer','night'],cocktail_bar:['martini','night'],wine_bar:['wine','night'],club:['disc-3','night'],live_music:['music','night'],
 restaurant:['utensils','food'],street_food:['utensils','food'],cafe:['coffee','food'],breakfast:['croissant','food'],bakery:['croissant','food'],dessert:['cake-slice','food'],food_hall:['store','food'],
 museum:['library','culture'],gallery:['palette','culture'],landmark:['landmark','culture'],architecture:['landmark','culture'],religious_site:['church','culture'],
 viewpoint:['binoculars','nature'],park:['trees','nature'],garden:['trees','nature'],walk:['trees','nature'],waterfront:['waves','nature'],beach:['waves','nature'],
 neighborhood:['signpost','city'],hidden_gem:['signpost','city'],hotel:['bed-double','stay'],hostel:['bed-double','stay'],guesthouse:['bed-double','stay'],apartment:['bed-double','stay'],sport:['trophy','city']};
const LEGACY_TILE={zabytki:'landmark',muzea:'museum',zielen:'park',widoki:'viewpoint',okolice:'neighborhood',jedzenie:'restaurant',nocne:'bar',noclegi:'hotel',aktywnosci:'sport'};
function catTile(p,cls,geo){const [icon,mood]=CAT_TILE[p?.categoryId]||CAT_TILE[LEGACY_TILE[p?.cats?.[0]]]||['map-pin','city'];return `<div class="ph ph-cat ph-${mood} ${cls}"${geo} aria-label="Brak fotografii lokalu">${ic(icon,'ph-cat-ghost')}${ic(icon,'ph-cat-glyph')}</div>`;}
function photo(p,cls='',eager=false){const image=p?.image||approvedPhoto(p)?.src||providerOverlay.get(p?.id)?.image?.src;if(!image){const geo=p?.id&&p?.name&&Number.isFinite(p?.lat)&&Number.isFinite(p?.lng)?` data-commons-photo="${esc(p.id)}" data-commons-name="${esc(p.name)}" data-commons-lat="${p.lat}" data-commons-lng="${p.lng}"`:'';return catTile(p,cls,geo);} const src=/^(https?:|data:image\/|\/api\/place-photo\?)/.test(image)?image:`./assets/images/${image}`;return `<img class="${cls}" src="${esc(src)}" alt="${esc(p.imageCaption||p.name)}" loading="${eager?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer">`;}
function credit(p){const c=p?.imageCredit||(!p?.image?(approvedPhoto(p)?.credit||providerOverlay.get(p?.id)?.image?.credit):null);if(!c)return '';const lic=c.licenseUrl?`<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a>`:esc(c.license);return `<p class="credit">${ic('camera')}<span>${p.imageCaption?esc(p.imageCaption)+'. ':''}Zdjęcie: ${esc(c.author)} · ${lic} · <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${esc(c.via)}</a></span></p>`;}
const rating=(p,s)=>providerRatings(p).find(r=>r.source===s);
const cityRouteBadge=p=>`<span class="cr-score" data-cityroute-ref="${esc(p.id)}" title="Średnia społeczności City Route — niezależna od ocen Google i Tripadvisor">${ic("star")} City Route · Brak ocen</span>`;
function scoreLine(p,compact=false){
 if(p.kind==='sidequest')return `<p class="idea">${ic('sparkles')}Pomysł City Route · przy: ${esc(all[p.placeId]?.name)}</p>`;
 if(p.kind==='user'&&!providerRatings(p).length)return `<p class="idea">${ic('user-round')}Dodane przez Ciebie · ${isPublic(p)?'propozycja społeczności':'prywatne'}</p>${cityRouteBadge(p)}`;
 const c=combinedRating(providerRatings(p)),chip=s=>{const r=rating(p,s),ok=Number.isFinite(r?.value);return `<span class="src src-${s}${ok?'':' none'}" title="${esc(SOURCES[s])}">${brand(s)}${ok?`${dec(r.value)} · ${fmt(r.reviewCount)}`:'brak'}</span>`;};
 return `<div class="score">${c.value===null?'<span class="muted">Brak ocen</span>':`<strong>${ic("star")} ${dec(c.value,2)}</strong><span>${opinii(c.total)}</span>`}</div>${compact?'':`<div class="srcs" aria-label="Oceny według platform">${chip('google')}${chip('tripadvisor')}</div>`}${cityRouteBadge(p)}`;}

function providerReviewSnippets(p){
 const rows=(providerOverlay.get(p.id)?.reviews||[]).filter(r=>['google','tripadvisor'].includes(r.source)&&r.text&&/^https:\/\//.test(r.url||'')).slice(0,6);
 if(!rows.length)return '';
 let html='<section class="provider-reviews" aria-label="Opinie z Google Maps i Tripadvisor"><h3>Wybrane opinie z platform</h3><p class="fine">Google: według trafności; Tripadvisor: najnowsze dostępne opinie. Tekst tylko z uprawnionych API, bez wpływu na oceny City Route.</p>';
 for(const r of rows){
  html+='<article class="provider-review"><header>'+brand(r.source);
  if(r.avatar)html+='<img class="review-avatar" src="'+esc(r.avatar)+'" alt="" loading="lazy" referrerpolicy="no-referrer">';
  if(r.authorUrl)html+='<a href="'+esc(r.authorUrl)+'" rel="noopener noreferrer" target="_blank"><strong>'+esc(r.author)+'</strong></a>';
  else html+='<strong>'+esc(r.author)+'</strong>';
  html+='<span>'+ic('star')+' '+(Number.isFinite(Number(r.rating))?dec(Number(r.rating)):'—')+'/5</span></header>';
  if(r.title)html+='<b>'+esc(r.title)+'</b>';
  html+='<p>'+esc(r.text)+'</p><div class="provider-review-meta">';
  if(r.when)html+='<small>'+esc(r.when)+'</small>';
  if(r.translated)html+='<small>Tłumaczenie udostępnione przez platformę</small>';
  html+='<a href="'+esc(r.url)+'" rel="noopener noreferrer" target="_blank">Zobacz w '+(r.source==='google'?'Google Maps':'Tripadvisor')+'</a></div></article>';
 }
 return html+'</section>';
}
function breakdown(p){const c=combinedRating(providerRatings(p));
 const rows=['google','tripadvisor'].map(s=>{const r=rating(p,s);if(!r||!Number.isFinite(r.value))return `<div class="row none">${brand(s)}<span class="name">${SOURCES[s]}</span><span class="why">${esc(r?.reason||'Brak oceny')}</span></div>`;
  return `<a class="row" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" data-action="source" data-id="${p.id}" data-source="${s}">${brand(s)}<span class="name">${SOURCES[s]}<small>${esc(r.listing)}</small></span><span class="val">${ic("star")} ${dec(r.value)}</span><span class="cnt">${opinii(r.reviewCount)}</span>${ic('arrow-up-right','go')}</a>`;}).join('');
 const share=c.parts.map(r=>`<span class="sh-${r.source}" style="width:${(r.reviewCount/c.total*100).toFixed(1)}%"></span>`).join('');
 return `<section class="breakdown" aria-label="Oceny z platform"><div class="total">${c.value===null?'<strong>—</strong><span>Brak ocen na obu platformach</span>':`<strong>${dec(c.value,2)}</strong><span>na 5 · ${opinii(c.total)} łącznie</span>`}</div>${c.total?`<div class="share" aria-hidden="true">${share}</div>`:''}${rows}${providerReviewSnippets(p)}<div class="city-route-own-rating"><strong>City Route · oceny społeczności</strong><span>${state.placeReviews[p.id]?`${ic("star")} ${state.placeReviews[p.id]}/5 · Twoja ocena`:'Jeszcze nie oceniłeś tego miejsca'}</span><small>Fioletowe oceny City Route nie wpływają na średnią Google i Tripadvisor. Po zalogowaniu ocena zatwierdzonego miejsca trafia również do społeczności.</small></div><p class="fine">Wynik łączny to średnia ważona liczbą opinii: każda opinia z Google i Tripadvisor waży tyle samo. Oceny katalogowe sprawdzono 2 listopada 2026; dane nowo dodanych miejsc są pobierane z oficjalnych API, jeśli są dostępne. <a href="#sources">Skąd są dane?</a></p></section>`;}
const q=p=>encodeURIComponent(searchQuery(p,city()));
function hotelLinks(p){const l=(href,label,src,primary)=>`<a class="button wide ${primary?'primary':''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-action="compare" data-id="${p.id}" data-source="${src}">${ic('arrow-up-right')}${label}</a>`;
 return `<p class="fine">Ceny na Twoje daty porównasz w Google Hotels, które zbiera oferty wielu serwisów rezerwacyjnych. City Route nie pokazuje jeszcze cen.</p>${l('https://www.google.com/travel/search?q='+q(p),'Porównaj ceny (Google Hotels)','google-hotels',true)}${l(p.bookingSearch||'https://www.booking.com/searchresults.pl.html?ss='+q(p),'Szukaj na Booking','booking')}${p.website?l(p.website,'Strona hotelu','official'):''}`;}
function addButton(p,wide=false){const added=state.basket.includes(p.id);if(p.kind==='hotel'||p.cats?.[0]==='noclegi')return wide&&p.kind==='hotel'?hotelLinks(p):'';
 return wide?`<button data-action="${added?'remove':'add'}" data-id="${p.id}" class="${added?'':'primary'} wide" aria-pressed="${added}">${ic(added?'minus':'plus')}${added?'Usuń z Mojej trasy':'Dodaj do Mojej trasy'}</button>`:`<button class="icon-btn ${added?'on':''}" data-action="${added?'remove':'add'}" data-id="${p.id}" aria-pressed="${added}" aria-label="${added?'Usuń z Mojej trasy':'Dodaj do Mojej trasy'}: ${esc(p.name)}" title="${added?'Usuń przystanek':'Dodaj przystanek'}">${ic(added?'check':'plus')}</button>`;}
function placesSearchBox(){
 const suggestions=query.trim().length>=2?catalogueMatches(query,catalog(),{limit:5}):[];
 return `<div class="places-search">${searchBox('Szukaj miejsca, np. S’poco Loco, klub, ramen…')}${suggestions.length?`<div class="place-suggest" aria-label="Podpowiedzi miejsc">${suggestions.map(p=>`<button type="button" data-action="jump-to-place" data-id="${esc(p.id)}"><span class="suggest-thumb">${photo(p)}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.area||catName(p.cats?.[0]))}</small></span>${ic('chevron-right')}</button>`).join('')}</div>`:''}</div>`;
}
function searchBox(ph){return `<label class="search">${ic('search')}<span class="sr-only">${ph}</span><input id="search" type="search" enterkeyhint="search" autocomplete="off" placeholder="${ph}" value="${esc(query)}">${query?`<button class="clear" data-action="clear-search" aria-label="Wyczyść wyszukiwanie">${ic('x')}</button>`:''}</label>`;}
function chips(list,current,action,icons=false){list=list.filter(([id])=>!(action==='cat'&&id==='noclegi'&&resident()));return `<div class="chips" role="group">${list.map(([id,label,icon])=>`<button data-action="${action}" data-value="${id}" aria-pressed="${current===id}" class="chip ${current===id?'selected':''}">${icons&&icon?ic(icon):''}${label}</button>`).join('')}</div>`;}
const cost=n=>n?`~${n} zł`:'Bezpłatnie';
function meta(ps,transport){const s=summary(ps,transport);return `<div class="meta"><span>${ic('clock')}${minutes(s.minutes)}</span><span>${ic('route')}~${dec(s.km)} km</span><span>${stopsLabel(ps.length)}</span><span>${cost(s.cost)}</span></div>`;}
const findRoute=id=>routes.find(r=>r.id===id)||state.myRoutes.find(r=>r.id===id)||(generated?.id===id?generated:null);
const coverRoutes=()=>[...routes,...forCity(state.myRoutes,city().id),...(generated?[generated]:[])];
const routeCoverAssignments=()=>assignRouteCovers(coverRoutes(),id=>all[id]);
const wholeRoute=(ps,t)=>ps.length>1?`<a class="button wide" href="${routeMapsUrl(ps,t)}" target="_blank" rel="noopener noreferrer" data-action="whole-route">${ic('map')}Cała trasa w Google Maps${ps.length>10?' (pierwsze 10 przystanków)':''}</a>`:'';
const liveBanner=()=>isLive()?`<a class="live-banner" href="#my-route"><span class="pulse" aria-hidden="true"></span><span><strong>Trasa w toku</strong>${esc(state.session.name)} · przystanek ${state.session.index+1} z ${state.session.stops.length}</span>${ic('chevron-right')}</a>`:'';

// Routes tab
function routeCard(r,big=false,covers=routeCoverAssignments()){const ps=items(r.stops),s=summary(ps,r.transport),cover=covers.get(r.id)||null;
 return `<a class="route-card ${big?'big':''}" href="#route/${r.id}" data-action="route-view" data-id="${r.id}"><div class="media">${photo(cover,'',big)}<span class="pill">${ic('clock')}${minutes(s.minutes)}</span></div><div class="body">${(r.cats||[]).length?`<p class="kicker">${r.cats.map(c=>catName(c,ROUTE_CATS)).join(' · ')}</p>`:''}<h3>${esc(r.name)}</h3><p class="desc">${esc(r.description)}</p><p class="path">${ps.map(p=>esc(p.name)).join(ic('chevron-right','path-sep'))}</p><div class="meta"><span>${stopsLabel(ps.length)}</span><span>~${dec(s.km)} km</span><span>${cost(s.cost)}</span></div></div></a>`;}
function routesView(){
 const hay=r=>`${r.name} ${r.description} ${items(r.stops).map(p=>p.name+' '+p.area).join(' ')} ${(r.cats||[]).map(c=>catName(c,ROUTE_CATS)).join(' ')}`;
 const list=routes.filter(r=>(rcat==='all'||r.cats.includes(rcat))&&matches(hay(r),query)),mine=forCity(state.myRoutes,city().id).filter(r=>matches(hay(r),query));
 const covers=routeCoverAssignments();
 const placeHits=query?catalog().filter(p=>matches(placeHay(p),query)).length:0;
 return `<section class="page-head"><p class="kicker">Odkrywaj trasy</p><h1>Dokąd dziś idziesz?</h1><p class="lead">${resident()?'Znasz miasto? Wybierz trasę przez miejsca, które zwykle mijasz.':`Gotowe spacery po ${esc(city().name)}. Wybierz, ruszaj, a aplikacja poprowadzi Cię przystanek po przystanku.`} <a class="inline" href="#about">Jak to działa?</a></p></section>${liveBanner()}${searchBox('Szukaj trasy, miejsca albo klimatu')}${chips(ROUTE_CATS,rcat,'rcat')}
 ${placeHits?`<button class="hint" data-action="search-places">${ic('map-pin')}<span>${placeHits} ${plural(placeHits,'miejsce pasuje','miejsca pasują','miejsc pasuje')} do „${esc(query)}” — pokaż w Miejscach</span>${ic('chevron-right')}</button>`:''}
 <div class="section-head"><h2>Polecane trasy</h2><span>${list.length} · redakcja City Route</span></div>
 ${list.length?`<div class="route-grid">${list.map((r,i)=>routeCard(r,i===0&&!query&&rcat==='all',covers)).join('')}</div>`:`<div class="empty"><p>Nie mamy trasy pasującej do „${esc(query)}”.</p><a class="button primary" href="#plan">${ic('wand-sparkles')}Ułóż własną trasę</a></div>`}
 <div class="section-head"><h2>Trasy społeczności</h2><span>${mine.length?'Twoje: '+mine.length:'wkrótce'}</span></div>
 ${mine.length?`<div class="route-grid">${mine.map(r=>routeCard(r,false,covers)).join('')}</div>`:''}
 <div class="community-note">${ic('users')}<div><strong>Społeczność dopiero startuje.</strong><p>Odkrywaj trasy innych lub opublikuj własną.</p></div></div>`;}

// Places tab
const exploreSwitch=on=>`<div class="segmented two" role="group" aria-label="Odkrywaj"><a href="#places" class="${on==='places'?'selected':''}" ${on==='places'?'aria-current="page"':''}>${ic('map-pin')}Miejsca</a><a href="#events" class="${on==='events'?'selected':''}" ${on==='events'?'aria-current="page"':''}>${ic('ticket-percent')}Wydarzenia</a></div>`;
const placeHay=p=>`${p.name} ${p.area} ${p.description||''} ${(p.cuisine||[]).join(' ')} ${(p.cats||[]).map(c=>catName(c)).join(' ')} ${(p.ratings||[]).map(r=>r.listing).join(' ')} ${p.address||''}`;
const away=p=>here?` · ${dec(distance(here,p))} km`:'';
function placeRow(p){return `<article class="place" data-place-id="${esc(p.id)}"><button class="hit" data-action="place" data-id="${p.id}" aria-label="Szczegóły: ${esc(p.name)}"></button><div class="thumb">${photo(p)}${p.top?'<span class="must">Must-see</span>':''}</div><div class="info"><h3>${esc(p.name)}</h3><p class="sub">${esc(p.area)}${p.cuisine?' · '+esc(p.cuisine.join(', ')):p.kind==='sidequest'?'':' · '+esc(catName(p.cats?.[0]))}${p.outside?' · z zewnątrz':''}${away(p)}</p>${scoreLine(p)}</div><div class="side"><button class="icon-btn save-place ${savedPlace(p)?'on':''}" data-action="bookmark" data-id="${esc(p.id)}" aria-pressed="${savedPlace(p)}" aria-label="${savedPlace(p)?'Usuń z Zapisanych':'Zapisz miejsce'}: ${esc(p.name)}">${ic('bookmark')}<span class="bookmark-label">${savedPlace(p)?'Zapisane':'Zapisz'}</span></button>${addButton(p)}</div></article>`;}
function placesView(){
 if(cat!=='sidequests'&&!PLACE_CATS.some(c=>c[0]===cat))cat='all';
 let list=cat==='sidequests'?[...quests]:cat==='mine'?myPlaces():[...new Map([...catalog(),...myPlaces().filter(savedPlace)].map(p=>[String(p.id),p])).values()].filter(p=>cat==='all'?catalog().some(x=>x.id===p.id):cat==='saved'?savedPlace(p):p.cats?.[0]===cat);
 list=list.filter(p=>matches(placeHay(p),query)&&(cat!=='jedzenie'||cuisine==='all'||(p.cuisine||[]).includes(cuisine)));
 const c=p=>combinedRating(p.ratings);
 if(sort==='default')list.sort((a,b)=>(b.kind==='user'?1:0)-(a.kind==='user'?1:0)||(b.top?1:0)-(a.top?1:0)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));if(sort==='near'&&here)list.sort((a,b)=>distance(here,a)-distance(here,b));
 if(sort==='rating')list.sort((a,b)=>smoothedRating(b.ratings)-smoothedRating(a.ratings));if(sort==='count')list.sort((a,b)=>c(b).total-c(a).total);
 renderedPlaceList=[...list];
 const cuisines=[...new Set(places.flatMap(p=>p.cuisine||[]))].sort((a,b)=>a.localeCompare(b,'pl'));
 return `${exploreSwitch('places')}<section class="page-head places-intro"><p class="kicker">Miejsca</p><h1>Co chcesz zobaczyć?</h1></section>${placesSearchBox()}${chips([...PLACE_CATS,['sidequests','Side questy','flag']],mapCategorySelected?cat:null,'cat',true)}${cat==='sidequests'?'<p class="note">Krótkie zadania przy konkretnych miejscach. Pomysły City Route — rekomendacje społeczności pojawią się później.</p>':''}${cat!=='sidequests'?(mapCategorySelected?'':'<p class="fine map-hint" role="status">Wybierz kategorię, aby wyświetlić miejsca na mapie.</p>')+'<div id="places-map" class="places-map-shell" aria-label="Mapa miejsc"></div>':''}<a class="add-place" href="#add-place">${ic('plus')}<span><strong>Dodaj własne miejsce</strong><small>Twoje ulubione miejsce, którego tu brakuje</small></span>${ic('chevron-right')}</a>
 ${cat==='jedzenie'?chips([['all','Każda kuchnia'],...cuisines.map(k=>[k,k[0].toUpperCase()+k.slice(1)])],cuisine,'cuisine'):''}
 
 <div class="list-head"><span>${list.length} ${plural(list.length,'wynik','wyniki','wyników')}</span><label class="sort">Sortuj<select id="sort"><option value="default" ${sort==='default'?'selected':''}>Polecane</option><option value="rating" ${sort==='rating'?'selected':''}>Najlepiej oceniane</option><option value="count" ${sort==='count'?'selected':''}>Najwięcej opinii</option><option value="near" ${sort==='near'?'selected':''}>Najbliżej mnie</option></select></label></div>
 <div class="place-list">${list.map(placeRow).join('')||`<div class="empty"><p>${cat==='saved'?'Nie masz jeszcze zapisanych miejsc. Otwórz dowolne miejsce i dodaj je do Zapisanych.':cat==='nocne'&&!query?'Jeszcze nie mamy w tym mieście opublikowanych barów i klubów. Pomóż uzupełnić przewodnik!':query?`Nic nie pasuje do „${esc(query)}”. Spróbuj innego słowa albo kategorii.`:'Na razie nie mamy miejsc w tej kategorii.'}</p>${query.trim().length>=2?(catalog().some(p=>matches(placeHay(p),query))?'<button type="button" class="button" data-action="show-all-search">'+ic('search')+'Szukaj we wszystkich kategoriach</button>':'<button type="button" class="button primary" data-action="suggest-add-place">'+ic('plus')+'Nie ma tego miejsca? Dodaj je</button>'):cat==='nocne'?'<a class="button primary" href="#add-place">Dodaj bar lub klub</a>':''}</div>`}</div><p class="foot"><a href="#sources">${ic('info')}Skąd są oceny i zdjęcia?</a></p>`;}
async function mountPlacesMap(){
 const host=$('#places-map');if(!host)return;
 const base=[...renderedPlaceList],baseById=new Map(base.map(p=>[String(p.id),p]));
 const client=createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});
 let view;
 const syncNearby=async center=>{
  if(mapView!==view)return;
  if(!center){view.setPlaces(base);return;}
  try{
   const categoryIds=[...new Set(base.map(p=>p.categoryId).filter(Boolean))];
   const rows=await loadNearbyPlaces(client,{city:city(),lat:center.lat,lng:center.lng,radiusM:500,maxResults:200,categoryIds});
   if(mapView!==view)return;
   const merged=rows.map(row=>{const full=baseById.get(String(row.id));return full?{...full,distanceM:row.distanceMeters}:null;}).filter(Boolean);
   view.setPlaces(merged);
  }catch{if(mapView===view)view.setPlaces(base);}
 };
 view=createMapView({
  container:host,places:base,city:city(),filter:{showPlaces:mapCategorySelected},
  onAddToRoute:p=>{if(isLive())return toast('Najpierw zakończ aktywną trasę.');if(!state.basket.includes(p.id)){const r=applyBuilder(addStop(builderDraft,p,{now:now()}),{eventType:'builder_add',eventData:{place_id:p.id,source:'map'}});if(r?.changed){log('add_to_route',{place_id:p.id,source:'map'});nav();toast(`Dodano jako ${builderDraft.stops.length}. przystanek`);}}},
  onDetails:p=>openPlace(p.id),
  onNearbyChange:syncNearby,
  isInRoute:p=>state.basket.includes(p.id)
 });
 mapView=view;
 // The Places map starts with zero pins, including route-stop overlays.
 // Once a category is selected, show only draft stops that belong to the visible category.
 view.setRouteStops(stopsForPlacesMap(builderDraft?.stops||[]));
}

// Newly added private/approved community places are enriched when visible, including after reload.
// Never auto-query all 275+ existing catalogue entries or spend provider quota on page load.
// Only rows that scroll into view are queued, at most three requests at a time, and the queue is dropped when the list
// changes, so a filter switch never spends provider quota on rows nobody saw. The Worker caps daily Google calls.
const enrichQueue=[];let enrichActive=0;
const needsProvider=p=>!!p&&!providerOverlay.has(p.id)&&(!p.image||!providerRatings(p).length);
function pumpEnrichment(){
 while(enrichActive<3&&enrichQueue.length){
  const p=enrichQueue.shift();enrichActive++;
  enrichPlaceOnDemand(p).finally(()=>{enrichActive--;pumpEnrichment();});
 }
}
function observeApprovedPlaceEnrichment(){
 providerObserver?.disconnect();providerObserver=null;enrichQueue.length=0;
 if(typeof IntersectionObserver==='undefined')return;
 const rows=[...document.querySelectorAll('.place-list article.place[data-place-id]')];
 if(!rows.length)return;
 const io=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   io.unobserve(entry.target);
   const p=all[entry.target.dataset.placeId];
   if(needsProvider(p)&&!enrichQueue.includes(p)){enrichQueue.push(p);pumpEnrichment();}
  }
 },{rootMargin:'180px 0px'});
 for(const row of rows)if(needsProvider(all[row.dataset.placeId]))io.observe(row);
 providerObserver=io;
}
function openPlace(id){const p=all[id];if(!p)return;if(!providerOverlay.has(p.id)&&(p.kind==='user'||(!p.image&&!providerRatings(p).length)))void enrichPlaceOnDemand(p);const d=$('#place-dialog');const freshlySaved=id===justSavedPlaceId||(d.open&&d.dataset.placeId===id&&!!d.querySelector('[data-action="add-another-place"]'));if(id===justSavedPlaceId)justSavedPlaceId=null;const anchor=p.kind==='sidequest'?all[p.placeId]:null;d.dataset.placeId=id;if(/^[0-9a-f-]{36}$/.test(p.communitySubmissionId||''))d.dataset.gallerySubmissionId=p.communitySubmissionId;else delete d.dataset.gallerySubmissionId;
 d.innerHTML=`<div class="sheet-media">${photo(p,'sheet-photo',true)}<form method="dialog"><button class="close" aria-label="Zamknij">${ic('x')}</button></form></div><div class="sheet-body"><p class="kicker">${esc(p.area)}${p.kind==='sidequest'?' · Side quest':(p.cats||[]).map(c=>' · '+esc(catName(c))).join('')}</p><h2 id="sheet-title">${esc(p.name)}</h2><p>${esc(p.description)}</p>${p.address?`<p class="muted">${ic('map-pin')}${esc(p.address)}</p>`:''}
 ${p.outside?`<p class="note">Na trasie to krótki postój przy budynku (ok. ${p.minutes} min). Zwiedzanie wnętrz jest osobne, zwykle płatne i trwa dłużej.</p>`:''}
 ${anchor?`<button class="row-link" data-action="place" data-id="${anchor.id}">${ic('map-pin')}<span>Zadanie przy: <strong>${esc(anchor.name)}</strong></span>${ic('chevron-right')}</button>`:p.kind==='user'?`<div class="note vis"><strong>${isPublic(p)?'Zaproponowane społeczności':'Prywatne'}</strong><p>${isPublic(p)?(SUBMISSION_NOTE[p.submissionStatus]||'Miejsce zapisane lokalnie. Możesz wysłać propozycję do moderacji.'):VIS_NOTE.private}</p>${isPublic(p)&&(!['pending','submitting','approved','merged','rejected'].includes(p.submissionStatus)||(p.submissionStatus==='pending'&&p.galleryUploadError))?`<button class="sm" data-community-submit="${esc(p.id)}">${p.submissionStatus==='pending'?'Ponów przesyłanie zdjęć':'Wyślij do społeczności'}</button>`:''}<button class="sm" data-action="toggle-visibility" data-id="${p.id}" ${['pending','submitting','approved','merged'].includes(p.submissionStatus)?'disabled title="Zgłoszone miejsca można wycofać tylko przez moderację"':''}>${isPublic(p)?'Zmień tylko lokalny widok':'Zaproponuj społeczności'}</button></div>`:breakdown(p)}${p.kind==='user'?breakdown(p):''}
 ${p.kind==='user'&&Array.isArray(p.images)&&p.images.length>1?`<section class="place-own-gallery" aria-label="Galeria Twojego miejsca"><strong>Twoje zdjęcia</strong><div>${p.images.map((image,index)=>`<button type="button" data-action="view-own-photo" data-id="${esc(p.id)}" data-value="${index}" aria-label="Pokaż zdjęcie ${index+1}"><img src="${esc(image)}" alt="Zdjęcie ${index+1}"></button>`).join('')}</div><small>${p.visibility==='public'&&p.photoUploaded&&Array.isArray(p.galleryUploadedPositions)&&p.galleryUploadedPositions.length>=p.images.length-1?'Zdjęcia wysłane do moderacji · czekają na publikację':'Zdjęcia zapisane na tym urządzeniu'}</small></section>`:''}<div class="sheet-actions"><button class="wide save-place ${savedPlace(p)?'on':''}" data-action="bookmark" data-id="${esc(p.id)}" aria-pressed="${savedPlace(p)}">${ic('bookmark')}${savedPlace(p)?'Usuń z Zapisanych':'Zapisz miejsce'}</button>${addButton(p,true)}${freshlySaved?`<button type="button" class="wide" data-action="add-another-place">${ic('plus')}Dodaj kolejne miejsce</button>`:''}${p.kind!=='hotel'?`<a class="button wide" href="${mapsUrl(p)}" target="_blank" rel="noopener noreferrer">${ic('navigation')}Prowadź w Google Maps</a>`:''}${p.outside||p.cats?.[0]==='muzea'?ticketLinks(p):''}${p.website&&p.kind!=='hotel'?`<a class="button wide" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">${ic('arrow-up-right')}Strona i menu</a>`:''}${p.photoSourcePage&&parsePhotoSourceUrl(p.photoSourcePage)?`<a class="button wide" href="${esc(p.photoSourcePage)}" target="_blank" rel="noopener noreferrer">${ic('arrow-up-right')}Profil / strona miejsca</a>`:''}${p.kind==='user'?`<button class="wide danger" data-action="delete-place" data-id="${p.id}">${ic('trash-2')}Usuń moje miejsce</button>`:''}</div>
 <form id="place-review-form" class="my-review" data-id="${p.id}"><label>Twoja ocena<select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}" ${state.placeReviews[p.id]===n?'selected':''}>Ocena ${n}/5</option>`).join('')}</select></label><button>${state.placeReviews[p.id]?'Zmień':'Zapisz'}</button><p class="fine">Twoja ocena zostaje na tym urządzeniu i nie zmienia wyniku z platform. Oceny społeczności włączymy, gdy będzie ich dość.</p></form>${credit(p)}</div>`;
 if(!d.open)d.showModal();d.scrollTop=0;}

// Events: global ones from ticket platforms, community ones later from verified users
const EV_WHEN=[['today','Dziś',1],['weekend','Weekend',7],['week','7 dni',7],['month','30 dni',30]];
const EV_KIND=[['all','Wszystko'],['koncerty','Koncerty'],['teatr','Teatr'],['sport','Sport'],['kino','Kino'],['inne','Inne']];
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function weekendDays(now=new Date()){const d=new Date(now),out=[];const toFri=(5-d.getDay()+7)%7;if(d.getDay()===0||d.getDay()===6){d.setDate(d.getDate()-(d.getDay()===0?2:1));}else d.setDate(d.getDate()+toFri);for(let i=0;i<3;i++){out.push(dayKey(d));d.setDate(d.getDate()+1);}return out;}
function loadEvents(days){if(evCache[days])return evCache[days];evCache[days]={status:'loading'};fetch(`./api/events?days=${days}`).then(r=>r.ok||r.status===502?r.json():{status:'unavailable'}).catch(()=>({status:navigator.onLine?'unavailable':'offline'})).then(d=>{evCache[days]=d;if(route()[0]==='events')render();});return evCache[days];}
const when=e=>{const d=new Date(`${e.date}T${e.time||'12:00'}`);return d.toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'})+(e.time?' · '+e.time:'');};
function eventCard(e){return `<article class="event"><div class="media">${e.image?`<img src="${esc(e.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<div class="ph">${ic('ticket-percent')}</div>`}<span class="pill">${ic('clock')}${esc(when(e))}</span></div><div class="body"><p class="kicker">${esc(catName(e.kind,EV_KIND))}${e.genre?' · '+esc(e.genre):''}</p><h3>${esc(e.name)}</h3><p class="sub">${ic('map-pin')}${esc(e.venue)}${e.address?', '+esc(e.address):''}</p><div class="event-foot"><span>${e.price?`od ${fmt(Math.round(e.price.min))} ${e.price.currency==='PLN'?'zł':esc(e.price.currency)}`:'Cena u sprzedawcy'}</span>${e.officialUrl?out(e.officialUrl,'Oficjalna strona wydarzenia','event-ticket',e.id,'official',true):'<span class="fine">Oficjalna strona wydarzenia: do uzupełnienia.</span>'}</div><details><summary>Wyprzedane? Sprawdź innych sprzedawców</summary>${out(e.url,'Ticketmaster','event-ticket',e.id,e.source)}<p class="fine">Dostępność sprawdzisz u sprzedawcy.</p></details></div></article>`;}
function globalEvents(){const days=EV_WHEN.find(w=>w[0]===evWhen)[2],d=loadEvents(days);
 if(d.status==='loading')return `<div class="empty"><p>Sprawdzamy, co dzieje się w ${esc(city().name)}…</p></div>`;
 if(d.status==='no-key')return `<div class="empty">${ic('ticket-percent')}<p><strong>Podłączamy źródła wydarzeń.</strong></p><p>Pierwsze będzie Ticketmaster, potem Going. i inne serwisy biletowe. Nie pokazujemy wymyślonych wydarzeń, więc do tego czasu ta lista jest pusta.</p></div>`;
 if(d.status!=='ok')return `<div class="empty"><p>${d.status==='offline'?'Jesteś offline. Wydarzenia wymagają internetu.':'Nie udało się teraz pobrać wydarzeń. Spróbuj za chwilę.'}</p><button data-action="events-retry">Spróbuj ponownie</button></div>`;
 const today=dayKey(new Date()),wk=weekendDays();let list=d.events.filter(e=>evWhen==='today'?e.date===today:evWhen==='weekend'?wk.includes(e.date):true).filter(e=>evKind==='all'||e.kind===evKind).filter(e=>matches(`${e.name} ${e.venue} ${e.genre} ${catName(e.kind,EV_KIND)}`,query));
 return `<div class="list-head"><span>${list.length} ${plural(list.length,'wydarzenie','wydarzenia','wydarzeń')}</span><span>Źródło: Ticketmaster · aktualizacja co godzinę</span></div><div class="event-grid">${list.map(eventCard).join('')||'<div class="empty"><p>Nic w tym terminie. Wybierz dłuższy okres albo inny rodzaj.</p></div>'}</div>`;}
const communityEvents=()=>`<div class="community-note">${ic('users')}<div><strong>Spacery grupowe, spotkania i wydarzenia od społeczności</strong><p>Ta funkcja jest w przygotowaniu. Obecnie nie można jeszcze utworzyć publicznego wydarzenia, zapisać się ani polubić czy polecić spotkania.</p><p>Docelowo organizator ustali termin i miejsce zbiórki, opcjonalnie połączy spotkanie z trasą. Zobaczysz oddzielne liczniki: zainteresowani, uczestnicy i polecenia — na podstawie rzeczywistych zgłoszeń.</p><p>Nie pokazujemy fikcyjnych wydarzeń ani liczników.</p><a class="button" href="#routes/community">Przejdź do Społeczności</a></div></div>`;
function eventsView(){return `${exploreSwitch('events')}<section class="page-head"><p class="kicker">Wydarzenia</p><h1>Co się dzieje w ${esc(city().id==='warsaw'?'Warszawie':city().id==='krakow'?'Krakowie':city().name)}?</h1><p class="lead">Odkrywaj koncerty i wydarzenia miejskie. Wkrótce także wspólne spacery i spotkania organizowane przez odkrywców.</p></section>
 <div class="segmented two" role="group">${[['global','Globalne'],['community','Społecznościowe']].map(([k,l])=>`<button data-action="ev-scope" data-value="${k}" aria-pressed="${evScope===k}" class="${evScope===k?'selected':''}">${l}</button>`).join('')}</div>
 ${evScope==='community'?communityEvents():`${searchBox('Szukaj: artysta, miejsce, gatunek…')}${chips(EV_WHEN.map(([k,l])=>[k,l]),evWhen,'ev-when')}${chips(EV_KIND,evKind,'ev-kind')}${globalEvents()}`}`;}

// Book tab: everything you pay for, kept apart from exploring
const BOOK=[['hotels','Noclegi','bed-double'],['tickets','Bilety i wycieczki','ticket-percent'],['tables','Stoliki','utensils']];
const out=(href,label,action,id,src,primary=false)=>`<a class="button sm ${primary?'primary':''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-action="${action}" data-id="${id}" data-source="${src}">${label}${ic('arrow-up-right')}</a>`;
function bookRow(p,links){return `<article class="place book"><button class="hit" data-action="place" data-id="${p.id}" aria-label="Szczegóły: ${esc(p.name)}"></button><div class="thumb">${photo(p)}</div><div class="info"><h3>${esc(p.name)}</h3><p class="sub">${esc(p.area)}${p.cuisine?' · '+esc(p.cuisine.join(', ')):''}</p>${scoreLine(p,true)}<div class="links">${links}</div></div></article>`;}
function ticketLinks(p){return `${p.admission==='outside-free'?'<p class="fine">Postój na zewnątrz nie jest biletowany. Zwiedzanie wnętrz może wymagać biletu.</p>':''}${p.officialTicketUrl?out(p.officialTicketUrl,'Oficjalna strona i bilety','ticket',p.id,'official',true):'<p class="fine">Oficjalny link do biletów: do uzupełnienia.</p>'}<details class="ticket-alternatives"><summary>Wyprzedane? Sprawdź innych sprzedawców</summary><p class="fine">Porównaj termin i zakres oferty. Nie potwierdzamy dostępności ani współpracy partnerskiej.</p>${out('https://www.getyourguide.com/s/?q='+q(p),'Szukaj w GetYourGuide','ticket',p.id,'getyourguide')}</details>`;}
function bookView(){const tab=bookTab||(resident()?'tickets':'hotels');let intro='',list='';
 if(tab==='hotels'){intro='Ceny na Twoje daty porównasz w Google Hotels, które zbiera oferty wielu serwisów. City Route nie pokazuje jeszcze cen i nie pobiera prowizji.';list=places.filter(p=>p.kind==='hotel').sort((a,b)=>smoothedRating(b.ratings)-smoothedRating(a.ratings)).map(p=>bookRow(p,out('https://www.google.com/travel/search?q='+q(p),'Porównaj ceny','compare',p.id,'google-hotels',true)+out(p.bookingSearch||'https://www.booking.com/searchresults.pl.html?ss='+q(p),'Booking','compare',p.id,'booking')+(p.website?out(p.website,'Strona hotelu','compare',p.id,'official'):''))).join('');}
 if(tab==='tickets'){intro='Muzea i zabytki z biletem wstępu. Godziny i ceny sprawdź przed wyjściem.';list=places.filter(p=>p.cats[0]==='muzea'||p.outside).map(p=>bookRow(p,ticketLinks(p))).join('');}
 if(tab==='tables'){intro='Restauracje z naszej listy. Rezerwacja odbywa się na stronie lokalu albo w Google Maps.';list=places.filter(p=>p.kind==='restaurant').sort((a,b)=>smoothedRating(b.ratings)-smoothedRating(a.ratings)).map(p=>bookRow(p,(p.website?out(p.website,'Strona i rezerwacja','table',p.id,'official',true):'')+out(rating(p,'google')?.url||mapsUrl(p),'Google Maps','table',p.id,'google'))).join('');}
 return `<section class="page-head"><p class="kicker">Zarezerwuj</p><h1>Noclegi, bilety, stoliki.</h1></section><div class="segmented three" role="group">${BOOK.map(([k,l,i])=>`<button data-action="book-tab" data-value="${k}" aria-pressed="${tab===k}" class="${tab===k?'selected':''}">${ic(i)}${l}</button>`).join('')}</div><p class="note">${intro}</p><div class="place-list">${list}</div>`;}

// Gallery is stored locally; hosted moderation currently accepts only the cover image.
function ownPhotoGallery(d){
 const photos=Array.isArray(d.photos)?d.photos.slice(0,MAX_PLACE_PHOTOS):[];
 if(!photos.length)return '';
 const active=photos.find(p=>p.id===d.editPhotoId)||photos[0],crop=sanitizePhotoCrop(active.crop);
 const ratio=crop.ratio==='1:1'?'1':crop.ratio==='16:9'?'16/9':'4/3';
 return `<section class="place-photo-editor" aria-label="Zdjęcia miejsca">
  <div class="place-photo-editor-heading"><strong>Zdjęcia ${photos.length}/${MAX_PLACE_PHOTOS}</strong><span>Wybierz i dopasuj kadr</span></div>
  <div class="place-photo-thumbnails">${photos.map((p,i)=>`<div class="place-photo-item ${p.id===active.id?'selected':''}">
   <button type="button" data-action="edit-place-photo" data-photo-id="${esc(p.id)}" aria-pressed="${p.id===active.id}" aria-label="Kadruj zdjęcie ${i+1}"><img src="${esc(p.source)}" alt="Zdjęcie ${i+1}"></button>
   <span class="place-photo-label">${i===0?'Główne':'Zdjęcie '+(i+1)}</span>
   <button type="button" class="place-photo-remove" data-action="remove-place-photo" data-photo-id="${esc(p.id)}" aria-label="Usuń zdjęcie ${i+1}">${ic('x')}</button>
  </div>`).join('')}</div>
  <div class="place-photo-crop" data-active-photo="${esc(active.id)}">
   <div class="place-photo-frame" style="aspect-ratio:${ratio}"><img src="${esc(active.source)}" alt="Podgląd kadrowania" style="object-position:${crop.x}% ${crop.y}%;transform:scale(${crop.zoom});transform-origin:${crop.x}% ${crop.y}%"></div>
   <div class="place-photo-controls"><label>Format <select data-photo-crop="ratio"><option value="4:3" ${crop.ratio==='4:3'?'selected':''}>4:3</option><option value="1:1" ${crop.ratio==='1:1'?'selected':''}>1:1</option><option value="16:9" ${crop.ratio==='16:9'?'selected':''}>16:9</option></select></label>
    <label>Poziom <input type="range" data-photo-crop="x" min="0" max="100" step="5" value="${crop.x}"></label>
    <label>Pion <input type="range" data-photo-crop="y" min="0" max="100" step="5" value="${crop.y}"></label>
    <label>Przybliżenie <input type="range" data-photo-crop="zoom" min="1" max="2.5" step=".1" value="${crop.zoom}"></label>
   </div>
   ${photos[0].id!==active.id?`<button type="button" class="place-photo-cover" data-action="cover-place-photo" data-photo-id="${esc(active.id)}">${ic('bookmark')}Ustaw jako zdjęcie główne</button>`:''}
  </div>
 </section>`;
}
// Add a place
function addPlaceView(){const d=draft||{};return `<section class="page-head"><a class="back" href="#places">${ic('arrow-left')}Miejsca</a><p class="kicker">Nowe miejsce</p><h1>Dodaj swoje miejsce</h1></section>
 <form id="place-form" class="profile-form"><label>Nazwa<input name="name" required maxlength="60" value="${esc(d.name||'')}" placeholder="Np. Kawiarnia na rogu"></label>
 <label class="add-category">Rodzaj miejsca<select name="cat" required>${ADD_PLACE_TYPES.map(([v,l])=>`<option value="${v}" ${(d.cat||'okolice')===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <label>Krótko, dlaczego warto<textarea name="note" maxlength="200" rows="3" placeholder="Np. Najlepsze cynamonki na Pradze.">${esc(d.note||'')}</textarea></label>
 <fieldset class="plain"><legend>Twoja ocena (opcjonalnie)</legend>${radio('rating',[['none','Bez oceny'],['1','1/5'],['2','2/5'],['3','3/5'],['4','4/5'],['5','5/5']],d.rating||'none')}</fieldset>
 <fieldset class="plain"><legend>Kto to zobaczy?</legend>${radio('vis',[['private','Tylko dla mnie'],['public','Zaproponuj społeczności']],d.vis||'private')}<p class="fine">Propozycję publiczną sprawdzi moderator.</p></fieldset>
 <fieldset class="plain"><legend>Gdzie to jest?</legend><button type="button" data-action="locate" class="wide">${ic('locate-fixed')}${d.lat?'Lokalizacja ustawiona':'Jestem tu teraz — użyj mojej lokalizacji'}</button><label class="sub-label">albo wklej link z Google Maps lub współrzędne<input name="where" value="${esc(d.where||'')}" placeholder="https://www.google.com/maps/place/… lub 52.23, 21.01" autocomplete="off"></label></fieldset>
 <label class="file">${ic('image-plus')}<span>${d.photos?.length?`Dodaj kolejne zdjęcia (${d.photos.length}/5)`:'Dodaj zdjęcia (maks. 5)'}</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" multiple data-action="photo"></label>${ownPhotoGallery(d)}
 <details class="photo-source-hint"><summary>Masz stronę lub Instagram/Facebook tego miejsca?</summary><label>Oficjalny link (opcjonalnie)<input name="photo_source_url" inputmode="url" type="url" autocomplete="url" value="${esc(d.sourcePageUrl||'')}" placeholder="https://strona-klubu.pl lub https://instagram.com/klub"></label><p class="fine">Link pomaga w znalezieniu oryginalnych zdjęć. City Route nie kopiuje automatycznie zdjęć z profili; do publikacji potrzebne są prawa lub uprawniony dostawca.</p></details><label class="place-photo-rights" data-photo-rights ${!d.photos?.length||d.vis!=='public'?'hidden':''}><input type="checkbox" name="image_rights" value="yes" ${d.imageRights?'checked':''}> Mam prawa do przesyłanych zdjęć i zgadzam się na opublikowanie zdjęcia głównego w City Route.</label>${d.vis==='public'&&d.photos?.length?'<p class="photo-sync-note">Obecnie udostępniamy społeczności zdjęcie główne. Pozostałe zostają na tym urządzeniu.</p>':''}
 <button class="primary big">${ic('plus')}Zapisz miejsce</button></form><p class="fine add-request-alt">Nie chcesz dodawać samodzielnie? <a href="#places/request" data-request-entry data-kind="place">Poproś City Route o dodanie</a>.</p>`;}
function shrink(file,max=800){return new Promise((ok,bad)=>{const img=new Image();img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);ok(c.toDataURL('image/jpeg',.72));};img.onerror=bad;img.src=URL.createObjectURL(file);});}
const keepDraft=()=>{const f=$('#place-form');if(!f)return;const v=new FormData(f);draft={...draft,name:v.get('name'),cat:v.get('cat'),note:v.get('note'),where:v.get('where'),vis:v.get('vis'),rating:v.get('rating'),imageRights:v.get('image_rights')==='yes',sourcePageUrl:String(v.get('photo_source_url')||'').trim()};};

// Plan tab
const radio=(name,opts,val)=>`<div class="choice" role="radiogroup">${opts.map(([v,l])=>`<label><input type="radio" name="${name}" value="${v}" ${v===val?'checked':''}><span>${l}</span></label>`).join('')}</div>`;
function planView(){const timeZone=city().timezone||'Europe/Warsaw',today=localDate(timeZone),suggested=suggestVisitStart({timeZone}),date=generationPrefs?.visitDate&&generationPrefs.visitDate>=today?generationPrefs.visitDate:suggested.date,time=generationPrefs?.visitDate&&generationPrefs.visitDate>=today?(generationPrefs?.startTime||suggested.time):suggested.time,mode=generationPrefs?.visitMode||'inside';return `<section class="page-head"><p class="kicker">TWÓJ CZAS · TWOJE MIEJSCA</p><h1>Odkrywaj miasto po swojemu.</h1><a class="inline" href="#routes">Wolisz gotowy pomysł? Zobacz trasy${ic('chevron-right','link-arrow')}</a></section><a class="start-here" href="#about" aria-label="Zacznij tutaj — poznaj funkcje City Route"><span class="start-here-icon">${ic('compass')}</span><span class="start-here-copy"><strong>Nowy tutaj? Poznaj City Route</strong></span>${ic('chevron-right')}</a>${liveBanner()}
 <a class="button wide" href="#my-route">${ic("pencil")}Ułożę trasę samodzielnie — dodaję i przesuwam miejsca</a><form id="build-form" class="planner"><fieldset><legend>Ile masz czasu?</legend>${radio('time',[['60','1 h'],['120','2 h'],['240','4 h'],['360','Pół dnia'],['480','Cały dzień']],'120')}</fieldset>
 <fieldset class="planner-when"><legend>Kiedy chcesz zwiedzać?</legend><div class="planner-when-fields"><label>Data<input type="date" name="visitDate" required min="${today}" value="${esc(date)}"></label><label>Start<input type="time" name="startTime" required min="06:00" max="22:00" value="${esc(time)}"></label></div><p class="fine">Godziny sprawdzamy dla wybranych muzeów. Pozostałe wymagają potwierdzenia.</p></fieldset>
 <fieldset><legend>Chcesz wchodzić do muzeów?</legend>${radio('visitMode',[['inside','Tak — sprawdź godziny wejścia'],['outside','Nie — tylko oglądanie z zewnątrz']],mode)}</fieldset>
 <fieldset><legend>Na co masz ochotę?</legend><div class="choice">${[['mix','Wszystko po trochu'],['sightseeing','Klasyka'],['culture','Kultura'],['nature','Zieleń'],['views','Widoki'],['food','Jedzenie'],['hidden','Nieoczywiste']].map(([v,l])=>`<label><input type="checkbox" name="interests" value="${v}" ${v==='mix'?'checked':''}><span>${l}</span></label>`).join('')}</div></fieldset>
 <fieldset><legend>Jak się poruszasz?</legend>${radio('transport',[['walking','Pieszo'],['bike','Rower'],['transit','Komunikacja'],['mix','Różnie']],'walking')}</fieldset>
 <fieldset><legend>Kawa albo jedzenie po drodze?</legend>${radio('food',[['none','Nie'],['quick','Kawa lub przekąska'],['sit','Restauracja']],'none')}</fieldset>
 <fieldset><legend>Skąd ruszasz?</legend>${radio('start',[['here','Stąd, gdzie jestem'],['any','Obojętnie']],'here')}</fieldset>
 <details class="more"><summary>${ic('sliders-horizontal')}Więcej ustawień</summary><fieldset><legend>Budżet</legend>${radio('budget',[['low','Do 25 zł'],['medium','Do 100 zł'],['premium','Bez limitu']],'medium')}</fieldset><fieldset><legend>Styl zwiedzania</legend>${radio('tourist',[['balanced','Pół na pół'],['must','Najważniejsze punkty'],['local','Bardziej lokalnie']],'balanced')}</fieldset><input type="hidden" name="offers" value="no"><fieldset class="planner-sponsors-disabled" disabled aria-disabled="true"><legend>Oferty partnerów <small>Wkrótce</small></legend>${radio('offers',[['no','Brak ofert'],['yes','Sponsorowane']],'no')}</fieldset><p class="fine">Trasy sponsorowane są nieaktywne do czasu uruchomienia prawdziwych partnerstw. Czas dojazdu rowerem i komunikacją jest szacunkowy.</p></details>
 <button class="primary big">${ic('wand-sparkles')}Ułóż moją trasę</button></form>`;}

// Route detail
function stopList(ps,editable=false){return `<ol class="stops">${ps.map((p,i)=>`<li ${editable?`data-stop="${p.id}"`:""}><span class="n">${i+1}</span>${editable?`<button class="drag-handle" aria-label="Przeciągnij: ${esc(p.name)}" title="Przeciągnij, aby zmienić kolejność">${ic('grip-vertical')}</button>`:""}<button class="stop-main" data-action="place" data-id="${p.id}"><span class="thumb">${photo(p)}</span><span class="txt"><strong>${esc(p.name)}</strong><small>${esc(p.area)} · ${p.minutes} min${p.cost?' · ~'+p.cost+' zł':''}</small></span></button>${editable?`<span class="tools"><button class="icon-btn" data-action="up" data-id="${p.id}" aria-label="Wyżej: ${esc(p.name)}" ${i===0?'disabled':''}>${ic('arrow-up')}</button><button class="icon-btn" data-action="down" data-id="${p.id}" aria-label="Niżej: ${esc(p.name)}" ${i===ps.length-1?'disabled':''}>${ic('arrow-down')}</button><button class="icon-btn" data-action="nearby-stop" data-id="${p.id}" aria-label="Pokaż miejsca w pobliżu: ${esc(p.name)}" aria-expanded="${nearbyAfterId===p.id?'true':'false'}">${ic('map-pin')}</button><button class="icon-btn" data-action="remove" data-id="${p.id}" aria-label="Usuń: ${esc(p.name)}">${ic('x')}</button></span>`:''}</li>`).join('')}</ol>`;}

function routeNearbySuggestions(){
 if(!nearbyAfterId||!builderDraft?.stops.includes(nearbyAfterId))return '';
 const anchor=all[nearbyAfterId];if(!anchor)return '';
 const matches=nearbyPlaces(catalog(),anchor,nearbyRadiusM).filter(p=>p.id!==anchor.id&&!builderDraft.stops.includes(p.id)).slice(0,6);
 const renderMatch=p=>`<article class="place"><div class="thumb">${photo(p)}</div><div class="info"><h3>${esc(p.name)}</h3><p class="sub">${esc(p.area||'')}${p.distanceM!=null?' · '+Math.round(p.distanceM)+' m':''}</p></div><div class="side"><button class="primary" data-action="add-nearby" data-id="${esc(p.id)}" data-after="${esc(anchor.id)}" aria-label="Dodaj ${esc(p.name)} po ${esc(anchor.name)}">${ic('plus')}Dodaj</button></div></article>`;
 return `<section id="nearby-stop-suggestions" class="detail" aria-label="Miejsca w pobliżu wybranego przystanku"><div class="section-head"><h2>W pobliżu: ${esc(anchor.name)}</h2><button data-action="nearby-stop" data-id="${esc(anchor.id)}" aria-label="Zamknij miejsca w pobliżu">${ic('x')}</button></div><p class="fine">Wybierz miejsce, aby wstawić je bezpośrednio po tym przystanku.</p><div class="detail-actions"><button data-action="nearby-radius" data-value="500" aria-pressed="${nearbyRadiusM===500}">500 m</button><button data-action="nearby-radius" data-value="1000" aria-pressed="${nearbyRadiusM===1000}">1 km</button></div><div class="place-list">${matches.map(renderMatch).join('')||'<p class="note">Brak innych miejsc w tym promieniu w naszym katalogu. Możesz dodać własny punkt.</p>'}</div><a class="button wide" href="#add-place" data-action="nearby-custom" data-after="${esc(anchor.id)}">${ic('plus')}Dodaj nowe miejsce po tym przystanku</a></section>`;
}
const estimation='<p class="fine">Czas i dystans to szacunek (odległość w linii prostej × 1,3). Godziny otwarcia i dokładną drogę sprawdzisz w Google Maps. Bilety wstępu nie są wliczone.</p>';
function generatedPicker(){
 if(!generatedOptions.length)return '';
 const options=generatedOptions.map((option,i)=>{
  const ps=items(option.stops),stats=summary(ps,option.transport),selected=i===generatedIndex;
  const names=ps.slice(0,3).map(p=>p.name).join(' · ');
  return `<button type="button" class="generated-option ${selected?'selected':''}" data-action="choose-generated" data-value="${i}" aria-pressed="${selected}" aria-label="Wariant ${i+1}, ${stopsLabel(ps.length)}, ${minutes(stats.minutes)}"><span class="generated-option-title"><strong>Wariant ${i+1}</strong><span>${selected?'Wybrany':'Zobacz trasę'}</span></span><small>${stopsLabel(ps.length)} · około ${minutes(stats.minutes)}</small><span class="generated-option-stops">${esc(names)}</span></button>`;
 }).join('');
 return `<section class="generated-picker" aria-labelledby="generated-heading"><h2 id="generated-heading">Wybierz trasę dla siebie</h2><p class="lead">Oto ${generatedOptions.length} ${generatedOptions.length===1?'propozycja':generatedOptions.length<5?'propozycje':'propozycji'} na podstawie Twoich ustawień. Wybierz jedną lub sprawdź inne.</p><div class="generated-options">${options}</div><div class="generated-picker-actions"><button type="button" data-action="refresh-generated">${ic('shuffle')}Pokaż inne propozycje</button><a href="#plan">Zmień ustawienia</a></div></section>`;
}
function generatedTimingView(ps){
 if(!generationPrefs)return '';
 const timeline=scheduleRoute(ps,{cityId:city().id,date:generationPrefs.visitDate,startTime:generationPrefs.startTime,
  mode:generationPrefs.visitMode,transport:generationPrefs.transport,origin:generationPrefs.start,maxMinutes:Number(generationPrefs.time)});
 const day=new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'long',year:'numeric',timeZone:city().timezone||'Europe/Warsaw'})
  .format(new Date(generationPrefs.visitDate+'T12:00:00Z'));
 return `<section class="detail route-timeline" aria-label="Orientacyjny plan dnia"><h2>Plan na ${esc(day)} · od ${esc(generationPrefs.startTime)}</h2>
 <p class="fine">Orientacyjne czasy podróży i zwiedzania, bez danych o ruchu i kolejkach. Godziny wejścia do wybranych muzeów sprawdziliśmy 4.11.2026; nie są danymi na żywo. Przed zakupem biletu potwierdź termin.</p>
 <ol class="timeline-list">${timeline.rows.map(x=>`<li><strong>${esc(x.visitStart)}–${esc(x.departure)}</strong><span>${esc(x.name)}<small>${x.status==='known'?`Zweryfikowane ${esc(x.opening.label)}`:x.status==='unknown'?'Godziny wymagają sprawdzenia':x.status==='closed'?'Nieczynne':x.status==='exterior'?'Z zewnątrz':'Zwiedzanie bez potwierdzonych godzin'}${x.wait?' · oczekiwanie '+x.wait+' min':''}${x.opening.source?` · <a href="${esc(x.opening.source)}" target="_blank" rel="noopener noreferrer">Źródło</a>`:''}</small></span></li>`).join('')}</ol>
 ${timeline.unknownCount?`<p class="fine">Uwaga: ${timeline.unknownCount} ${timeline.unknownCount===1?'miejsce wymaga':'miejsca wymagają'} sprawdzenia godzin otwarcia.</p>`:''}
 <p class="fine">Plan jest podglądem na wybrany dzień; po zapisaniu samej trasy jej harmonogram nie jest jeszcze synchronizowany między urządzeniami.</p></section>`;
}
function detailView(r){const ps=items(r.stops),own=state.myRoutes.some(x=>x.id===r.id),cover=routeCoverAssignments().get(r.id)||null;
 return `<section class="detail"><a class="back" href="${r.id==='generated'?'#plan':'#routes'}">${ic('arrow-left')}${r.id==='generated'?'Ułóż trasę':'Trasy'}</a>${r.id==='generated'?generatedPicker():''}<div class="cover">${photo(cover,'',true)}</div>${credit(cover)}<p class="kicker">${r.id==='generated'?'Ułożona dla Ciebie':own?'Twoja trasa':'Redakcja City Route'}${(r.cats||[]).map(c=>' · '+catName(c,ROUTE_CATS)).join('')}</p><h1>${esc(r.name)}</h1><p class="lead">${esc(r.description)}</p>${meta(ps,r.transport)}
 <div class="detail-actions"><button class="primary big" data-action="start" data-id="${r.id}">${ic('play')}Rozpocznij trasę</button>${r.id==='generated'?`<button data-action="save-generated">${ic('bookmark')}Zapisz trasę</button>`:''}<button data-action="save-route" data-id="${r.id}">${ic('pencil')}Edytuj jako Moją trasę</button>${wholeRoute(ps,r.transport)}${!own&&r.id!=='generated'?`<button type="button" data-route-share="editorial" data-route-ref="${esc(r.id)}" data-route-city="${esc(city().id)}" data-route-title="${esc(r.name)}">${ic("link")}Udostępnij</button>`:''}${own?`<button class="danger" data-action="delete-route" data-id="${r.id}">${ic('trash-2')}Usuń tę trasę</button>`:''}</div><h2>Przystanki</h2>${stopList(ps)}${r.id==='generated'?generatedTimingView(ps):''}${estimation}</section>`;}

// My route tab
function liveView(){const s=state.session,p=all[s.stops[s.index]],next=items(s.stops.slice(s.index+1));
 const quest=quests.find(x=>x.placeId===p.id),voice='speechSynthesis'in window;
 return `<section class="live"><div class="live-head"><span class="pulse" aria-hidden="true"></span><span>W toku · ${esc(s.name)}</span></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.stops.length}" aria-valuenow="${s.index}" aria-label="Postęp trasy"><span style="width:${s.index/s.stops.length*100}%"></span></div><p class="kicker">Przystanek ${s.index+1} z ${s.stops.length}</p>
 <article class="now"><div class="media">${photo(p,'',true)}</div><div class="body"><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p>${p.kind==='sidequest'?scoreLine(p):scoreLine(p,true)}${voice?`<button class="listen" data-action="listen" data-id="${p.id}">${ic(speaking?'x':'radio')}${speaking?'Zatrzymaj':'Posłuchaj o tym miejscu'}</button>`:''}</div></article>${quest?`<div class="quest">${ic('flag')}<div><strong>Side quest przy tym miejscu</strong><p>${esc(quest.description)}</p></div></div>`:''}
 <a class="button primary big" href="${mapsUrl(p,s.transport)}" target="_blank" rel="noopener noreferrer">${ic('navigation')}Prowadź do tego przystanku</a>${s.awaitingRating===p.id?`<section class="stop-rating" aria-label="Ocena odwiedzonego miejsca"><h2>Jak oceniasz to miejsce?</h2><p>Ocena jest dobrowolna i na razie zapisywana tylko na tym urządzeniu. Nie wpływa na ocenę Google ani Tripadvisor.</p><div class="stop-rating-stars" role="group" aria-label="Oceń przystanek od 1 do 5">${[1,2,3,4,5].map(n=>`<button type="button" data-action="arrival-rating" data-value="${n}" aria-label="${n} z 5 gwiazdek" class="${state.placeReviews[p.id]===n?'selected':''}">${n} ${ic("star")}</button>`).join('')}</div><button class="text-button" data-action="arrival-skip-rating">Pomiń ocenę i idź dalej</button></section>`:`<div class="live-actions"><button class="go" data-action="done">${ic('check')}Jestem tu, dalej</button><button data-action="skip">Pomiń</button></div>`}
 ${next.length?`<h2>Dalej na trasie</h2><ol class="next">${next.map(x=>`<li><span class="thumb">${photo(x)}</span><span>${esc(x.name)}<small>${esc(x.area)}</small></span></li>`).join('')}</ol>`:'<p class="note">To ostatni przystanek.</p>'}${wholeRoute([p,...next],s.transport)}<button class="text-button danger" data-action="abandon">Zakończ trasę teraz</button></section>`;}
function finishedView(){const s=state.session,done=s.results.filter(r=>r.status==='done').length;
 return `<section class="finished"><div class="badge-big">${ic('flag')}</div><p class="kicker">Trasa ukończona</p><h1>Kawałek ${esc(city().name)} więcej.</h1><p>Ukończone: ${done} z ${s.stops.length} · pominięte: ${s.results.length-done}</p>${s.recommend?'<p class="note">Dzięki! Twoja opinia jest zapisana na tym urządzeniu.</p>':`<p>Poleciłbyś tę trasę znajomym?</p><div class="actions"><button class="primary" data-action="recommend" data-value="yes">Tak</button><button data-action="recommend" data-value="no">Raczej nie</button></div>`}<div class="finished-share"><h2>Podziel się przebytą trasą</h2><p>Możesz opublikować dokładnie tę trasę, którą ukończyłeś — bez ponownego dodawania przystanków.</p>${s.stops.length>=2?`<button type="button" class="primary big wide" data-action="publish-finished">${ic('users')}Opublikuj trasę w Społeczności</button>`:'<p class="fine">Do publikacji potrzebne są przynajmniej dwa przystanki.</p>'}${/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s.routeId||'')?`<a class="button wide" href="#community-route/${esc(s.routeId)}">${ic('star')}Oceń trasę autora i zostaw opinię</a>`:''}</div><div class="actions"><a class="button" href="#routes">Wybierz kolejną trasę</a><button class="text-button" data-action="close-session">Wyczyść</button></div></section>`;}
function myRouteView(){if(isLive())return liveView();const ps=items(state.basket),transport=builderDraft?.transport||'walking';let html=state.session?.finished?finishedView():'';
 if(ps.length)html+=`<section class="page-head"><p class="kicker">Moja trasa</p><h1>Twoje przystanki.</h1><p class="lead">Przeciągnij uchwyt przy przystanku albo użyj strzałek. Zapisz i ruszaj.</p></section><div class="profile-form"><label>Nazwa trasy<input id="builder-name" maxlength="80" value="${esc(builderDraft?.name||'')}" placeholder="Moja trasa"></label><label>Poruszanie<select id="builder-transport"><option value="walking" ${transport==='walking'?'selected':''}>Pieszo</option><option value="bike" ${transport==='bike'?'selected':''}>Rower</option><option value="transit" ${transport==='transit'?'selected':''}>Komunikacja</option><option value="mix" ${transport==='mix'?'selected':''}>Różnie</option></select></label></div>${meta(ps,transport)}<div class="detail-actions"><button class="primary big" data-action="start" data-id="basket">${ic('play')}Rozpocznij trasę</button><button data-action="optimize">${ic('shuffle')}Zoptymalizuj trasę</button><button data-action="save-basket">${ic('bookmark')}Zapisz trasę</button><button class="text-button danger" data-action="clear-builder">Wyczyść trasę</button>${wholeRoute(ps,transport)}</div><a class="button wide" href="#places">${ic("plus")}Dodaj kolejny przystanek</a>${stopList(ps,true)}${routeNearbySuggestions()}${estimation}`;
 else if(!state.session)html+=`<section class="empty-state"><div class="badge-big">${ic('navigation')}</div><h1>Tu pojawi się Twoja trasa.</h1><p>Wybierz gotowy spacer albo dodaj miejsca, które chcesz zobaczyć. Gdy ruszysz, ta zakładka poprowadzi Cię na żywo.</p><div class="stack"><a class="button primary big" href="#routes">${ic('route')}Wybierz gotową trasę</a><a class="button big" href="#plan">${ic('wand-sparkles')}Zaplanuj własną</a><a class="button big" href="#places">${ic('map-pin')}Dodaj miejsca</a></div></section>`;
 return html;}

// Profile tab
const STAY=[['resident','Mieszkam tutaj'],['visitor','Jestem na wycieczce'],['temporary','Zostaję na dłużej']];
function socialUrl(kind,v){v=String(v||'').trim();if(!v)return '';
 if(kind==='web'){try{const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);return ['http:','https:'].includes(u.protocol)&&u.hostname.includes('.')?u.href:'';}catch{return '';}}
 const host=kind==='instagram'?'instagram.com':'tiktok.com';
 if(/^https?:\/\//i.test(v)){try{const u=new URL(v);return u.hostname.replace(/^www\./,'')===host?u.href:'';}catch{return '';}}
 const h=v.replace(/^@/,'');return /^[A-Za-z0-9._]{1,30}$/.test(h)?`https://www.${host}/${kind==='tiktok'?'@':''}${h}`:'';}
function stats(){const n=t=>state.events.filter(e=>e.type===t).length,visited=new Set(state.events.filter(e=>e.type==='stop_complete').map(e=>e.place_id)).size;
 return [[visited,'Odwiedzone miejsca'],[Object.keys(state.placeReviews).length,'Wystawione oceny'],[n('route_complete'),'Ukończone trasy'],[state.myRoutes.length,'Utworzone trasy'],[state.userPlaces.length,'Dodane miejsca']];}
function savedPlacesView(){
 const list=[...new Map([...catalog(),...myPlaces()].filter(savedPlace).map(p=>[String(p.id),p])).values()];
 return `<section class="page-head"><p class="kicker">Społeczność · Twoje kolekcje</p><h1>Zapisane miejsca</h1><p class="lead">Miejsca zapisane na tym urządzeniu. Swoje dodane miejsca znajdziesz także w „Moje miejsca”.</p><a href="#places" data-action="show-my-places" class="inline">Moje dodane miejsca${ic('chevron-right','link-arrow')}</a></section><div class="place-list">${list.map(placeRow).join('')||'<div class="empty"><p>Jeszcze nic tu nie ma. Zapisz miejsce zakładką w katalogu.</p><a href="#places">Przeglądaj miejsca</a></div>'}</div>`;
}
function profileView(){const name=friendlyNickname(state.tester.nickname)?state.tester.nickname:'Odkrywca',so=state.profile.socials,links=[['instagram','Instagram'],['tiktok','TikTok'],['web','Strona']].map(([k,l])=>[l,socialUrl(k,so[k])]).filter(x=>x[1]);
 if(editing)return `<section class="page-head"><p class="kicker">Profil</p><h1>Edytuj profil</h1></section><form id="profile-form" class="profile-form"><label>Nazwa<input name="nickname" maxlength="40" value="${esc(friendlyNickname(state.tester.nickname)?state.tester.nickname:'')}" placeholder="Odkrywca" autocomplete="nickname"></label><label class="file">${state.profile.photo?avatar('sm'):ic('image-plus')}<span>${state.profile.photo?'Zmień zdjęcie profilowe':'Dodaj zdjęcie profilowe'}</span><input type="file" accept="image/*" data-action="avatar"></label>${state.profile.photo?'<button type="button" class="text-button danger" data-action="remove-avatar">Usuń zdjęcie</button>':''}<label>Krótko o sobie<textarea name="bio" maxlength="160" rows="3" placeholder="Np. Lubię poranne spacery i dobrą kawę.">${esc(state.profile.bio)}</textarea></label><label>Instagram<input name="instagram" value="${esc(so.instagram)}" placeholder="@twojanazwa" autocomplete="off"></label><label>TikTok<input name="tiktok" value="${esc(so.tiktok)}" placeholder="@twojanazwa" autocomplete="off"></label><label>Strona lub inny link<input name="web" value="${esc(so.web)}" placeholder="twojastrona.pl" inputmode="url" autocomplete="url"></label><div class="actions"><button class="primary">Zapisz</button><button type="button" data-action="cancel-edit">Anuluj</button></div></form>`;
 return `<section class="profile-card">${avatar()}<div><h1>${esc(name)}</h1>${state.stay?`<p class="kicker">${esc(STAY.find(s=>s[0]===state.stay)?.[1]||'')}</p>`:''}<p class="bio">${esc(state.profile.bio)}</p>${links.length?`<p class="socials">${links.map(([l,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer me">${ic('link')}${l}</a>`).join('')}</p>`:''}</div><button class="icon-btn" data-action="edit-profile" aria-label="Edytuj profil">${ic('pencil')}</button></section>
 <div class="profile-social-counts" data-profile-social-counts aria-live="polite"><span><strong data-profile-followers>—</strong><small>Obserwujący</small></span><span><strong data-profile-following>—</strong><small>Obserwowani</small></span><span><strong data-profile-friends>—</strong><small>Znajomi</small></span></div>
 <h2 class="h-sm">Jak jesteś w ${esc(city().name)}?</h2><div class="segmented" role="group">${STAY.map(([k,l])=>`<button data-action="stay" data-value="${k}" aria-pressed="${state.stay===k}" class="${state.stay===k?'selected':''}">${l}</button>`).join('')}</div>${state.stay==='temporary'?'<p class="fine">Na 1–12 miesięcy: praca, studia, dłuższy wyjazd.</p>':''}
 <details class="profile-disclosure profile-statistics"><summary><span>Twoje statystyki</span>${ic('chevron-down')}</summary><div class="stats">${stats().map(([v,l])=>l==='Dodane miejsca'?`<button type="button" data-action="show-my-places" class="stat-link" aria-label="Zobacz swoje dodane miejsca"><strong>${v}</strong><span>${l} ${ic('chevron-right')}</span></button>`:`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</div></details>
 <details class="profile-disclosure profile-more"><summary><span>Więcej</span>${ic('chevron-down')}</summary><div class="profile-more-content"><div class="menu"><a href="#about">${ic('compass')}<span>Poradnik City Route<small>Wszystkie funkcje krok po kroku</small></span>${ic('chevron-right')}</a><a href="#sources">${ic('info')}<span>Skąd są dane<small>Oceny, zdjęcia i ich ograniczenia</small></span>${ic('chevron-right')}</a><button data-action="export">${ic('arrow-down')}<span>Pobierz swoje dane (.json)<small>${state.events.length} zapisanych zdarzeń</small></span></button><button data-action="reset" class="danger">${ic('x')}<span>Usuń dane z tego urządzenia</span></button></div></div></details>`;}

// ONBOARDING-MENU-050: complete, searchable, permanently available guide.
function aboutView(){return guideView();}

// Data sources page
function sourcesView(){const ps=places,withImages=ps.filter(p=>!!p.image).length,has=s=>ps.filter(p=>Number.isFinite(rating(p,s)?.value)).length,both=ps.filter(p=>combinedRating(p.ratings).parts.length===2).length,commons=ps.filter(p=>p.imageCredit?.via==='Wikimedia Commons').length,pexels=ps.filter(p=>p.imageCredit?.via==='Pexels').length,venue=ps.filter(p=>p.imageCredit?.via==='oficjalna strona').length;
 return `<section class="page-head"><a class="back" href="#profile">${ic('arrow-left')}Profil</a><p class="kicker">Przejrzystość</p><h1>Skąd są dane</h1><p class="lead">City Route zbiera to, co już mówią inne serwisy, i pokazuje źródło przy każdej liczbie.</p></section>
 <div class="facts"><div><strong>${has('google')}/${ps.length}</strong><span>miejsc z oceną Google Maps</span></div><div><strong>${has('tripadvisor')}/${ps.length}</strong><span>miejsc z oceną Tripadvisor</span></div><div><strong>${both}</strong><span>z ocenami z obu platform</span></div><div><strong>${withImages}/${ps.length}</strong><span>miejsc ze zdjęciem</span></div></div>
 <div class="prose"><h2>Oceny</h2><p>Oceny i liczby opinii przepisaliśmy ręcznie 2 listopada 2026: z panelu miejsca w Google Maps oraz z wyników wyszukiwania stron obiektów na Tripadvisor. To migawka, nie dane na żywo. Jeśli platforma nie ma oceny (np. ulica albo plac w Google), piszemy „brak” i nie wliczamy jej do wyniku.</p><p>Wynik łączny to średnia ważona liczbą opinii. Google ma zwykle więcej opinii, więc waży więcej. Miejsce słabo opisane w jednym serwisie wciąż dostaje wynik z drugiego.</p><h2>Zdjęcia</h2><p>${commons} zdjęć pochodzi z Wikimedia Commons, ${pexels} z Pexels (wolne licencje, autor podany przy zdjęciu). ${venue} lokali ma zdjęcie z własnej strony internetowej, a kilka lokali w Koneserze i na Saskiej Kępie pokazuje budynek lub ulicę, przy której są. Zdjęć z Google i Tripadvisor nie kopiujemy, bo ich licencja na to nie pozwala.</p><h2>Czego jeszcze nie ma</h2><p>GetYourGuide i Atlas Obscura nie są jeszcze podłączone. Oceny społeczności City Route pojawią się, gdy będzie wystarczająco dużo prawdziwych użytkowników.</p></div>`;}

// Render
function render(){const cityHost=document.querySelector('.city-host');if(cityHost)cityHost.innerHTML=cityPicker();let [tab,id]=route();
 if(LEGACY[tab]){const [t,c]=LEGACY[tab];if(c){cat=c;cuisine='all';}location.replace('#'+t);return;}
 if(!TAB_OF[tab]){location.replace('#'+(isLive()?'my-route':'plan'));return;}
 nav();let html='';
 if(tab==='routes')html=routesView();else if(tab==='places')html=placesView();else if(tab==='plan')html=planView();else if(tab==='my-route')html=myRouteView();else if(tab==='profile')html=profileView();else if(tab==='book')html=bookView();else if(tab==='events')html=eventsView();
 else if(tab==='route'){const r=findRoute(id);html=r?detailView(r):`<div class="empty"><p>Ta trasa nie jest już dostępna.</p><a class="button" href="#routes">Wszystkie trasy</a></div>`;}
 else if(tab==='sources')html=sourcesView();else if(tab==='about')html=aboutView();else if(tab==='add-place')html=addPlaceView();else if(tab==='social-saved-places')html=savedPlacesView();
 mapView?.destroy();mapView=null;$('#main').innerHTML=html;if(tab==='profile')window.dispatchEvent(new Event('cityroute:profile-rendered'));document.body.classList.toggle('is-live',isLive());if(tab==='places'){mountPlacesMap();observeApprovedPlaceEnrichment();}}
function start(r){const stops=r.stops.filter(id=>all[id]);if(!stops.length)return toast('Najpierw dodaj co najmniej jedno miejsce.');state.session={id:uuid(),name:r.name,routeId:r.id,stops,index:0,results:[],finished:false,transport:r.transport||'walking',startedAt:new Date().toISOString()};log('route_start',{route_id:r.id,session_id:state.session.id,stops:stops.length});location.hash='my-route';render();}
function saveRoute(r){const saved={id:'mine-'+uuid().slice(0,8),cityId:city().id,name:r.name,description:r.description,stops:r.stops.slice(),cats:[],transport:r.transport||'walking',createdAt:new Date().toISOString()};state.myRoutes.unshift(saved);log('route_save',{route_id:saved.id,stops:saved.stops.length});return saved;}

document.addEventListener('click',e=>{
 const d=$('#place-dialog');if(e.target===d){d.close();return;}
 const b=e.target.closest('[data-action]');if(!b)return;const {action,id,value}=b.dataset;
 if(isLive()&&['add','remove','up','down','optimize','save-route','clear-builder','delete-place'].includes(action))return toast('Najpierw zakończ aktywną trasę.');
 if(action==='place')return openPlace(id);
 if(action==='view-own-photo'){const photo=all[id]?.images?.[Number(value)];const image=d?.querySelector('.sheet-media img.sheet-photo');if(/^data:image\/jpeg;base64,/.test(photo||'')&&image)image.src=photo;return;}
 if(action==='edit-place-photo'||action==='remove-place-photo'||action==='cover-place-photo'){
  const photos=Array.isArray(draft?.photos)?draft.photos:[],photoId=b.dataset.photoId;
  if(action==='edit-place-photo'){keepDraft();draft.editPhotoId=photoId;}
  if(action==='remove-place-photo'){keepDraft();draft.photos=photos.filter(p=>p.id!==photoId);draft.editPhotoId=draft.photos[0]?.id||null;draft.imageRights=false;}
  if(action==='cover-place-photo'){keepDraft();draft.photos=withCoverFirst(photos,photoId);draft.editPhotoId=photoId;}
  render();return;
 }
 if(action==='show-my-places'||action==='show-saved-places'){cat=action==='show-my-places'?'mine':'saved';mapCategorySelected=true;query='';if(location.hash==='#places')render();else location.hash='#places';return;}
 if(action==='jump-to-place'){cat='all';query='';render();openPlace(id);return;}
 if(action==='add-another-place'){d?.close();draft=null;location.hash='add-place';return;}
 if(action==='route-view')log('route_view',{route_id:id});
 if(action==='cat'){cat=value;mapCategorySelected=true;cuisine='all';render();}
 if(action==='bookmark'){const p=all[id];if(!p)return;const ids=savedIds(),was=ids.includes(id);state.savedPlacesByCity[city().id]=was?ids.filter(x=>x!==id):[...ids,id];persist();render();window.dispatchEvent(new CustomEvent('cityroute:saved-changed',{detail:{cityId:city().id,placeId:id,saved:!was}}));if(d?.open&&d.dataset.placeId===id)openPlace(id);toast(was?'Usunięto z Zapisanych.':'Zapisano miejsce.');return;}
 if(action==='rcat'){rcat=value;render();}
 if(action==='cuisine'){cuisine=value;render();}
 if(action==='clear-search'){query='';render();$('#search')?.focus();}
 if(action==='search-places'){cat='all';mapCategorySelected=true;keepQuery=true;location.hash='places';}
 if(action==='show-all-search'){cat='all';mapCategorySelected=true;cuisine='all';render();return;}
 if(action==='suggest-add-place'){const name=query.trim().slice(0,60);if(name.length<2)return;draft={name,cat:'okolice',vis:'private',rating:'none',photos:[],imageRights:false};query='';location.hash='#add-place';return;}
 if(action==='add'&&!state.basket.includes(id)){const r=applyBuilder(addStop(builderDraft,all[id],{now:now()}),{eventType:'builder_add',eventData:{place_id:id,source:b.dataset.source||'ui'}});if(r?.changed){log('add_to_route',{place_id:id,source:b.dataset.source||'ui'});render();if(d.open)openPlace(id);toast(`Dodano jako ${builderDraft.stops.length}. przystanek`);}}
 if(action==='remove'){const r=applyBuilder(removeStop(builderDraft,id,{now:now()}),{eventType:'builder_remove',eventData:{place_id:id}});if(r?.changed){render();if(d?.open)openPlace(id);toast('Usunięto przystanek z Mojej trasy.');}}
 if(action==='up'||action==='down'){const r=applyBuilder(moveStopBy(builderDraft,id,action==='up'?-1:1,{now:now()}),{eventType:'builder_move',eventData:{place_id:id,method:'buttons'}});if(r?.changed)render();}
 if(action==='optimize'){
  const result=optimizeRoutePlaces(items(state.basket),{origin:null,transport:builderDraft?.transport||'walking'});
  if(result.status==='invalid-coordinates')return toast('Brakuje współrzędnych. Popraw lokalizację punktu.');
  if(result.changed&&setBuilderOrder(result.places.map(p=>p.id),'optimize')){nearbyAfterId=null;render();const saved=Math.max(0,Math.round(result.estimatedSavingsMinutes));toast(saved>0?'Ułożono trasę efektywniej. Szacowana oszczędność przemieszczania: '+saved+' min.':'Ułożono trasę efektywniej.');}
  else toast('Trasa jest już ułożona efektywnie według szacowanych odległości.');
 }
 if(action==='nearby-stop'){if(isLive())return toast('Najpierw zakończ aktywną trasę.');nearbyAfterId=nearbyAfterId===id?null:id;nearbyRadiusM=500;render();document.querySelector('#nearby-stop-suggestions')?.scrollIntoView?.({block:'nearest'});}
 if(action==='nearby-radius'){nearbyRadiusM=value==='1000'?1000:500;render();document.querySelector('#nearby-stop-suggestions')?.scrollIntoView?.({block:'nearest'});}
 if(action==='add-nearby'){
   const at=builderDraft?.stops.indexOf(b.dataset.after)??-1;
   if(at<0||!all[id])return toast('Przystanek nie jest już dostępny.');
   const added=applyBuilder(addStop(builderDraft,all[id],{at:at+1,now:now()}),{eventType:'builder_add',eventData:{place_id:id,source:'nearby-stop',after_id:b.dataset.after}});
   if(added?.changed){log('add_to_route',{place_id:id,source:'nearby-stop'});nearbyAfterId=null;render();toast('Dodano miejsce bezpośrednio po wybranym przystanku.');}
   else toast(added?.error==='duplicate'?'To miejsce jest już na trasie.':added?.error==='limit'?'Trasa ma już 20 przystanków. Usuń jeden, aby dodać kolejny.':'Nie można dodać miejsca do trasy.');
 }
 if(action==='nearby-custom'){addNewPlaceAfterId=b.dataset.after||null;nearbyAfterId=null;}
 if(action==='save-route'){const r=findRoute(id);loadRouteIntoBuilder(r);location.hash='my-route';toast('Trasa jest w Mojej trasie. Zmieniaj ją dowolnie.');}
 if(action==='delete-route'&&confirm('Usunąć tę trasę?')){state.myRoutes=state.myRoutes.filter(r=>r.id!==id);persist();location.hash='routes';toast('Trasa usunięta.');}
 if(action==='delete-place'&&confirm('Usunąć to miejsce?')){applyBuilder(removeStop(builderDraft,id,{now:now()}),{eventType:'builder_remove',eventData:{place_id:id,reason:'place_deleted'}});state.userPlaces=state.userPlaces.filter(p=>p.id!==id);state.savedPlacesByCity[city().id]=savedIds().filter(x=>x!==id);providerOverlay.delete(id);delete all[id];state.myRoutes=state.myRoutes.filter(r=>!r.stops.includes(id));persist();d.close();render();toast('Miejsce usunięte.');}
 if(action==='locate'){keepDraft();if(!navigator.geolocation)return toast('Ta przeglądarka nie udostępnia lokalizacji.');navigator.geolocation.getCurrentPosition(pos=>{draft={...draft,lat:pos.coords.latitude,lng:pos.coords.longitude};render();},()=>toast('Nie udało się pobrać lokalizacji. Wklej link z Google Maps.'),{enableHighAccuracy:true,timeout:10000});}
 if(action==='toggle-visibility'){const p=all[id];if(p?.kind==='user'){if(['pending','submitting','approved','merged'].includes(p.submissionStatus))return toast('Zgłoszenie zostało wysłane. Zmianę publikacji musi obsłużyć moderacja.');p.visibility=isPublic(p)?'private':'public';p.submissionStatus=isPublic(p)?'not_submitted':null;persist();log('place_visibility',{place_id:id,visibility:p.visibility});openPlace(id);render();toast(isPublic(p)?'Zaznaczono propozycję. Kliknij „Wyślij do społeczności”.':'To miejsce pozostało prywatne.');}}
 if(action==='ticket')log('buy_ticket_click',{place_id:id,source:b.dataset.source||'getyourguide'});
 if(action==='table')log('table_click',{place_id:id,source:b.dataset.source});
 if(action==='book-tab'){bookTab=value;render();}
 if(action==='ev-scope'){evScope=value;render();}
 if(action==='ev-when'){evWhen=value;render();}
 if(action==='ev-kind'){evKind=value;render();}
 if(action==='events-retry'){for(const k in evCache)delete evCache[k];render();}
 if(action==='event-ticket')log('event_ticket_click',{event_id:id,source:b.dataset.source});
 if(action==='remove-avatar'){delete state.profile.photo;delete state.profile.avatarPending;persist();render();window.dispatchEvent(new Event('cityroute:avatar-removed'));}
 if(action==='listen'){if(speaking){speechSynthesis.cancel();speaking=false;render();}else{const p=all[id],qq=quests.find(x=>x.placeId===id),u=new SpeechSynthesisUtterance(`${p.name}. ${p.description}${p.outside?' Na trasie oglądasz je z zewnątrz.':''}${qq?' Zadanie: '+qq.description:''}`);u.lang='pl-PL';u.rate=.95;u.onend=u.onerror=()=>{speaking=false;render();};speechSynthesis.cancel();speechSynthesis.speak(u);speaking=true;render();log('audio_play',{place_id:id});}}
 if(action==='compare')log('hotel_compare_click',{place_id:id,source:b.dataset.source});
 if(action==='whole-route')log('whole_route_maps');
 if(action==='choose-generated'){
  const index=Number(value);
  if(!Number.isInteger(index)||index<0||index>=generatedOptions.length)return;
  generatedIndex=index;generated=generatedOptions[index];log('build_variant_select',{variant:index+1,count:generatedOptions.length,stops:generated.stops.length});
  render();document.querySelector(`[data-action="choose-generated"][data-value="${index}"]`)?.focus({preventScroll:true});
 }
 if(action==='refresh-generated'){
  if(!generationPrefs||!generatedOptions.length)return toast('Najpierw ułóż trasę.');
  const fresh=generateAlternatives([...places,...forCity(state.userPlaces,city().id)],generationPrefs,{history:generationHistory,count:3});
  if(!fresh.length)return toast('Nie znaleziono innych sensownych wariantów. Zmień ustawienia.');
  setGeneratedOptions(fresh);
  log('build_variant_refresh',{count:fresh.length,stops:generated.stops.length});
  render();document.querySelector('.generated-picker')?.scrollIntoView?.({block:'start'});
 }
 if(action==='save-generated'&&generated){const s=saveRoute(generated);persist();location.hash='route/'+s.id;toast('Zapisano w Twoich trasach');}
 if(action==='save-basket'){const name=builderDraft?.name||('Moja trasa · '+new Date().toLocaleDateString('pl-PL'));saveRoute({...toRoute(builderDraft,{id:'custom',name}),description:items(state.basket).map(p=>p.name).join(', ')});persist();render();toast('Zapisano. Znajdziesz ją w zakładce Trasy.');}
 if(action==='clear-builder'&&(!state.basket.length||state.basket.length<=2||confirm('Wyczyścić całą trasę?'))){const r=applyBuilder(clearDraft(builderDraft,{now:now()}),{eventType:'builder_clear'});if(r?.changed){render();toast('Trasa wyczyszczona.');}}
 if(action==='start'){const r=id==='basket'?toRoute(builderDraft,{id:'custom',name:builderDraft?.name||'Moja trasa'}):findRoute(id);if(isLive()){pending=r;$('#confirm').showModal();}else start(r);}
 if(action==='cancel-replace'){$('#confirm').close();pending=null;}
 if(action==='confirm-replace'){$('#confirm').close();if(pending){log('route_abandon',{session_id:state.session.id});start(pending);pending=null;}}
 if(action==='done'&&state.session&&!state.session.finished){state.session.awaitingRating=state.session.stops[state.session.index];persist();render();document.querySelector('.stop-rating')?.scrollIntoView?.({block:'center'});return;}
 if((action==='arrival-rating'||action==='arrival-skip-rating')&&state.session&&!state.session.finished){
   const session=state.session,stop=session.stops[session.index];
   if(session.awaitingRating!==stop)return;
   if(action==='arrival-rating'){const rating=Number(value);if(!Number.isInteger(rating)||rating<1||rating>5)return;state.placeReviews[stop]=rating;window.dispatchEvent(new CustomEvent('cityroute:place-reviewed',{detail:{placeId:stop,cityId:city().id,rating}}));log('place_review_local',{place_id:stop,rating,session_id:session.id,verified:false});}
   session.awaitingRating=null;state.session=advance(session,'done');
   log('stop_complete',{place_id:stop,session_id:session.id});
   if(state.session.finished)log('route_complete',{session_id:session.id,route_id:session.routeId,done:state.session.results.filter(r=>r.status==='done').length,skipped:state.session.results.filter(r=>r.status==='skip').length});
   persist();render();window.scrollTo(0,0);return;
 }
 if(action==='publish-finished'&&state.session?.finished){
  const completed=state.session;
  if(completed.stops.length<2)return toast('Do publikacji potrzebne są przynajmniej dwa przystanki.');
  document.dispatchEvent(new CustomEvent('cityroute:publish-completed',{detail:{cityId:city().id,name:completed.name||'Moja ukończona trasa',transport:completed.transport||'walking',stops:[...completed.stops],routeId:completed.routeId}}));return;
 }
 if(action==='done'||action==='skip'){if(speaking){speechSynthesis.cancel();speaking=false;}const s=state.session;if(!s||s.finished)return;const stop=s.stops[s.index];s.awaitingRating=null;state.session=advance(s,action);log(action==='done'?'stop_complete':'stop_skip',{place_id:stop,session_id:s.id});if(state.session.finished)log('route_complete',{session_id:s.id,route_id:s.routeId,done:state.session.results.filter(r=>r.status==='done').length,skipped:state.session.results.filter(r=>r.status==='skip').length});render();window.scrollTo(0,0);}
 if(action==='abandon'&&isLive()&&confirm('Zakończyć trasę? Postęp tej trasy nie zostanie zapisany jako ukończony.')){log('route_abandon',{session_id:state.session.id});state.session=null;persist();render();}
 if(action==='close-session'){state.session=null;persist();render();}
 if(action==='recommend'&&state.session?.finished&&!state.session.recommend){state.session.recommend=value;log('recommend_'+value,{session_id:state.session.id,route_id:state.session.routeId});render();}
 if(action==='source')log('source_click',{place_id:id,source:b.dataset.source});
 if(action==='stay'){state.stay=state.stay===value?'':value;persist();render();}
 if(action==='edit-profile'){editing=true;render();$('#profile-form input')?.focus();}
 if(action==='cancel-edit'){editing=false;render();}
 if(action==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='city-route-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(action==='reset'&&confirm('Usunąć profil, trasy i aktywność z tej przeglądarki?')){state=fresh();state.cityId=city().id;state.basketsByCity={[city().id]:[]};state.builderMetaByCity={};builderDraft=createDraft(city().id,{now:now()});state.friends=[];state.myRoutes=[];state.userPlaces=[];state.savedPlacesByCity={};providerOverlay.clear();state.connections={};state.joined=[];state.messages={};state.placeReviews={};state.stay='';state.profile={bio:'',socials:{instagram:'',tiktok:'',web:''}};persist();location.hash='routes';render();toast('Dane z tego urządzenia zostały usunięte.');}
});
document.addEventListener('input',e=>{
 if(e.target.dataset.photoCrop){const photos=draft?.photos||[],active=photos.find(p=>p.id===draft.editPhotoId)||photos[0];if(active){const key=e.target.dataset.photoCrop;active.crop=sanitizePhotoCrop({...active.crop,[key]:e.target.value});const frame=e.target.closest('.place-photo-crop')?.querySelector('.place-photo-frame');if(frame){const c=active.crop;frame.style.aspectRatio=c.ratio==='1:1'?'1':c.ratio==='16:9'?'16/9':'4/3';const image=frame.querySelector('img');image.style.objectPosition=c.x+'% '+c.y+'%';image.style.transform='scale('+c.zoom+')';image.style.transformOrigin=c.x+'% '+c.y+'%';}}return;}
 if(e.target.id==='search'){const pos=e.target.selectionStart;query=e.target.value;render();const s=$('#search');s.focus();s.setSelectionRange(pos,pos);}if(e.target.id==='builder-name'&&builderDraft){applyBuilder(setName(builderDraft,e.target.value,{now:now()}));}});
document.addEventListener('change',async e=>{
 if(e.target.id==='builder-transport'&&builderDraft){const r=applyBuilder(setTransport(builderDraft,e.target.value,{now:now()}));if(r?.changed)render();}
 if(e.target.name==='vis'&&e.target.closest('#place-form')){keepDraft();if(draft.vis!=='public')draft.imageRights=false;const rights=$('[data-photo-rights]');if(rights){rights.hidden=draft.vis!=='public'||!draft.photos?.length;if(draft.vis!=='public'){const cb=rights.querySelector('input');if(cb)cb.checked=false;}}return;}
 if(e.target.id==='sort'){sort=e.target.value;if(sort==='near'&&!here){if(!navigator.geolocation){sort='default';toast('Ta przeglądarka nie udostępnia lokalizacji.');}else navigator.geolocation.getCurrentPosition(pos=>{here={lat:pos.coords.latitude,lng:pos.coords.longitude};render();},()=>{sort='default';render();toast('Bez zgody na lokalizację nie posortujemy według odległości.');},{timeout:10000});}render();$('#sort')?.focus();}
 if(e.target.dataset.action==='avatar'&&e.target.files[0]){try{state.profile.photo=await shrink(e.target.files[0],256);persist();render();toast('Zdjęcie profilowe zapisane.');window.dispatchEvent(new Event('cityroute:avatar-changed'));}catch{toast('Nie udało się wczytać zdjęcia.');}}
 if(e.target.dataset.action==='photo'&&e.target.files.length){keepDraft();const selected=[...e.target.files],old=Array.isArray(draft.photos)?draft.photos:[],available=MAX_PLACE_PHOTOS-old.length;
  if(available<1){toast('Możesz dodać maksymalnie 5 zdjęć.');return;}
  const added=[];for(const file of selected.slice(0,available)){const problem=photoFileProblem(file);if(problem){toast(problem==='size'?'Zdjęcie jest zbyt duże (maks. 10 MB).':'Obsługujemy JPG, PNG i WebP.');continue;}
   try{const source=await shrink(file,1200);if(source.length>580000){toast('Zdjęcie jest za duże po kompresji.');continue;}added.push({id:uuid(),source,crop:photoCropDefaults()});}
   catch{toast('Nie udało się wczytać zdjęcia.');}}
  draft.photos=[...old,...added];draft.editPhotoId=added[0]?.id||draft.editPhotoId||draft.photos[0]?.id||null;draft.imageRights=false;
  if(selected.length>available)toast('Maksymalnie 5 zdjęć — pominięto nadmiar.');render();}
});
document.addEventListener('submit',async e=>{const f=e.target,data=new FormData(f);
 if(f.id==='profile-form'){e.preventDefault();state.tester.nickname=String(data.get('nickname')).trim()||'Explorer';state.profile.bio=String(data.get('bio')).trim().slice(0,160);const bad=[];for(const k of ['instagram','tiktok','web']){const v=String(data.get(k)).trim();state.profile.socials[k]=v&&socialUrl(k,v)?v:'';if(v&&!socialUrl(k,v))bad.push(k);}persist();editing=false;render();toast(bad.length?'Zapisano. Pominięto niepoprawny link.':'Profil zapisany.');}
 if(f.id==='place-review-form'){e.preventDefault();const score=Number(data.get('rating'));state.placeReviews[f.dataset.id]=score;persist();window.dispatchEvent(new CustomEvent('cityroute:place-reviewed',{detail:{placeId:f.dataset.id,cityId:city().id,rating:score}}));toast('Twoja ocena jest zapisana.');openPlace(f.dataset.id);}
 if(f.id==='place-form'){e.preventDefault();if(f.dataset.saving)return;keepDraft();
  if(draft.sourcePageUrl&&!parsePhotoSourceUrl(draft.sourcePageUrl))return toast('Link do źródła musi być poprawnym publicznym adresem HTTPS (strona, Instagram lub Facebook).');
  const submitted=draft;let loc=parseLocation(draft.where)||(Number.isFinite(draft.lat)?{lat:draft.lat,lng:draft.lng}:null);
  if(!loc&&/^https:\/\//i.test(draft.where||'')){f.dataset.saving='1';f.querySelector('button.primary').disabled=true;toast('Odczytuję link Google Maps…');try{const r=await fetch('/api/location?url='+encodeURIComponent(draft.where));const v=await r.json();if(r.ok&&v.location)loc=v.location;}catch{}finally{delete f.dataset.saving;f.querySelector('button.primary').disabled=false;}if(draft!==submitted||route()[0]!=='add-place')return;}
  if(!loc)return toast(draft.where?'Nie udało się odczytać miejsca. Wklej współrzędne, np. 52.2395, 21.0458, albo użyj przycisku lokalizacji. Twój formularz został zachowany.':'Ustaw lokalizację albo wklej link z Google Maps.');
  if(!isInsideCity(loc,city()))return toast(`To miejsce jest dalej niż ${city().radiusKm} km od ${city().name}.`);
  let localImages=[];
  if(draft.photos?.length){f.dataset.saving='1';f.querySelector('button.primary').disabled=true;
   try{localImages=await Promise.all(draft.photos.slice(0,MAX_PLACE_PHOTOS).map(p=>cropPlacePhoto(p.source,p.crop)));}
   catch{toast('Nie można przygotować kadru zdjęcia. Spróbuj ponownie.');return;}
   finally{delete f.dataset.saving;f.querySelector('button.primary').disabled=false;}}
  // P0 #1: a photo the user accepted from the automatic proposal; the user's own photos always win.
  const proposed=!localImages.length&&!draft.image?readAcceptedPhoto(f.dataset.pcPhoto):null;
  const c=draft.cat||'okolice',group=userGroup(c),p={id:'u-'+uuid().slice(0,8),cityId:city().id,categoryId:taxonomy?.legacyAliases?.[c]||c,kind:'user',visibility:draft.vis==='public'?'public':'private',name:String(draft.name).trim(),cats:[group],area:'Twoje miejsce',description:String(draft.note||'').trim()||'Twoje miejsce.',lat:+loc.lat.toFixed(6),lng:+loc.lng.toFixed(6),minutes:c==='jedzenie'?45:20,cost:0,tags:USER_TAGS[group]||['hidden'],tourist:'local',foodStyle:c==='jedzenie'?'quick':'none',partner:false,ratings:[],googlePlaceId:f.dataset.pcGooglePlaceId||null,image:localImages[0]||draft.image||proposed?.image||null,imageCredit:proposed?.imageCredit||null,images:localImages,imageRightsConfirmed:draft.vis==='public'&&localImages.length>0&&!!draft.imageRights,photoSourcePage:parsePhotoSourceUrl(draft.sourcePageUrl),photoSourceKind:draft.sourcePageUrl?photoSourceKind(draft.sourcePageUrl):null,sourceUrl:/^https?:\/\//i.test(draft.where||'')?String(draft.where).slice(0,500):null,submissionStatus:draft.vis==='public'?'not_submitted':null,verification:{editorial:false,community:false},createdAt:new Date().toISOString()};
  state.userPlaces.unshift(p);all[p.id]=p;state.savedPlacesByCity[city().id]=[...new Set([...savedIds(),p.id])];if(/^[1-5]$/.test(String(draft.rating||'')))state.placeReviews[p.id]=Number(draft.rating);try{localStorage.setItem(key,JSON.stringify(state));}catch{state.userPlaces.shift();state.savedPlacesByCity[city().id]=savedIds().filter(x=>x!==p.id);delete all[p.id];delete state.placeReviews[p.id];return toast('Za mało miejsca na urządzeniu. Spróbuj bez zdjęcia.');}
  log('place_add',{place_id:p.id,cat:c,photo:!!p.image,photo_source:localImages.length?'own':proposed?proposed.imageCredit.via:p.image?'other':'none',visibility:p.visibility});
  void enrichPlaceOnDemand(p);
  if(p.visibility==='public')window.dispatchEvent(new CustomEvent('cityroute:place-created',{detail:{placeId:p.id}}));
  const anchorPos=addNewPlaceAfterId?builderDraft?.stops.indexOf(addNewPlaceAfterId):-1;
  const added=anchorPos>=0?applyBuilder(addStop(builderDraft,p,{at:anchorPos+1,now:now()}),{eventType:'builder_add',eventData:{place_id:p.id,source:'nearby-custom',after_id:addNewPlaceAfterId}}):null;
  addNewPlaceAfterId=null;draft=null;cat=c;
  location.hash=added?.changed?'my-route':'places';
  if(!added?.changed){justSavedPlaceId=p.id;setTimeout(()=>openPlace(p.id),50);}
  toast(added?.changed?'Miejsce zapisane i wstawione do Mojej trasy.':added?.error==='limit'?'Miejsce zapisane, ale trasa ma już 20 przystanków.':'Miejsce zapisane.');}
 if(f.id==='build-form'){e.preventDefault();const prefs=Object.fromEntries(data);
  prefs.interests=data.getAll('interests');if(prefs.start==='here'){if(!navigator.geolocation){toast('Brak lokalizacji — układam trasę bez punktu startu.');}else{toast('Sprawdzam, gdzie jesteś…');navigator.geolocation.getCurrentPosition(pos=>{here={lat:pos.coords.latitude,lng:pos.coords.longitude};plan(prefs,here);},()=>{toast('Bez lokalizacji — trasa bez punktu startu.');plan(prefs,null);},{timeout:10000});return;}}
  plan(prefs,null);}
});
function setGeneratedOptions(options){
 generatedOptions=options.map(ps=>({id:'generated',cityId:city().id,name:routeTitle(city()),description:`Plan na ${minutes(Number(generationPrefs.time))}, ułożony według Twoich wyborów. Możesz go zapisać albo od razu ruszyć.`,stops:ps.map(p=>p.id),transport:generationPrefs.transport,cats:[]}));
 generatedIndex=0;generated=generatedOptions[0]||null;
 generationHistory=[...generationHistory,...generatedOptions.map(r=>r.stops)].slice(-30);
}
function plan(prefs,start){
 if(!prefs.interests.length)prefs.interests=['mix'];
 if(prefs.interests.length>1)prefs.interests=prefs.interests.filter(x=>x!=='mix');
 if(start&&distance(start,cityPoint(city()))>Math.min(25,city().radiusKm)){toast(`Jesteś daleko od ${city().name} — układam trasę bez punktu startu.`);start=null;}
 if(!validDate(prefs.visitDate)||prefs.visitDate<localDate(city().timezone||'Europe/Warsaw')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(prefs.startTime||'')){
  return toast('Wybierz poprawną datę i godzinę rozpoczęcia trasy.');
 }
 const chosenPrefs={...prefs,start:start||undefined};
 chosenPrefs.timeFeasible=stops=>feasibleFor(stops,{cityId:city().id,date:chosenPrefs.visitDate,
   startTime:chosenPrefs.startTime,mode:chosenPrefs.visitMode,transport:chosenPrefs.transport,
   origin:chosenPrefs.start,maxMinutes:Number(chosenPrefs.time)});
 const choices=generateAlternatives([...places,...forCity(state.userPlaces,city().id)],chosenPrefs,{count:3});
 log('build_generate',{preferences:chosenPrefs,stops:choices[0]?.length||0,variants:choices.length});
 if(!choices.length)return toast('Nie ma wykonalnej trasy w tych godzinach. Zmień start, datę lub długość zwiedzania.');
 generationPrefs=chosenPrefs;generationHistory=[];setGeneratedOptions(choices);
 location.hash='route/generated';
}
// SAVED-PLACES-SYNC: saved-places-sync.js merges saves with the account; apply its result to the in-memory state.
window.addEventListener('cityroute:saved-synced',e=>{const byCity=e.detail?.byCity;if(!byCity||typeof byCity!=='object')return;let changed=false;for(const [c,ids] of Object.entries(byCity)){if(!Array.isArray(ids))continue;const cur=state.savedPlacesByCity[c]||[];if(cur.length===ids.length&&cur.every((x,i)=>x===ids[i]))continue;state.savedPlacesByCity[c]=ids.map(String);changed=true;}if(changed){persist();render();}});
// PROFILE-AVATAR: profile-avatar.js syncs the photo with the account; apply its result to the in-memory state.
window.addEventListener('cityroute:avatar-synced',e=>{const {photo,pending}=e.detail||{};const before=state.profile.photo+'|'+!!state.profile.avatarPending;if(photo)state.profile.photo=photo;if(pending)state.profile.avatarPending=true;else delete state.profile.avatarPending;if(before===state.profile.photo+'|'+!!state.profile.avatarPending)return;persist();render();});
window.addEventListener('cityroute:submission-updated',e=>{const {placeId,patch}=e.detail||{};const place=state.userPlaces.find(x=>x.id===placeId);if(!place||!patch)return;Object.assign(place,patch);persist();const dialog=$('#place-dialog');if(dialog?.open&&dialog.querySelector('#sheet-title')?.textContent===place.name)openPlace(placeId);});
document.addEventListener('error',e=>{const t=e.target;if(t.tagName==='IMG'&&!t.dataset.failed){t.dataset.failed='1';t.outerHTML=`<div class="ph ${t.className}">${ic('camera')}</div>`;}},true);
document.addEventListener('change',e=>{if(e.target?.id==='city-select'){switchCity(e.target.value).catch(error=>{console.error(error);toast('Nie udało się przełączyć miasta.');render();});}});
window.addEventListener('hashchange',()=>{const t=route()[0];if(speaking){speechSynthesis.cancel();speaking=false;}if(t!=='add-place'){draft=null;addNewPlaceAfterId=null;}if(t!=='places')cuisine='all';if(!keepQuery)query='';keepQuery=false;editing=false;if($('#place-dialog').open)$('#place-dialog').close();render();window.scrollTo(0,0);$('#main').focus({preventScroll:true});});
async function fetchJson(path){const r=await fetch(path);if(!r.ok)throw Error(path);return r.json();}
async function loadCityFallback(targetCity){if(targetCity.id===DEFAULT_CITY_ID){const [p,r]=await Promise.all([fetchJson('./data/places.json'),fetchJson('./data/routes.json')]);return {places:forCity(withCityId(p,DEFAULT_CITY_ID),targetCity.id),routes:forCity(withCityId(r,DEFAULT_CITY_ID),targetCity.id)};}try{const [p,r]=await Promise.all([fetchJson(`./data/cities/${targetCity.id}/places.json`),fetchJson(`./data/cities/${targetCity.id}/routes.json`)]);return {places:withCityId(p,targetCity.id),routes:withCityId(r,targetCity.id)};}catch{return {places:[],routes:[]};}}
function updateCityMeta(targetCity){const meta=document.querySelector('meta[name=description]');if(meta)meta.content=`Gotowe i własne trasy po ${targetCity.name}. Odkrywaj miejsca i układaj plan miasta w City Route.`;}
function connection(){$('#connection').textContent=!storageOK?'Zapis lokalny niedostępny. Wyeksportuj dane przed zamknięciem.':navigator.onLine?'':'Offline · zapisane trasy działają. Mapy i strony źródeł wymagają internetu.';}
window.addEventListener('online',connection);window.addEventListener('offline',connection);
try{
 let staticPlaces,staticRoutes;
 [cities,taxonomy,staticPlaces,quests,staticRoutes]=await Promise.all(['cities','taxonomy','places','sidequests','routes'].map(n=>fetchJson(`./data/${n}.json`)));
 // A shared editorial/community route may belong to a different city than the visitor's saved preference.
 const requestedShareCity=new URLSearchParams(location.search).get('shareCity');
 if(/^#(?:route|community-route)\/[^/]+$/.test(location.hash)&&requestedShareCity&&(!state.session||state.session.finished)){
  if(cities.some(c=>c.id===requestedShareCity&&['launch','next'].includes(c.status))){
   state.cityId=requestedShareCity;state.basket=[...(state.basketsByCity[requestedShareCity]||[])];
  }
  history.replaceState(null,'',location.pathname+location.hash);
 }
 activeCity=cityById(cities,state.cityId);if(!activeCity)throw Error('city');state.cityId=activeCity.id;
 const jsonCatalogue=activeCity.id===DEFAULT_CITY_ID?{places:forCity(withCityId(staticPlaces,DEFAULT_CITY_ID),activeCity.id),routes:forCity(withCityId(staticRoutes,DEFAULT_CITY_ID),activeCity.id)}:await loadCityFallback(activeCity);
 const catalogueClient=createRestRpcClient({url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY});
 const catalogueData=await loadCatalogueWithFallback({client:catalogueClient,city:activeCity,fallback:jsonCatalogue});
 places=catalogueData.places;routes=catalogueData.routes;quests=forCity(withCityId(quests,DEFAULT_CITY_ID),activeCity.id);
 document.documentElement.dataset.catalogueSource=catalogueData.source;
 state.userPlaces=withCityId(state.userPlaces,DEFAULT_CITY_ID);state.myRoutes=withCityId(state.myRoutes,DEFAULT_CITY_ID);
 all=Object.fromEntries([...places,...quests,...forCity(state.userPlaces,activeCity.id)].map(p=>[p.id,p]));if(!state.basketsByCity[activeCity.id]&&state.basket?.length)state.basketsByCity[activeCity.id]=[...state.basket];const initialBuilderReport=hydrateBuilderDraft(activeCity.id);state.myRoutes=state.myRoutes.filter(r=>r.cityId!==activeCity.id||r.stops.every(id=>all[id]));
 if(state.session&&(!Array.isArray(state.session.stops)||state.session.stops.some(id=>!all[id])||!Array.isArray(state.session.results)||state.session.index<0||state.session.index>state.session.stops.length))state.session=null;
 document.title=`City Route · ${activeCity.name}`;updateCityMeta(activeCity);persist();render();connection();if(initialBuilderReport.dropped.length)toast(`${initialBuilderReport.dropped.length} miejsca nie są już dostępne w tej trasie.`);if('serviceWorker'in navigator&&!window.__cityRouteSwBootstrapped){const had=!!navigator.serviceWorker.controller;let reloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!reloaded){reloaded=true;location.reload();}});navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});}
}catch(error){$('#main').innerHTML='<div class="empty"><h1>Nie udało się wczytać miasta.</h1><p>Przy pierwszej wizycie połącz się z internetem i odśwież stronę.</p><button onclick="location.reload()">Spróbuj ponownie</button></div>';console.error(error);}


// Pointer events support touch and mouse; arrow buttons remain available for keyboard users.
let dragging=null;
document.addEventListener('pointerdown',e=>{const h=e.target.closest('.drag-handle');if(!h||isLive())return;e.preventDefault();const row=h.closest('[data-stop]');dragging={id:row.dataset.stop,target:row.dataset.stop,pointer:e.pointerId};h.setPointerCapture(e.pointerId);row.classList.add('dragging');});
document.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.pointer)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-stop]');document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));if(row){dragging.target=row.dataset.stop;row.classList.add('drop-target');}if(e.clientY<100)window.scrollBy(0,-12);if(e.clientY>innerHeight-110)window.scrollBy(0,12);});
document.addEventListener('pointerup',e=>{if(!dragging||e.pointerId!==dragging.pointer)return;if(isLive()){dragging=null;render();return toast('Najpierw zakończ aktywną trasę.');}const drag=dragging;dragging=null;const r=applyBuilder(moveStopToTargetIndex(builderDraft,drag.id,drag.target,{now:now()}),{eventType:'builder_move',eventData:{place_id:drag.id,method:'drag'}});render();if(r?.changed)toast('Kolejność zapisana.');});
document.addEventListener('pointercancel',()=>{if(dragging){dragging=null;render();}});
document.addEventListener('keydown',e=>{const h=e.target.closest?.('.drag-handle');if(!h||isLive()||!builderDraft)return;const row=h.closest('[data-stop]'),id=row?.dataset.stop;if(!id)return;let r=null;if(e.key==='ArrowUp')r=moveStopBy(builderDraft,id,-1,{now:now()});else if(e.key==='ArrowDown')r=moveStopBy(builderDraft,id,1,{now:now()});else if(e.key==='Home')r=moveStop(builderDraft,id,0,{now:now()});else if(e.key==='End')r=moveStop(builderDraft,id,builderDraft.stops.length-1,{now:now()});else return;e.preventDefault();const applied=applyBuilder(r,{eventType:'builder_move',eventData:{place_id:id,method:'keyboard'}});if(applied?.changed){render();requestAnimationFrame(()=>document.querySelector(`[data-stop="${CSS.escape(id)}"] .drag-handle`)?.focus());}});
