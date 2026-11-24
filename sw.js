const CACHE_NAME = 'damansite-v34';
const CORE_ASSETS = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png',
  './manifest.json?v=28',
  './app-core.js?v=28',
  './wallet-kyc.js?v=28',
  './wallet-ops.js?v=28',
  './chat-support.js?v=28',
  './chat-extras.js?v=28',
  './chat-media.js?v=29',
  './projects-escrow.js?v=28',
  './company-panel.js?v=28',
  './admin.js?v=28',
  './admin-ext.js?v=28',
  './admin-ext2.js?v=28',
  './categories-ads.js?v=30',
  './categories-pack.js?v=33',
  './global-search.js?v=34'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('accounts.google.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
