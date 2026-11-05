// PLACE-PUBLIC-GALLERY-059: approved extras are visible only via RLS-filtered rows.
// The existing place cover stays the first image. Missing gallery table => legacy cover only.
import {supabase} from './supabase-client.js';
import {SUPABASE_URL} from './supabase-config.js';
import {galleryPhotoPublicUrl} from './place-contributions-client.js';

const dialog=()=>document.querySelector('#place-dialog');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memo=new Map();
let scheduled=false,requestId=0;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function approvedExtras(submissionId){
 if(memo.has(submissionId))return memo.get(submissionId);
 const {data,error}=await supabase.from('place_submission_gallery')
  .select('position,image_path,moderation_status')
  .eq('submission_id',submissionId).eq('moderation_status','approved')
  .order('position',{ascending:true}).limit(4);
 if(error)return [];
 const items=(data||[]).filter(p=>Number.isInteger(p.position)&&p.position>=2&&p.position<=5)
  .map(p=>({position:p.position,src:galleryPhotoPublicUrl(SUPABASE_URL,p.image_path)}))
  .filter(p=>p.src);
 memo.set(submissionId,items);
 return items;
}
async function draw(){
 scheduled=false;
 const d=dialog(),submissionId=d?.dataset.gallerySubmissionId;
 if(!d?.open||!UUID.test(submissionId||'')||d.querySelector('[data-public-gallery]'))return;
 const media=d.querySelector('.sheet-media'),cover=media?.querySelector('img.sheet-photo');
 if(!media||!cover||!cover.src)return;
 const token=++requestId;
 const extras=await approvedExtras(submissionId);
 if(token!==requestId||!d.open||d.dataset.gallerySubmissionId!==submissionId||
    d.querySelector('[data-public-gallery]')||!cover.isConnected||!extras.length)return;
 const slides=[{position:1,src:cover.currentSrc||cover.src},...extras];
 const strip=document.createElement('div');strip.className='public-place-gallery';strip.dataset.publicGallery=submissionId;
 strip.setAttribute('role','group');strip.setAttribute('aria-label','Zatwierdzone zdjęcia miejsca');
 strip.innerHTML='<div class="public-place-gallery-head"><span>Galeria · '+slides.length+' zdjęć</span><small>Zdjęcia użytkowników City Route</small></div>'+
  '<div class="public-place-gallery-thumbs">'+slides.map((image,index)=>
   '<button type="button" data-public-photo-index="'+index+'" aria-pressed="'+(index===0)+
   '" aria-label="Pokaż zdjęcie '+(index+1)+' z '+slides.length+'">'+
   '<img src="'+esc(image.src)+'" alt="" loading="lazy" decoding="async"></button>').join('')+'</div>';
 media.insertAdjacentElement('afterend',strip);
 strip.addEventListener('click',e=>{
  const button=e.target.closest('[data-public-photo-index]');if(!button)return;
  const index=Number(button.dataset.publicPhotoIndex),selected=slides[index];
  if(!selected)return;
  const coverNow=d.querySelector('.sheet-media img.sheet-photo');if(!coverNow)return;
  coverNow.src=selected.src;
  strip.querySelectorAll('button[data-public-photo-index]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 });
}
function schedule(){
 if(scheduled)return;scheduled=true;setTimeout(()=>void draw(),100);
}
const d=dialog();
if(d){new MutationObserver(schedule).observe(d,{attributes:true,attributeFilter:['data-gallery-submission-id','open'],childList:true,subtree:true});d.addEventListener('close',()=>{requestId++;});}
window.addEventListener('hashchange',schedule);
schedule();
