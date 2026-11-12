const V='gsvct-v1.9.3';
const FILES=['./','index.html','app.js','xlsx.js','manifest.webmanifest','banner.svg','icon-192.png','icon-512.png','fonts/Inter-Regular.woff','fonts/Inter-Medium.woff','fonts/Inter-SemiBold.woff','fonts/Inter-Bold.woff'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp));}return r;}).catch(()=>hit);
    return hit||net;
  }));
});
