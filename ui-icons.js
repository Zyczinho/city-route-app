// VISUAL-SYSTEM-057: the only shared icon renderer for City Route.
// Every icon is a local, audited Lucide SVG. Names are a fixed allow-list:
// never accept untrusted text as an asset path.
export const ICON_NAMES=Object.freeze([
 'arrow-down','arrow-left','arrow-up-right','arrow-up','bed-double','bookmark',
 'building-2','camera','check','chevron-down','chevron-right','clock','compass','grip-vertical','flag','heart',
 'house','image-plus','info','landmark','layers','library','link','locate-fixed',
 'map-pin','map','minus','navigation','pencil','play','plus','radio','route',
 'search','shuffle','signpost','sliders-horizontal','sparkles','star',
 'ticket-percent','trash-2','trees','trophy','user-round','users','utensils',
 'wand-sparkles','waves','x'
]);
const names=new Set(ICON_NAMES);
export function iconMarkup(name,extraClass=''){
 if(!names.has(name))throw new Error('Unknown City Route icon: '+String(name));
 const suffix=String(extraClass).trim();
 if(suffix&&!/^[a-z0-9_-]+(?:\s+[a-z0-9_-]+)*$/.test(suffix))throw new Error('Invalid icon class');
 return '<span class="i'+(suffix?' '+suffix:'')+'" style="--i:url(./assets/icons/ui/'+name+'.svg)" aria-hidden="true"></span>';
}
export function iconNode(name){
 const node=document.createElement('span');
 // Generate through the same whitelist that powers HTML templates.
 node.innerHTML=iconMarkup(name);
 return node.firstElementChild;
}
