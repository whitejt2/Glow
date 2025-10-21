// service-worker.js
/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'glow-routine-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './service-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin requests for cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            // Cache a clone of successful responses
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, respClone);
            });
            return response;
          })
          .catch(() => cached || Promise.reject('Network error'));

        // Cache-first: return cached if available, else network
        return cached || fetchPromise;
      })
    );
  }
});