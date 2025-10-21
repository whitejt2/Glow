/* Cache-first service worker to keep styling/apps available offline */
const CACHE_NAME = 'chrome-skin-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached=>{
      return cached || fetch(req).then(res=>{
        if(req.method==='GET' && res.status===200 && res.type==='basic'){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(req, clone));
        }
        return res;
      }).catch(()=>cached);
    })
  );
});