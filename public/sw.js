const CACHE_NAME = 'pos-v2';
const STATIC_ASSETS = ['/','/ products','/orders','/dashboard','/promotions','/settings'];
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)));self.skipWaiting();});
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',(e)=>{const u=new URL(e.request.url);if(u.hostname.match(/^192\.168\.|^10\.|^172\./))return;if(!u.protocol.startsWith('http'))return;if(e.request.url.includes('supabase.co')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return;}e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});
