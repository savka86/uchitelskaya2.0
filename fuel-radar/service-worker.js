const CACHE='radar-azs-shell-v8';
const SHELL=['/','/pwa.html','/pwa-bootstrap.js','/pwa-photo-v8.js','/index.html','/privacy.html','/rights.html','/manifest.webmanifest','/pwa-icon.svg','/data/camera-status.json','/version.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==location.origin)return;event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});return res}).catch(()=>caches.match(req).then(hit=>hit||caches.match('/pwa.html'))))});
