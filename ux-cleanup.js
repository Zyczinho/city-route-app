const UX_CHEVRON='<span class="i" style="--i:url(./assets/icons/ui/chevron-right.svg)" aria-hidden="true"></span>';
const main=()=>document.querySelector('#main');

const checkedLabel=(form,name)=>form.querySelector(`input[name="${name}"]:checked`)?.nextElementSibling?.textContent?.trim()||'';
const checkedLabels=(form,name)=>[...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input=>input.nextElementSibling?.textContent?.trim()).filter(Boolean);

function shortList(values,fallback){
 if(!values.length)return fallback;
 if(values.length<=2)return values.join(' · ');
 return `${values.slice(0,2).join(' · ')} +${values.length-2}`;
}

function updatePlannerSummaries(form){
 const interestTarget=form.querySelector('[data-ux-interest-summary]');
 const advancedTarget=form.querySelector('[data-ux-advanced-summary]');
 const interests=checkedLabels(form,'interests');
 const whenTarget=form.querySelector('[data-ux-when-summary]');
 if(whenTarget){
  const visitDate=form.querySelector('input[name="visitDate"]')?.value||'';
  const startTime=form.querySelector('input[name="startTime"]')?.value||'10:00';
  const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(visitDate)
   ?new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'short'}).format(new Date(visitDate+'T12:00:00'))
   :'Wybierz dzień';
  whenTarget.textContent=dateLabel+' · '+startTime;
 }
 if(interestTarget)interestTarget.textContent=shortList(interests,'Wszystko po trochu');
 if(advancedTarget){
  const transport=checkedLabel(form,'transport');
  const budget=checkedLabel(form,'budget');
  const start=checkedLabel(form,'start');
  const avoid=checkedLabels(form,'avoid');
  const parts=[transport,budget,start==='Stąd, gdzie jestem'?'Start tutaj':start].filter(Boolean);
  if(avoid.length)parts.push('Bez: '+shortList(avoid,''));
  advancedTarget.textContent=shortList(parts,'Domyślne');
 }
}

function disclosure(title,summaryAttr,className){
 const details=document.createElement('details');
 details.className=className;
 const summary=document.createElement('summary');
 summary.innerHTML=`<span><strong>${title}</strong><small ${summaryAttr}></small></span><span class="ux-chevron" aria-hidden="true">${UX_CHEVRON}</span>`;
 const body=document.createElement('div');body.className='ux-disclosure-body';
 details.append(summary,body);
 return {details,body};
}

function cleanPlanner(){
 const form=document.querySelector('#build-form.planner');
 if(!form||form.dataset.uxClean==='1')return;
 const field=name=>form.querySelector(`input[name="${name}"]`)?.closest('fieldset');
 const time=field('time'),interests=field('interests'),when=field('visitDate'),visitMode=field('visitMode');
 if(!time||!interests)return;
 const transport=field('transport'),food=field('food'),start=field('start'),budget=field('budget'),tourist=field('tourist'),offers=field('offers'),avoid=field('avoid');
 const note=form.querySelector('.planner-advanced-body .fine, details.more .fine');
 const submit=form.querySelector('button.primary.big');
 if(!submit)return;

 form.dataset.uxClean='1';
 form.classList.add('ux-planner');

 const head=main()?.querySelector('.page-head');
 if(head){
  head.classList.add('ux-plan-head');
  const kicker=head.querySelector('.kicker');if(kicker)kicker.hidden=true;
  const h=head.querySelector('h1');if(h)h.textContent='Twój plan na miasto.';
  const lead=head.querySelector('.lead');if(lead)lead.textContent='Wybierz, co lubisz i ile masz czasu. City Route przygotuje propozycje trasy.';
 }

 const ready=head?.querySelector('a.inline')||null;
 if(ready){ready.textContent='Gotowe trasy';ready.className='ux-text-link';}
 let manual=[...document.querySelectorAll('a[href="#my-route"]')].find(a=>a.closest('#main')&&!a.closest('#navigation'))||null;
 if(manual){
  const choice=document.createElement('aside');
  choice.className='ux-plan-manual-entry';
  choice.setAttribute('aria-label','Samodzielne układanie trasy');
  const description=document.createElement('span');
  description.className='ux-plan-manual-copy';
  const title=document.createElement('strong');title.textContent='Wolisz wybrać przystanki samodzielnie?';
  const hint=document.createElement('small');hint.textContent='Dodawaj miejsca i układaj je we własnej kolejności.';
  description.append(title,hint);
  manual.href='#my-route';
  manual.textContent='Ułóż sam';
  manual.className='ux-plan-manual-link';
  manual.setAttribute('aria-label','Ułóż trasę samodzielnie w Mojej trasie');
  manual.insertAdjacentHTML('beforeend',UX_CHEVRON);
  choice.append(description,manual);
  form.before(choice);
 }

 const primary=document.createElement('section');primary.className='ux-planner-primary';
 time.classList.add('ux-time');primary.append(time);
 const whenDetails=disclosure('Kiedy chcesz zwiedzać?','data-ux-when-summary','ux-disclosure ux-when');
 if(when)whenDetails.body.append(when);

 const climate=disclosure('Co Cię interesuje?','data-ux-interest-summary','ux-disclosure ux-climate');climate.details.open=true;
 interests.classList.add('ux-interest-field');climate.body.append(interests);

 const advanced=disclosure('Więcej ustawień','data-ux-advanced-summary','ux-disclosure ux-advanced');
 for(const fs of [visitMode,transport,food,start,budget,tourist,avoid,offers])if(fs)advanced.body.append(fs);
 if(note){note.textContent='Te ustawienia są opcjonalne.';advanced.body.append(note);}

 submit.textContent='Ułóż mi trasę';submit.classList.add('ux-submit');

 const alternatives=document.createElement('nav');alternatives.className='ux-plan-alternatives';
 alternatives.setAttribute('aria-label','Inne sposoby odkrywania miasta');
 if(ready){ready.textContent='Gotowe trasy';alternatives.append(ready);}
 const placesLink=document.createElement('a');
 placesLink.href='#places';placesLink.textContent='Odkrywaj miejsca';placesLink.className='ux-text-link';
 alternatives.append(placesLink);
 const social=document.createElement('a');social.href='#routes/community';social.className='ux-text-link';social.textContent='Społeczność';
 alternatives.append(social);

 form.replaceChildren(climate.details,primary,submit,alternatives,whenDetails.details,advanced.details);
 updatePlannerSummaries(form);
}

function communityFocus(){
 const root=main();if(!root)return;
 const hash=location.hash;
 const communityTab=hash==='#routes/community';
 const feed=root.querySelector('[data-social-feed]');
 if(communityTab&&feed)root.dataset.communityFocus='1';else delete root.dataset.communityFocus;
 if(hash.startsWith('#community-route/')){
  const back=root.querySelector('.social-detail .back');if(back){
    // A MutationObserver watches #main's childList. Reassigning an unchanged
    // textContent still emits a childList mutation and can starve the UI forever.
    if(back.getAttribute('href')!=='#routes/community')back.setAttribute('href','#routes/community');
    if(back.textContent!=='Społeczność')back.textContent='Społeczność';
   }
 }
}

function clarifyManualRouteEntry(){
 if(location.hash!=='#my-route')return;
 const empty=main()?.querySelector('.empty-state');
 if(!empty||empty.dataset.uxManualReady==='1')return;
 empty.dataset.uxManualReady='1';
 const title=empty.querySelector('h1');
 if(title)title.textContent='Ułóż trasę samodzielnie.';
 const lead=empty.querySelector('p');
 if(lead)lead.textContent='Wybierz miejsca w katalogu, dodaj je do Mojej trasy, ustaw kolejność i zapisz gotowy plan.';
 const links=empty.querySelector('.stack');
 if(!links)return;
 const add=links.querySelector('a[href="#places"]');
 const ready=links.querySelector('a[href="#routes"]');
 const automatic=links.querySelector('a[href="#plan"]');
 const relabel=(element,label)=>{
  if(!element)return;
  const icon=element.querySelector('.i');
  element.replaceChildren(...(icon?[icon]:[]),document.createTextNode(label));
 };
 if(add){add.classList.add('primary');relabel(add,'Wybierz pierwsze miejsce');links.prepend(add);}
 if(ready){ready.classList.remove('primary');relabel(ready,'Zobacz gotowe trasy');}
 if(automatic)relabel(automatic,'Wolę plan automatyczny');
}

function enhance(){cleanPlanner();clarifyManualRouteEntry();communityFocus();}
document.addEventListener('change',e=>{const form=e.target.closest?.('#build-form.ux-planner');if(form)updatePlannerSummaries(form);});
window.addEventListener('hashchange',()=>setTimeout(enhance,0));
new MutationObserver(enhance).observe(main()||document.documentElement,{subtree:true,childList:true});
enhance();
