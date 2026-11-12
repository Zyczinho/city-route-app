// GPX for planning only: route waypoints are not a recorded GPS track or completed Strava activity.
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function routeGpx({name='Trasa City Route',places=[]}={}){
 const points=Array.isArray(places)?places:[];
 if(points.length<2)throw Error('Do eksportu GPX potrzebne są minimum dwa przystanki ze współrzędnymi.');
 if(points.some(p=>!p||p.lat===null||p.lat===undefined||p.lng===null||p.lng===undefined
  ||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng))
  ||Number(p.lat)<-90||Number(p.lat)>90||Number(p.lng)<-180||Number(p.lng)>180))
  throw Error('Niektóre przystanki nie mają poprawnych współrzędnych. Niczego nie pominięto — popraw trasę i ponów eksport.');
 const rte=points.map(p=>'<rtept lat="'+Number(p.lat).toFixed(6)+'" lon="'+Number(p.lng).toFixed(6)+'"><name>'+xml(p.name||'Przystanek')+'</name></rtept>').join('\n');
 return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="City Route" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>'+xml(name)+'</name><desc>Punkty orientacyjne do planowania. Brak rzeczywistego sladu GPS i geometrii ulic.</desc></metadata><rte><name>'+xml(name)+'</name>\n'+rte+'\n</rte></gpx>';
}
export function routeGpxFilename(name){
 const slug=String(name||'trasa').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ł/g,'l')
  .replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'trasa';
 return 'cityroute-'+slug+'.gpx';
}
export function downloadRouteGpx(route){
 const gpx=routeGpx(route);
 const url=URL.createObjectURL(new Blob([gpx],{type:'application/gpx+xml;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=routeGpxFilename(route.name);document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 return route.places.length;
}
