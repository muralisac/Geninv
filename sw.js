const CACHE_NAME = 'nellai-erp-v10';
const urlsToCache = [
  './index.html',
  './css/styles.css',
  './js/1-firebase-config.js',
  './js/2-ui-utils.js',
  './js/3-auth.js',
  './js/4-database.js',
  './js/5-directory.js',
  './js/6-inventory.js',
  './js/7-transactions.js',
  './js/8-pdf-engine.js',
  './manifest.json',
  './NNlogo-removebg-preview.png',
  './logo-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});