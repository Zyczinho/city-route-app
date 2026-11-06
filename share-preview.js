// SHARE-LINKS-116: safe crawler metadata for real published editorial and community routes.
// No secret, paid API or persistent media copy: use public Supabase RPCs and licensed cover references.
export function parseRouteSharePath(pathname){
 const p=String(pathname||"");
 const community=p.match(/^\/r\/community\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i);
 if(community)return {kind:"community",id:community[1].toLowerCase()};
 const editorial=p.match(/^\/r\/editorial\/([a-z0-9][a-z0-9_-]{0,119})\/([a-z0-9][a-z0-9_-]{0,119})\/?$/i);
 if(editorial)return {kind:"editorial",city:editorial[1],id:editorial[2]};
 return null;
}

export function escapeShareHtml(value){
 return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

export function safeShareImage(raw,origin){
 if(typeof raw!=="string"||!raw||raw.length>1000)return null;
 const trimmed=raw.trim();
 if(/^[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(trimmed))return origin+"/assets/images/"+encodeURIComponent(trimmed);
 if(/^\/?assets\/images\/[a-z0-9._/-]+\.(?:jpe?g|png|webp)$/i.test(trimmed)&&!trimmed.includes(".."))return origin+"/"+trimmed.replace(/^\//,"");
 if(/^\.\/assets\/images\/[a-z0-9._/-]+\.(?:jpe?g|png|webp)$/i.test(trimmed)&&!trimmed.includes(".."))return origin+"/"+trimmed.slice(2);
 try{
  const u=new URL(trimmed);
  if(u.protocol!=="https:")return null;
  const host=u.hostname.toLowerCase();
  if(host==="upload.wikimedia.org"||host==="images.pexels.com"||host==="images.unsplash.com")return u.href;
  if(host.endsWith(".supabase.co")&&u.pathname.startsWith("/storage/v1/object/public/"))return u.href;
 }catch{/* not an eligible https image */}
 return null;
}

export async function loadSharedRoute(ref,rpc,origin){
 let row=null,city=null,description="",author="",hero=null,stops=[],unlisted=false;
 if(ref.kind==="community"){
  const {data,error}=await rpc.rpc("community_route",{p_route_id:ref.id});
  if(error)throw error;
  row=Array.isArray(data)?data.find(v=>v&&String(v.id).toLowerCase()===ref.id):null;
  if(!row||row.status!=="published"||!["public","unlisted"].includes(row.visibility))return null;
  city=String(row.city_slug||"");author=String(row.author_nickname||"Odkrywca");unlisted=row.visibility==="unlisted";stops=Array.isArray(row.stops)?row.stops:[];
 }else{
  const {data,error}=await rpc.rpc("catalogue_routes",{city_slug:ref.city});
  if(error)throw error;
  row=Array.isArray(data)?data.find(v=>v&&String(v.id)===ref.id):null;
  if(!row)return null;
  city=ref.city;stops=Array.isArray(row.stops)?row.stops:[];
  hero=safeShareImage(row.metadata?.legacy?.image||row.metadata?.image||"",origin);
 }
 if(!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(city))return null;
 if(!hero&&stops.length){
  try{
   const {data,error}=await rpc.rpc("catalogue_places",{city_slug:city});
   if(!error&&Array.isArray(data)){
    const byId=new Map(data.flatMap(v=>[v.legacy_id,v.slug,v.id].filter(Boolean).map(key=>[String(key),v])));
    for(const stop of stops){
     const place=byId.get(String(stop));
     const image=safeShareImage(place?.image_url||"",origin);
     if(image){hero=image;break;}
    }
   }
  }catch{/* a missing photo never prevents a route from opening */}
 }
 description=String(row.description||"").trim();
 if(!description)description=`${stops.length} przystanków w City Route. Otwórz trasę i poznaj jej miejsca.`;
 const name=String(row.name||"Trasa City Route").slice(0,160);
 return {kind:ref.kind,id:ref.id,city,name,description:description.slice(0,250),author,stops:stops.length,unlisted,image:hero||origin+"/assets/logo.png"};
}

export function sharePreviewHtml(meta,canonical){
 const target="/?shareCity="+encodeURIComponent(meta.city)+"#"+(meta.kind==="community"?"community-route":"route")+"/"+encodeURIComponent(meta.id);
 const title=meta.name+" · City Route";
 const authorLine=meta.kind==="community"?" · Autor: "+meta.author:"";
 const desc=meta.description+authorLine;
 const robots=meta.unlisted?"noindex,nofollow":"index,follow";
 const e=escapeShareHtml;
 return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><meta name="description" content="${e(desc)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${e(canonical)}"><meta property="og:type" content="article"><meta property="og:site_name" content="City Route"><meta property="og:locale" content="pl_PL"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(meta.image)}"><meta property="og:image:alt" content="${e("Okładka: "+meta.name)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(desc)}"><meta name="twitter:image" content="${e(meta.image)}"></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:10vh auto;padding:1rem;line-height:1.5"><h1>${e(meta.name)}</h1><p>${e(meta.description)}</p><p>Otwieramy trasę w City Route…</p><p><a href="${e(target)}">Otwórz trasę</a></p><script>window.location.replace(${JSON.stringify(target)});</script></body></html>`;
}

export async function routeShareResponse(request,rpc){
 const u=new URL(request.url),ref=parseRouteSharePath(u.pathname);
 if(!ref||request.method!=="GET")return new Response("Nie znaleziono trasy.",{status:404,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
 try{
  const meta=await loadSharedRoute(ref,rpc,u.origin);
  if(!meta)return new Response("Trasa nie jest dostępna.",{status:404,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
  const canonical=u.origin+u.pathname.replace(/\/$/,"");
  return new Response(sharePreviewHtml(meta,canonical),{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":meta.unlisted?"private, no-store":"public, max-age=60","x-content-type-options":"nosniff"}});
 }catch{return new Response("Podgląd trasy chwilowo niedostępny.",{status:503,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});}
}
