/* JanSeva service worker: cache-first for app shell, skip API + uploads */
const CACHE = 'janseva-v3';
const ASSETS = ['./','./index.html','./css/style.css','./js/data.js','./js/api.js','./js/auth.js','./js/main.js','./js/complaint.js','./js/admin.js','./js/ui.js','./js/maps.js','./js/engage.js','./manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
