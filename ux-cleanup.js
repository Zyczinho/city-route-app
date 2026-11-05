import {iconMarkup} from './ui-icons.js';
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
  const parts=[transport,budget,start==='Stąd, gdzie jestem'?'Start tutaj':start].filter(Boolean);
  advancedTarget.textContent=shortList(parts,'Domyślne');
 }
}

function disclosure(title,summaryAttr,className){
 const details=document.createElement('details');
 details.className=className;
 const summary=document.createElement('summary');
 summary.innerHTML=`<span><strong>${title}</strong><small ${summaryAttr}></small></span><span class="ux-chevron" aria-hidden="true">${iconMarkup("chevron-right")}</span>`;
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
 const transport=field('transport'),food=field('food'),start=field('start'),budget=field('budget'),tourist=field('tourist'),offers=field('offers');
 const note=form.querySelector('.planner-advanced-body .fine, details.more .fine');
 const submit=form.querySelector('button.primary.big');
 if(!submit)return;

 form.dataset.uxClean='1';
 form.classList.add('ux-planner');

 const head=main()?.querySelector('.page-head');
 if(head){
  head.classList.add('ux-plan-head');
  const kicker=head.querySelector('.kicker');if(kicker)kicker.hidden=true;
  const h=head.querySelector('h1');if(h)h.textContent='Odkrywaj miasto po swojemu.';
  const lead=head.querySelector('.lead');if(lead)lead.textContent='Znajduj wyjątkowe miejsca, układaj własne trasy i odkrywaj polecenia innych. Wybierz czas i zobacz pierwszą propozycję.';
 }

 const ready=head?.querySelector('a.inline')||null;
 if(ready){ready.textContent='Gotowe trasy';ready.className='ux-text-link';}
 let manual=[...document.querySelectorAll('a[href="#my-route"]')].find(a=>a.closest('#main')&&!a.closest('#navigation'))||null;
 if(manual){manual.textContent='Ułóż ręcznie';manual.className='ux-text-link';}

 const primary=document.createElement('section');primary.className='ux-planner-primary';
 time.classList.add('ux-time');primary.append(time);
 const whenDetails=disclosure('Kiedy chcesz zwiedzać?','data-ux-when-summary','ux-disclosure ux-when');
 if(when)whenDetails.body.append(when);

 const climate=disclosure('Klimat trasy','data-ux-interest-summary','ux-disclosure ux-climate');
 interests.classList.add('ux-interest-field');climate.body.append(interests);

 const advanced=disclosure('Więcej ustawień','data-ux-advanced-summary','ux-disclosure ux-advanced');
 for(const fs of [visitMode,transport,food,start,budget,tourist,offers])if(fs)advanced.body.append(fs);
 if(note){note.textContent='Te ustawienia są opcjonalne.';advanced.body.append(note);}

 submit.textContent='Ułóż mi trasę';submit.classList.add('ux-submit');

 const alternatives=document.createElement('nav');alternatives.className='ux-plan-alternatives';
 alternatives.setAttribute('aria-label','Inne sposoby odkrywania miasta');
 if(ready){ready.textContent='Gotowe trasy';alternatives.append(ready);}
 if(manual){manual.href='#places';manual.textContent='Odkrywaj miejsca';manual.className='ux-text-link';alternatives.append(manual);}
 const social=document.createElement('a');social.href='#routes/community';social.className='ux-text-link';social.textContent='Trasy innych';
 alternatives.append(social);

 form.replaceChildren(primary,submit,alternatives,whenDetails.details,climate.details,advanced.details);
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

function enhance(){cleanPlanner();communityFocus();}
document.addEventListener('change',e=>{const form=e.target.closest?.('#build-form.ux-planner');if(form)updatePlannerSummaries(form);});
window.addEventListener('hashchange',()=>setTimeout(enhance,0));
new MutationObserver(enhance).observe(main()||document.documentElement,{subtree:true,childList:true});
enhance();
