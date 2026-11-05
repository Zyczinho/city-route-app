// PHOTO-COVERAGE-039: never show a broken img icon when a real venue photo fails.
// No scraping, no stock-photo substitution and no extra API calls.
import {iconNode} from './ui-icons.js';
const selectors='.place .thumb img, .sheet-media img, .social-media img, .social-detail-cover img, .social-stops img, .route-card .media img, .cover img';
export function replaceBrokenPhoto(img){
 if(!img?.matches?.(selectors)||!img.isConnected)return false;
 const fallback=document.createElement('div');
 fallback.className='ph photo-unavailable';
 fallback.setAttribute('role','img');
 fallback.setAttribute('aria-label','Zdjęcie niedostępne');
 const mark=document.createElement('span');
 mark.className='photo-unavailable-mark';
 mark.append(iconNode('camera'));
 mark.setAttribute('aria-hidden','true');
 const note=document.createElement('small');
 note.textContent='Zdjęcie niedostępne';
 fallback.append(mark,note);
 img.replaceWith(fallback);
 return true;
}
document.addEventListener('error',event=>{
 if(event.target instanceof HTMLImageElement)replaceBrokenPhoto(event.target);
},true);
