const CACHE_NAME = 'nellai-erp-v33';
const urlsToCache = [
  './index.html',
  './css/styles.css',
  './js/1-config.js',
  './js/2-utils.js',
  './js/3-auth-db.js',
  './js/4-directory.js',
  './js/5-inventory.js',
  './js/6-cart-builder.js',
  './js/7-pdf-engine.js',
  './js/8-history-payouts.js',
  './js/9-bookkeeping.js',
  './manifest.json',
  './NNlogo-removebg-preview.png',
  './logo-192.png'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', e => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});