// Minimal service worker: makes the app installable and shows a friendly page when offline.
// It deliberately never caches pages or API responses, so your financial data is never stored by it.
const V = 'mm-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.add('/offline.html'))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => { if (e.request.mode === 'navigate') e.respondWith(fetch(e.request).catch(() => caches.match('/offline.html'))); });
