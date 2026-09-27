/* JanSeva service worker: cache-first for app shell */
const CACHE = 'janseva-v2';
const ASSETS = ['./','./index.html','./css/style.css','./js/data.js','./js/auth.js','./js/main.js','./js/complaint.js','./js/admin.js','./js/ui.js','./js/maps.js','./js/engage.js','./manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
